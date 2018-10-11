const ccxt = require ('../../ccxt');

console.log("Welcome to the CCXT test world");

// console.log (ccxt.exchanges) // print all available exchanges

(async function() {
    let blockbid = new ccxt.blockbid({
      apiKey: '4af6d816-deb0-4eb7-96c5-85c47e4c30ca',
      secret: 'd1vc+EAC4bk7DsUig9ZbhRK/rpx+ziWK4joq8BDYg5SwGJAFDoOoM3kTnfIVMD3hwhGSvsIrDLy3e+l/Kd38xw==',
    });
   
    // Public endpoints 

    // const markets = await blockbid.fetchMarkets();
    // console.log('Markets are:', markets);

    // const tickers = await blockbid.fetchTickers();
    // console.log('Tickers are:', tickers);

    // const orderBook = await blockbid.fetchOrderBook("BTC/AUD");
    // console.log('Order Book:', orderBook);

    // const trades = await blockbid.fetchTrades("BTC/AUD");
    // console.log('Trades: ', trades);

    // ******************************************************************************
    // Private endpoints 

    const balance = await blockbid.fetchBalances();
    console.log("Balance: ", balance);

    
    // const mytrades = await blockbid.fetchMyTrades("ETH/AUD")
    // console.log("MyTrades: ". mytrades)

    
    // const openOrders = await blockbid.fetchOpenOrders("ETH/AUD")
    // console.log("openOrders: ". openOrders)
      
    // const createOrder = await blockbid.createOrder(
    //   symbol = 'BTC/USD',
    //   type = 'limit',
    //   side = 'buy',
    //   amount = '0.0001',
    //   price = 10
    // )
    // console.log("createOrder: ". createOrder)

    
  })();