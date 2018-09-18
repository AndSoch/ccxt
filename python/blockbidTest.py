import ccxt

blockbid = ccxt.blockbid({
    # 'apiKey': '4911529b-2307-4cf2-bf3f-8fff5c28c41f',
    # 'secret': 'FjTNqaNoXRhrMOMlDiAof8d6n/r7PIX0ZJbIXScZ0ha/XCfcsnQYwmF19bAxMT1Oc9gzAGUOOFci7d7RXlTRkg==',
    'apiKey': 'a32813e5-94e9-462c-a009-f27222a48b33',
    'secret': 'uC3i2yHGcSWbq/5O2s90YvN1epP3E+yr1dBBwJoHOW2eDfzNgqTdK4oRbl3li3DqDpodExX9Ux7GFHWPhG2Zmw==',
})

bb_markets = blockbid.fetch_markets()
print(bb_markets)

bb_ticker = blockbid.fetch_ticker('BTC/USD')
print(bb_ticker)

bb_tickers = blockbid.fetch_tickers()
print(bb_tickers)

bb_order_book = blockbid.fetch_order_book('BTC/USD')
print(bb_order_book)

bb_trades = blockbid.fetch_trades('BTC/USD')
print(bb_trades)

bb_ohlcv = blockbid.fetch_ohlcv(symbol='BTC/USD', timeframe='1w')
print(bb_ohlcv)

bb_balance = blockbid.fetch_balance()
print(bb_balance)

bb_my_trades = blockbid.fetch_my_trades('BTC/USD')
print(bb_my_trades)

new_order = blockbid.create_order(
    symbol = 'BTC/USD',
    type = 'limit',
    side = 'buy',
    amount = '0.0001',
    price = 10)
print(new_order)

new_order_id = new_order['id']
print (new_order_id)

open_orders = blockbid.fetch_open_orders('BTC/USD')
print(open_orders)

new_order2 = blockbid.create_order(
    symbol = 'BTC/USD',
    type = 'limit',
    side = 'buy',
    amount = '0.0001',
    price = 10)

cancelled_order = blockbid.cancel_order(new_order_id)
print(cancelled_order)

cancelled_orders = blockbid.cancel_orders()
print(cancelled_orders)

withdraws = blockbid.fetch_withdrawals('USD')
print(withdraws)
