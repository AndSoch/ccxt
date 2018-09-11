"use strict";

const ccxt      = require ('../../ccxt.js')
const asTable   = require ('as-table')
const log       = require ('ololog').configure ({ locate: false })

require ('ansicolor').nice

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async () => {

    let blockbid = new ccxt.blockbid({
      // danm+1 key and secret
      apiKey: 'a32813e5-94e9-462c-a009-f27222a48b33',
      secret:
        'uC3i2yHGcSWbq/5O2s90YvN1epP3E+yr1dBBwJoHOW2eDfzNgqTdK4oRbl3li3DqDpodExX9Ux7GFHWPhG2Zmw=='
    });

    try {
        // and the last one
        let blockbidBalance = await blockbid.fetchBalance ()
        // output it
        log ('balance', blockbidBalance)

    } catch (e) {

        if (e instanceof ccxt.DDoSProtection || e.message.includes ('ECONNRESET')) {
            log.bright.yellow ('[DDoS Protection] ' + e.message)
        } else if (e instanceof ccxt.RequestTimeout) {
            log.bright.yellow ('[Request Timeout] ' + e.message)
        } else if (e instanceof ccxt.AuthenticationError) {
            log.bright.yellow ('[Authentication Error] ' + e.message)
        } else if (e instanceof ccxt.ExchangeNotAvailable) {
            log.bright.yellow ('[Exchange Not Available Error] ' + e.message)
        } else if (e instanceof ccxt.ExchangeError) {
            log.bright.yellow ('[Exchange Error] ' + e.message)
        } else if (e instanceof ccxt.NetworkError) {
            log.bright.yellow ('[Network Error] ' + e.message)
        } else {
            throw e;
        }
    }

}) ()
