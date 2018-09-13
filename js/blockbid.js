'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const {
  ExchangeError,
  InsufficientFunds,
  PermissionDenied,
} = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class blockbid extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'blockbid',
            'name': 'Blockbid',
            'countries': ['AUS'],
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
                '1m': 1,
                '5m': 5,
                '15m': 15,
                '30m': 30,
                '1h': 60,
                '2h': 120,
                '4h': 240,
                '6h': 360,
                '12h': 720,
                '1d': 1440,
                '3d': 4280,
                '1w': 10080,
            },
            'urls': {
                'api': 'https://api.dev.blockbid.io',
                'www': 'https://devblockbid.io',
                'doc': 'https://doc.devblockbid.io',
            },
            'api': {
                'public': {
                    'get': ['markets', 'tickers', 'ohlc', 'orderbook', 'trades']
                },
                'private': {
                    'get': [
                        'identity',
                        'balances',
                        'balances/{currency}',
                        'addresses',
                        'deposits',
                        'deposits/{id}',
                        'trades/my',
                        'orders',
                        'orders/{id}',
                        'withdraws/fiat',
                        'withdraws/crypto',
                    ],
                    'post': [
                        'orders',
                        'withdraws/fiat',
                        'withdraw/crypto',
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
            'supportedFiat': [
                'AUD',
                'USD',
                'EUR',
                'JPY',
            ],
        });
    }

    async fetchMarkets () {
        let markets = await this.publicGetMarkets ();
        let err = this.handleError (markets);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err)
        }
        let result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market['id'];
            let name = market['name'];
            let [baseId, quoteId] = name.split ('/');
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
        return result;
    }

    parseTicker (ticker, market = undefined) {
        let symbol = undefined;
        if (typeof market === 'undefined') {
            let marketId = this.safeString (ticker, 'market');
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else {
                let [baseId, quoteId] = marketId.split ('-');
                let base = this.commonCurrencyCode (baseId);
                let quote = this.commonCurrencyCode (quoteId);
                symbol = base + '/' + quote;
            }
        }
        if (typeof market !== 'undefined') {
            symbol = market['symbol'];
        }
        let datetime = this.safeString (ticker, 'timestamp');
        let timestamp = this.parse8601 (datetime);
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
            'info': ticker }
    }

    async fetchTicker (symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let tickers = await this.publicGetTickers (params);
        let err = this.handleError (tickers);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        const marketId = this.marketId (symbol);
        for (let i = 0; i < tickers.length; i++) {
            const ticker = tickers[i];
            if (ticker.market === marketId) {
                return this.parseTicker (ticker);
            }
        }
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        let tickers = await this.publicGetTickers (params);
        let result = [];
        for (let i = 0; i < tickers.length; i++) {
            result.push (this.parseTicker (tickers[i]));
        }
        return this.indexBy (result, 'symbol');
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {
            'market': this.marketId (symbol)
        };
        if (typeof limit !== 'undefined') {
            request['asks_limit'] = limit;
            request['bids_limit'] = limit;
        }
        let response = await this.publicGetOrderbook (this.extend (request, params));
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        let preParseBook = {};
        let arrBids = [];
        let arrAsks = [];
        for (let i = 0; i < response.bids.length; i++) {
            arrBids.push ([response.bids[i].price, response.bids[i].volume, []]);
        }
        for (let i = 0; i < response.asks.length; i++) {
            arrAsks.push ([response.asks[i].price, response.asks[i].volume, []]);
        }
        preParseBook['bids'] = arrBids;
        preParseBook['asks'] = arrAsks;
        return this.parseOrderBook (preParseBook, undefined, 'bids', 'asks', 0, 1);
    }

    parseTrade (trade, market = undefined) {
        let symbol = undefined;
        if (market) {
            symbol = market['symbol'];
        }
        let datetime = trade['createdAt'];
        let timestamp = this.parse8601 (datetime);
        let price = this.safeFloat (trade, 'price');
        let amount = this.safeFloat (trade, 'volume');
        let cost = price * amount;
        return {
            'info': trade,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': symbol,
            'id': trade['id'],
            'order': undefined,
            'type': undefined,
            'side': trade['side'],
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined };
    }

    async fetchTrades (symbol, since = undefined, limit = 50, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let response = await this.publicGetTrades (
            this.extend ({
                'market': market['id'],
                'limit': limit,
            }, params)
        );
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        return this.parseTrades (response, market, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '5m', since = undefined, limit = undefined ) {
        let datetime = this.parse8601 (ohlcv['timestamp']);
        return [
            datetime,
            parseFloat (ohlcv['open']),
            parseFloat (ohlcv['high']),
            parseFloat (ohlcv['low']),
            parseFloat (ohlcv['close']),
            parseFloat (ohlcv['volume']),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {} ) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'market': market['id'],
            'period': this.timeframes[timeframe],
        };
        if (typeof since !== 'undefined') {
            request['timestamp'] = since;
        }
        let response = await this.publicGetOhlc (this.extend (request, params));
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        return this.parseOHLCVs (response, market, timeframe, since, limit);
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' fetchBalance() requires you to have a valid api key and secret.');
        }
        let response = await this.privateGetBalances (params);
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        let result = { 'info': response };
        for (let i = 0; i < response.length; i++) {
            let balance = response[i];
            let currency = balance['currency'];
            if (currency in this.currencies_by_id) {
                currency = this.currencies_by_id[currency]['code'];
            }
            let account = {
                'free': balance['available'],
                'used': balance['locked'],
                'total': balance['total'],
            };
            result[currency] = account;
        }
        return this.parseBalance (result);
    }

    parseOrderStatus (status) {
        let statuses = {
            'filled': 'closed',
            'rejected': 'closed',
            'partially_filled': 'open',
            'pending_cancellation': 'open',
            'pending_modification': 'open',
            'open': 'open',
            'new': 'open',
            'queued': 'open',
            'cancelled': 'canceled',
            'triggered': 'triggered',
        };
        if (status in statuses) {
            return statuses[status];
        }
        return status;
    }

    parseOrder (order, market = undefined) {
        let symbol = undefined;
        if (typeof market === 'undefined') {
            let marketId = this.safeString2 (order, 'market');
            market = this.safeValue (this.markets_by_id, marketId);
        }
        if (typeof market !== 'undefined') {
            symbol = market['symbol'];
        }
        let datetime = this.safeString (order, 'createdAt');
        let price = this.safeFloat (order, 'price');
        let average = this.safeFloat (order, 'averagePrice');
        let amount = this.safeFloat (order, 'volume');
        let filled = this.safeFloat (order, 'executedVolume');
        let remaining = this.safeFloat (order, 'remainingVolume');
        let cost = undefined;
        if (typeof filled !== 'undefined' && typeof average !== 'undefined') {
            cost = average * filled;
        } else if (typeof average !== 'undefined') {
            cost = average * amount;
        }
        let status = this.parseOrderStatus (this.safeString (order, 'state'));
        let side = this.safeString (order, 'side');
        if (side === 'bid') {
            side = 'buy';
        } else if (side === 'ask') {
            side = 'sell';
        }
        let timestamp = this.parse8601 (datetime);
        return {
            'id': this.safeString (order, 'id'),
            'datetime': datetime,
            'timestamp': timestamp,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': this.safeString (order, 'orderType'),
            'side': side,
            'price': price,
            'cost': cost,
            'average': average,
            'amount': amount,
            'filled': filled,
            'trades': this.safeString (order, 'tradesCount'),
            'remaining': remaining,
            'fee': undefined,
            'info': order };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' createOrder() requires you to have a valid api key and secret.');
        }
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'market': market['id'],
            'orders': [
                {
                    'side': side,
                    'volume': amount,
                    'ord_type': type,
                },
            ],
        };
        if (type !== 'market') {
            request['orders'][0]['price'] = price;
        }
        let response = await this.privatePostOrders (this.extend (request, params));
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err)
        }
        let order = this.parseOrder (response[0], market);
        let id = order['id'];
        this.orders[id] = order;
        return order;
    }

    async cancelOrder (id, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' cancelOrder() requires you to have a valid api key and secret.');
        }
        let response = await this.privateDeleteOrdersId (
            this.extend ({
                'id': id,
            }, params)
        );
        if (response.error || response.message) {
            throw new PermissionDenied (this.id + ' cancelOrder() requires a valid api key');
        }
        return this.parseOrder (
            this.extend (response, { 'id': id })
        );
    }

    async cancelOrders (side, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' cancelOrders() requires you to have a valid api key and secret.');
        }
        let response = await this.privateDeleteOrders (
            this.extend ({ 'side': side }, params)
        );
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        return this.parseOrders (response);
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' fetchOrder() requires you to have a valid api key and secret.');
        }
        await this.loadMarkets ();
        let response = await this.privateGetOrdersId (
            this.extend ({ 'id': id.toString () }, params)
        );
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        return this.parseOrder (response);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' fetchOpenOrders() requires you to have a valid api key and secret.');
        }
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'market': market['id'],
            'limit': limit,
        };
        let result = await this.privateGetOrders (this.extend (request, params));
        let err = this.handleError (result);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        let orders = this.parseOrders (result, undefined, since, limit);
        return orders;
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' fetchMyTrades() requires you to have a valid api key and secret.');
        }
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'market': market['id'],
            'limit': limit,
        };
        let response = await this.privateGetTradesMy (this.extend (request, params));
        let err = this.handleError (response);
        if (err) {
            throw new ExchangeError (this.id + ' has thrown an error: ' + err);
        }
        return this.parseTrades (response, market, since, limit);
    }

    async fetchWithdrawals (code = undefined, since = undefined, limit = undefined, params = {}) {
        if (!this.apiKey || !this.secret) {
            throw new PermissionDenied (this.id + ' fetchWithdrawals() requires you to have a valid api key and secret.');
        }
        await this.loadMarkets ();
        if (typeof code === 'undefined') {
            throw new ExchangeError (this.id + ' fetchWithdrawals() requires a currency code argument');
        }
        let currency = this.currency (code);
        let request = {
            'currency': currency['id'],
            'limit': limit,
        };
        const currencyCode = currency['code'];
        if (this.supportedFiat.indexOf (currencyCode) !== -1) {
            let response = await this.privateGetWithdrawsFiat (
                this.extend (request, params)
            );
            let err = this.handleError (response);
            if (err) {
                throw new ExchangeError (this.id + ' has thrown an error: ' + err);
            }
            return this.parseTransactions (response, currency);
        } else {
            let response = await this.privateGetWithdrawsCrypto (
                this.extend (request, params)
            );
            let err = this.handleError (response);
            if (err) {
                throw new ExchangeError (this.id + ' has thrown an error: ' + err);
            }
            return this.parseTransactions (response, currency);
        }
    }

    parseTransactionStatus (status) {
        let statuses = {
            'tx_pending_two_factor_auth': 'pending',
            'tx_pending_email_auth': 'pending',
            'tx_pending_approval': 'pending',
            'tx_approved': 'pending',
            'tx_processing': 'pending',
            'tx_pending': 'pending',
            'tx_sent': 'pending',
            'tx_cancelled': 'canceled',
            'tx_timeout': 'error',
            'tx_invalid': 'error',
            'tx_rejected': 'error',
            'tx_confirmed': 'ok',
        };
        return status in statuses ? statuses[status] : status.toLowerCase ();
    }

    parseTransaction (transaction, currency = undefined) {
        let datetime = this.safeString (transaction, 'timeCreated');
        let timestamp = this.parse8601 (datetime);
        let code = undefined;
        if (typeof currency === 'undefined') {
            let currencyId = this.safeString (transaction, 'currency');
            if (currencyId in this.currencies_by_id) {
                currency = this.currencies_by_id[currencyId];
            }
            code = this.commonCurrencyCode (currencyId);
        }
        if (typeof currency !== 'undefined') {
            code = currency['code'];
        }
        return {
            'info': transaction,
            'id': this.safeString (transaction, 'withdrawID'),
            'txid': this.safeString (transaction, 'txid'),
            'timestamp': timestamp,
            'datetime': datetime,
            'address': this.safeString (transaction, 'address'), // or is it defined?
            'type': undefined, // direction of the transaction, ('deposit' | 'withdraw')
            'amount': this.safeFloat (transaction, 'amount'),
            'currency': code,
            'status': this.parseTransactionStatus (transaction['state']),
            'updated': this.safeString (transaction, 'timeUpdated'),
            'fee': {
                'cost': this.safeFloat (transaction, 'fee'),
                'rate': undefined,
            },
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + this.implodeParams (path, params);
        let query = this.omit (params, this.extractParams (path));
        headers = {};
        if (api === 'private') {
            let nonce = this.safeString (this.nonce ());
            let rawSignature = this.stringToBase64 (this.apiKey) + this.stringToBase64 (nonce);
            this.checkRequiredCredentials ();
            const signature = this.hmac (rawSignature, this.secret, 'sha384', 'base64');
            headers['X-Blockbid-Signature'] = signature;
            headers['X-Blockbid-Nonce'] = nonce;
            headers['X-Blockbid-Api-Key'] = this.apiKey;
        }
        if (method === 'GET') {
            query = this.urlencode (query);
            if (query.length) {
                url += '?' + query;
            }
        } else {
            headers['Content-type'] = 'application/json; charset=UTF-8';
            body = this.json (query);
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleError (response) {
        if (response.error) {
            return response.error.message;
        }
        if (response.message) {
            return response.message;
        }
        return undefined;
    }

    nonce () {
        return this.milliseconds ();
    }
};
