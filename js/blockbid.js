'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { AuthenticationError } = require('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class blockbid extends Exchange {
  describe() {
    return this.deepExtend(super.describe(), {
      id: 'blockbid',
      name: 'Blockbid',
      countries: ['AUS'],
      rateLimit: 1000,
      has: {
        CORS: false,
        cancelOrders: true,
        fetchDepositAddress: true,
        fetchL2OrderBook: false, // this probably needs to be implemented
        fetchDeposits: true,
        fetchMyTrades: true,
        fetchOpenOrders: true,
        fetchOHLCV: true,
        fetchOrder: true,
        fetchTicker: false,
        fetchTickers: true,
        fetchWithdrawals: true,
        withdraw: true
      },
      timeframes: {
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
        '1w': 10080
      },
      urls: {
        // api: 'https://api.dev.blockbid.io',
        api: 'http://api.local.blockbid.io',
        www: 'https://devblockbid.io',
        doc: 'https://doc.devblockbid.io'
      },
      api: {
        public: {
          get: ['markets', 'tickers', 'ohlc', 'orderbook', 'trades']
        },
        private: {
          get: [
            'identity', // Not implemented yet
            'accounts', // Not implemented yet
            'accounts/{account_id}', // Not implemented yet
            'addresses', // Not implemented yet
            'deposits', // Not implemented yet
            'deposits/{id}', // Not implemented yet
            'trades/my', // Not implemented yet
            'orders', // Not implemented yet
            'orders/{id}', // Not implemented yet
            'withdraws' // Not implemented yet
          ],
          post: [
            'orders', // Not implemented yet
            'withdraws' // Not implemented yet
          ],
          delete: [
            'orders', // Not implemented yet
            'orders/{id}' // Not implemented yet
          ]
        }
      },
      fees: {
        trading: {
          tierBased: false,
          percentage: true,
          maker: 0.1,
          taker: 0.1
        }
      },
      precision: {
        amount: 8,
        price: 8
      }
    });
  }

  async fetchMarkets() {
    let markets = await this.publicGetMarkets();
    let result = [];
    for (let i = 0; i < markets.length; i++) {
      let market = markets[i];
      let id = market['id'];
      let name = market['name'];
      let [baseId, quoteId] = name.split('/');
      let base = this.commonCurrencyCode(baseId);
      let quote = this.commonCurrencyCode(quoteId);
      let symbol = base + '/' + quote;
      let precision = undefined;
      let active = this.safeValue(market, 'is_active', true);

      result.push({
        id: id,
        symbol: symbol,
        base: base,
        quote: quote,
        baseId: baseId.toLowerCase(),
        quoteId: quoteId.toLowerCase(),
        active: active,
        precision: precision,
        limits: {
          amount: {
            min: this.safeFloat(market, 'base_min_size'),
            max: this.safeFloat(market, 'base_max_size')
          },
          price: {
            min: undefined,
            max: undefined
          },
          cost: {
            min: undefined,
            max: undefined
          }
        },
        info: market
      });
    }
    return result;
  }

  parseTicker(ticker, market = undefined) {
    let symbol = undefined;
    if (typeof market === 'undefined') {
      let marketId = this.safeString(ticker, 'market');
      if (marketId in this.markets_by_id) {
        market = this.markets_by_id[marketId];
      } else {
        let [baseId, quoteId] = marketId.split('-');
        let base = this.commonCurrencyCode(baseId);
        let quote = this.commonCurrencyCode(quoteId);
        symbol = base + '/' + quote;
      }
    }
    if (typeof market !== 'undefined') symbol = market['symbol'];
    let datetime = this.safeString(ticker, 'timestamp');
    let timestamp = new Date(datetime).getTime();
    let last = this.safeFloat(ticker, 'last');
    return {
      symbol: symbol,
      timestamp: timestamp,
      datetime: datetime,
      high: this.safeFloat(ticker, '24h_high'),
      low: this.safeFloat(ticker, '24h_low'),
      bid: this.safeFloat(ticker, 'highest_bid'),
      bidVolume: undefined,
      ask: this.safeFloat(ticker, 'lowest_ask'),
      askVolume: undefined,
      vwap: undefined,
      open: undefined,
      close: last,
      last: last,
      previousClose: undefined,
      change: this.safeFloat(ticker, 'percentChanged24hr'),
      percentage: undefined,
      average: undefined,
      baseVolume: this.safeFloat(ticker, '24h_volume'),
      quoteVolume: this.safeFloat(ticker, 'quote_volume'),
      info: ticker
    };
  }

  async fetchTickers(symbols = undefined, params = {}) {
    await this.loadMarkets();
    let tickers = await this.publicGetTickers(params);
    // let tickers = response['result']['tickers'];
    let result = [];
    for (let i = 0; i < tickers.length; i++) {
      result.push(this.parseTicker(tickers[i]));
    }
    return this.indexBy(result, 'symbol');
  }

  async fetchOrderBook(symbol, limit = undefined, params = {}) {
    await this.loadMarkets();
    let request = {
      market: this.marketId(symbol)
    };
    if (typeof limit !== 'undefined') request['limit'] = limit; // 100
    let response = await this.publicGetOrderbook(this.extend(request, params));

    let preParseBook = {};
    let arrBids = [];
    let arrAsks = [];

    for (let i = 0; i < response.bids.length; i++) {
      arrBids.push([response.bids[i].price, response.bids[i].volume, []]);
    }
    for (let i = 0; i < response.asks.length; i++) {
      arrAsks.push([response.asks[i].price, response.asks[i].volume, []]);
    }
    preParseBook['bids'] = arrBids;
    preParseBook['asks'] = arrAsks;

    return this.parseOrderBook(preParseBook, undefined, 'bids', 'asks', 0, 1);
  }

  parseTrade(trade, market = undefined) {
    let symbol = undefined;
    if (market) symbol = market['symbol'];
    let datetime = trade['timestamp'];
    let timestamp = new Date(datetime).getTime();
    let price = this.safeFloat(trade, 'price');
    let amount = this.safeFloat(trade, 'volume');
    let cost = price * amount;
    let side = trade['side'] === 'bid' ? 'sell' : 'buy';
    return {
      info: trade,
      timestamp: timestamp,
      datetime: datetime,
      symbol: symbol,
      id: trade['tradeID'],
      order: undefined,
      type: undefined,
      side: side,
      price: price,
      amount: amount,
      cost: cost,
      fee: undefined
    };
  }

  async fetchTrades(symbol, since = undefined, limit = 50, params = {}) {
    await this.loadMarkets();
    let market = this.market(symbol);
    let response = await this.publicGetTrades(
      this.extend(
        {
          market: market['id'],
          limit: limit // default 20, but that seems too little
        },
        params
      )
    );
    return this.parseTrades(response, market, since, limit);
  }

  parseOHLCV(
    ohlcv,
    market = undefined,
    timeframe = '5m',
    since = undefined,
    limit = undefined
  ) {
    let datetime = new Date(ohlcv['timestamp']).getTime();
    return [
      datetime,
      parseFloat(ohlcv['open']),
      parseFloat(ohlcv['high']),
      parseFloat(ohlcv['low']),
      parseFloat(ohlcv['close']),
      parseFloat(ohlcv['volume'])
    ];
  }

  async fetchOHLCV(
    symbol,
    timeframe = '1m',
    since = undefined,
    limit = undefined,
    params = {}
  ) {
    await this.loadMarkets();
    let market = this.market(symbol);
    //
    // they say in their docs that end_time defaults to current server time
    // but if you don't specify it, their range limits does not allow you to query anything
    //
    // they also say that start_time defaults to 0,
    // but most calls fail if you do not specify any of end_time
    //
    // to make things worse, their docs say it should be a Unix Timestamp
    // but with seconds it fails, so we set milliseconds (somehow it works that way)
    //
    let endTime = this.milliseconds();
    let request = {
      market: market['id'],
      period: this.timeframes[timeframe]
    };
    if (typeof since !== 'undefined') request['timestamp'] = since;
    let response = await this.publicGetOhlc(this.extend(request, params));
    // let ohlcv = response;//['result']['candles'];
    return this.parseOHLCVs(response, market, timeframe, since, limit);
  }

  async fetchBalance(params = {}) {
    await this.loadMarkets();
    let response = await this.privateGetAccounts(params);
    let result = { info: response };
    for (let i = 0; i < response.length; i++) {
      let balance = response[i];
      let currency = balance['currency'];
      if (currency in this.currencies_by_id)
        currency = this.currencies_by_id[currency]['code'];
      let account = {
        free: parseFloat(balance['balance']),
        used: parseFloat(balance['locked']),
      };
      account['total'] = parseFloat(account['free'] + account['used'])
      result[currency] = account;
    }
    return this.parseBalance(result);
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
      if (status in statuses)
          return statuses[status];
      return status;
  }

  parseOrder (order, market = undefined) {
      let symbol = undefined;
      if (typeof market === 'undefined') {
          let marketId = this.safeString2 (order, 'market');
          market = this.safeValue (this.markets_by_id, marketId);
      }
      if (typeof market !== 'undefined')
          symbol = market['symbol'];
      let datetime = this.safeString (order, 'timestamp');
      let price = this.safeFloat (order, 'price');
      let average = this.safeFloat (order, 'avgPrice');
      let amount = this.safeFloat (order, 'volume');
      let filled = this.safeFloat (order, 'executedVolume');
      let remaining = this.safeFloat (order, 'remainingVolume');
      let cost = undefined;
      if (typeof filled !== 'undefined' && typeof average !== 'undefined') {
          cost = average * filled;
      } else if (typeof average !== 'undefined') {
          cost = average * amount;
      }
      if (typeof amount !== 'undefined') {
          if (typeof filled !== 'undefined') {
              remaining = amount - filled;
          }
      }
      let status = this.parseOrderStatus (this.safeString (order, 'state'));
      let side = this.safeString (order, 'side');
      if (side === 'bid') {
          side = 'buy';
      } else if (side === 'ask') {
          side = 'sell';
      }
      return {
          'id': this.safeString (order, 'ordID'),
          'datetime': datetime,
          'timestamp': (new Date(datetime)).getTime(),
          'lastTradeTimestamp': undefined,
          'status': status,
          'symbol': symbol,
          'type': this.safeString (order, 'ordType'), // market, limit, stop, stop_limit, trailing_stop, fill_or_kill
          'side': side,
          'price': price,
          'cost': cost,
          'average': average,
          'amount': amount,
          'filled': filled,
          'remaining': remaining,
          'trades': this.safeString( order, 'tradesCount'),
          'fee': undefined,
          'info': order,
      };
  }

  async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
      await this.loadMarkets ();
      let market = this.market (symbol);
      let request = {
          'market': market['id'],
          'orders': [
            {
              'side': side,
              'volume': amount,
              'ord_type': type, // market, limit, stop, stop_limit
          }
        ]
      };
      if (type !== 'market') {
          request['orders'][0]['price'] = price;
      }
      let response = await this.privatePostOrders (this.extend (request, params));
      let order = this.parseOrder (response[0], market);
      let id = order['id'];
      this.orders[id] = order;
      return order;
  }

  async fetchOrder (id, symbol = undefined, params = {}) {
      await this.loadMarkets ();
      let response = await this.privateGetOrdersId (this.extend ({
          'id': id.toString (),
      }, params));
      return this.parseOrder (response);
  }

  async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
      await this.loadMarkets ();
      let request = {
        market: symbol,
        limit,
      }
      let result = await this.privateGetOrders (this.extend(request, params));
      let orders = this.parseOrders (result, undefined, since, limit);
      return orders;
  }



  sign(
    path,
    api = 'public',
    method = 'GET',
    params = {},
    headers = undefined,
    body = undefined
  ) {
    let url = this.urls['api'] + '/' + this.implodeParams(path, params);
    let query = this.omit(params, this.extractParams(path));
    headers = {};
    if (api === 'private') {
      let nonce = String(this.nonce())
      let rawSignature =
        this.stringToBase64(this.apiKey) + this.stringToBase64(nonce);
      this.checkRequiredCredentials();

      const signature = this.hmac(
        rawSignature,
        this.secret,
        'sha384',
        'base64'
      );

      headers['X-Blockbid-Signature'] = signature;
      headers['X-Blockbid-Nonce'] = nonce;
      headers['X-Blockbid-Api-Key'] = this.apiKey;
    }
    if (method === 'GET') {
      query = this.urlencode(query);
      if (query.length) url += '?' + query;
    } else {
      headers['Content-type'] = 'application/json; charset=UTF-8';
      body = this.json(query);
    }
    return { url: url, method: method, body: body, headers: headers };
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

  nonce() {
    return this.milliseconds();
  }
};
