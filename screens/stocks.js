// stocks page
// logic from https://github.com/BlankSourceCode/qmk-hid-display
'use strict';

const { LoopingScreen } = require('./screen.js');
const request = require('request');
const { ConfigPage } = require('../config.js');

class StocksScreen extends LoopingScreen {
  constructor(...args) {
    super(...args);
    this.name = 'Stocks';
    this.storePrefix = 'screens-stocks-';
    this.stocks = new Map();

    this.configPage = new ConfigPage(this.storePrefix, [
      { params: {
        stocks: { label: 'Stocks', default: 'TSLA,NFLX,AMZN,AAPL' }
      }}], this.configPage);
  }

  init() {
    super.init();
    this.initStocks();
    this.onStoreChanged('stocks', () => this.initStocks());
  }

  initStocks() {
    // Set the stocks that we want to show
    this.stocks = new Map();
    for (let stock of this.getStore('stocks').split(',')) {
      this.stocks.set(stock.trim(), 0);
    }
  }

  update() {
    this.updateStockPrices();
    this.updateScreen();
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
            if (this.stocks.has(key)) {
              this.stocks.set(key, price);
            }
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

