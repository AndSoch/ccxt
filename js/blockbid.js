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
        console.log('hiiii')
        let response = await this.publicGetMarkets ();
        return response;
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
