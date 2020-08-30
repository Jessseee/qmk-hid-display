// stocks page
// logic from https://github.com/BlankSourceCode/qmk-hid-display
'use strict';

const Screen = require('./screen.js');
const request = require('request');

class StocksScreen extends Screen {
  init() {
    super.init();
    this.name = 'Stocks';

    // Set the stocks that we want to show
    // TODO: nconf
    this.stocks = new Map([
      ['TSLA', 0],
      ['AMZN', 0],
      ['AAPL', 0]
    ]);
  }

  activate() {
    // If we have a running loop, then wait for it to finish and then start
    // a new one
    if (this.runningMonitor && !this.active) {
      this.runningMonitor.then(() => {
        super.activate();
        this.runningMonitor = this.stockMonitor();
      });
    } else {
      super.activate();
      this.runningMonitor = this.stockMonitor();
    }
  }

  async stockMonitor() {
    while (true) {
      // Get the current stock prices
      // (don't await since we're ok with this being slightly out of date)
      // TODO: prevent multiple requests of the same stock
      this.updateStockPrices();
      this.updateScreen();

      // Pause a bit before requesting more info
      await this.wait(1000);
    }
  }

  updateStockPrices() {
    // The regex used to grab the price from the yahoo stocks page
    const priceRegex = /"currentPrice":({[^}]+})/;
    const promises = [];
    for (const [key, value] of this.stocks) {
      promises.push(new Promise((resolve) => {
        // Get the stock price page for the current stock
        request(`https://finance.yahoo.com/quote/${key}/`, (err, res, body) => {
          // Parse out the price and update the map
          const result = priceRegex.exec(body);
          if (result && result.length > 1) {
            let price = JSON.parse(result[1]).raw;
            price = price.toFixed(2);
            this.stocks.set(key, price);
          }
          resolve();
        });
      }));
    }

    // Wait for all the stocks to be updated
    return Promise.all(promises);
  }

  updateScreen() {
    // Create a screen using the stock data
    this.screen = [];
    for (const [key, value] of this.stocks) {
      this.screen.push(key.padEnd(5) + ': $' + value);
    }
    super.updateScreen();
  }
}

module.exports = StocksScreen;

