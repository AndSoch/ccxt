'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AuthenticationError } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class blockbid extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'blockbid',
            'name': 'Blockbid',
            'countries': [ 'AUS' ],
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                'cancelOrders': true,
                'fetchDepositAddress': true,
                'fetchL2OrderBook': false, // this probably needs to be implemented
                'fetchDeposits': true,
                'fetchMyTrades': true,
                'fetchOpenOrders': true,
                'fetchOHLCV': true,
                'fetchOrder': true,
                'fetchTicker': false,
                'fetchTickers': true,
                'fetchWithdrawals': true,
                'withdraw': true,
            },
            'timeframes': {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '2h': '2h',
                '4h': '4h',
                '6h': '6h',
                '12h': '12h',
                '1d': '1d',
                '3d': '3d',
                '1w': '1w',
            },
            'urls': {
                'api': 'https://api.devblockbid.io',
                'www': 'https://devblockbid.io',
                'doc': 'https://doc.devblockbid.io',
            },
            'api': {
                'public': {
                    'get': [
                        'markets',
                        'tickers',
                        'ohlc',
                        'orderbook',
                        'trade',
                    ],
                },
                'private': {
                    'get': [
                        'identity',
                        'accounts',
                        'accounts/{account_id}',
                        'addresses',
                        'deposits',
                        'deposits/{id}',
                        'trades/my',
                        'orders',
                        'orders/{id}',
                        'withdraws',
                    ],
                    'post': [
                        'orders',
                        'withdraws',
                    ],
                    'delete': [
                        'orders',
                        'orders/{id}',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.1,
                    'taker': 0.1,
                },
            },
            'precision': {
                'amount': 8,
                'price': 8,
            },
        });
    }

    async fetchMarkets () {
        let markets = await this.publicGetMarkets ();
        let result = [];
        for (let i = 0; i < markets.length; i++) {
          let market = markets[i];
          let id = market['id'];
          let name = market['name'];
          let [ baseId, quoteId ] = name.split ('/');
          let base = this.commonCurrencyCode (baseId);
          let quote = this.commonCurrencyCode (quoteId);
          let symbol = base + '/' + quote;
          let precision = undefined;
          let active = this.safeValue (market, 'is_active', true);

          result.push ({
              'id': id,
              'symbol': symbol,
              'base': base,
              'quote': quote,
              'baseId': baseId.toLowerCase (),
              'quoteId': quoteId.toLowerCase (),
              'active': active,
              'precision': precision,
              'limits': {
                  'amount': {
                      'min': this.safeFloat (market, 'base_min_size'),
                      'max': this.safeFloat (market, 'base_max_size'),
                  },
                  'price': {
                      'min': undefined,
                      'max': undefined,
                  },
                  'cost': {
                      'min': undefined,
                      'max': undefined,
                  },
              },
              'info': market,
          });
        }
        return result
    }

    parseTicker (ticker, market = undefined) {
        let symbol = undefined;
        if (typeof market === 'undefined') {
            let marketId = this.safeString (ticker, 'market');
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else {
                let [ baseId, quoteId ] = marketId.split ('-');
                let base = this.commonCurrencyCode (baseId);
                let quote = this.commonCurrencyCode (quoteId);
                symbol = base + '/' + quote;
            }
        }
        if (typeof market !== 'undefined')
            symbol = market['symbol'];
        let datetime = this.safeString (ticker, 'timestamp');
        let timestamp = ( new Date (datetime) ).getTime ()
        let last = this.safeFloat (ticker, 'last');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': datetime,
            'high': this.safeFloat (ticker, '24h_high'),
            'low': this.safeFloat (ticker, '24h_low'),
            'bid': this.safeFloat (ticker, 'highest_bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'lowest_ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': this.safeFloat (ticker, 'percentChanged24hr'),
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker, '24h_volume'),
            'quoteVolume': this.safeFloat (ticker, 'quote_volume'),
            'info': ticker,
        };
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        let tickers = await this.publicGetTickers (params);
        // let tickers = response['result']['tickers'];
        let result = [];
        for (let i = 0; i < tickers.length; i++) {
            result.push (this.parseTicker (tickers[i]));
        }
        return this.indexBy (result, 'symbol');
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + this.implodeParams (path, params);
        let query = this.omit (params, this.extractParams (path));
        headers = {};
        if (api === 'private') {
            this.checkRequiredCredentials ();
            // headers['device_id'] = this.apiKey;
            headers['nonce'] = this.nonce ().toString ();
            headers['Authorization'] = this.apiKey;
        }
        if (method === 'GET') {
            query = this.urlencode (query);
            if (query.length)
                url += '?' + query;
        } else {
            headers['Content-type'] = 'application/json; charset=UTF-8';
            body = this.json (query);
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    // handleErrors (code, reason, url, method, headers, body) {
    //     if (code < 400 || code >= 600) {
    //         return;
    //     }
    //     if (body[0] !== '{') {
    //         throw new ExchangeError (this.id + ' ' + body);
    //     }
    //     let response = JSON.parse (body);
    //     const feedback = this.id + ' ' + this.json (response);
    //     let errorCode = this.safeValue (response['error'], 'error_code');
    //     if (method === 'DELETE' || method === 'GET') {
    //         if (errorCode === 'parameter_error') {
    //             if (url.indexOf ('trading/orders/') >= 0) {
    //                 // Cobinhood returns vague "parameter_error" on fetchOrder() and cancelOrder() calls
    //                 // for invalid order IDs as well as orders that are not "open"
    //                 throw new InvalidOrder (feedback);
    //             }
    //         }
    //     }
    //     const exceptions = this.exceptions;
    //     if (errorCode in exceptions) {
    //         throw new exceptions[errorCode] (feedback);
    //     }
    //     throw new ExchangeError (feedback);
    // }

    nonce () {
        return this.milliseconds ();
    }
};
