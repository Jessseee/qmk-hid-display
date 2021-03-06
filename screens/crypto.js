// crypto page
'use strict';

const { LoopingScreen } = require('./screen.js');
const CoinMarketCap = require('coinmarketcap-api');
const request = require('request');

class CryptoScreen extends LoopingScreen {
  init() {
    super.init();
    this.name = 'Crypto';

    const apiKey = this.nconf.get('coinmarketcapApiKey');
    this.cmcClient = new CoinMarketCap(apiKey);

    this.quotes = new Map();
    for (let symbol of this.nconf.get('cryptocurrencies').split(',')) {
      this.quotes.set(symbol.trim(), {});
    }
    this.error = null;

    // jank flag to allow a different update freq
    this.updating = false;

    // check every minute
    this.updateDelay = 60000;
  }

  update() {
    if (!this.updating) {
      // Start an update if we don't one have in progress
      this.updating = true;
      this.cmcClient.getQuotes({symbol: Array.from(this.quotes.keys())})
        .then((result) => { this.updateCrypto(result); })
        .catch(console.error);
    }
    this.updateScreen();
  }

  updateScreen() {
    this.screen = [];
    if (this.error) {
      this.screen.push(this.screenScroll(this.error));
    } else {
      for (const [symbol, quote] of this.quotes) {
        if (!quote.USD) {
          // quote not populated / doesn't have USD
          continue;
        }
        this.screen.push(symbol.padStart(4) + ': $'
          + quote.USD.price.toString().substr(0, 7).padEnd(7)
          + ((quote.USD.percent_change_24h).toFixed(1) + '%').padStart(7));
      }
    }
    super.updateScreen();
  }

  async updateCrypto(result) {
    this.error = null;
    if (result.status.error_code != 0) {
      this.error = result.status.error_message;
      console.error(this.error);
    } else {
      for (const symbol in result.data) {
        if (result.data[symbol]) {
          this.quotes.set(symbol, result.data[symbol].quote);
        }
      }
    }
    // wait the update delay before starting again
    // TODO: cleanup this jank
    await this.wait(this.updateDelay);
    this.updating = false;
  }
}

module.exports = CryptoScreen;
