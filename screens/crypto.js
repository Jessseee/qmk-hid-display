// crypto page
'use strict';

const { LoopingScreen } = require('./screen.js');
const request = require('request');

class CryptoScreen extends LoopingScreen {
  init() {
    super.init();
    this.name = 'Crypto';

    this.quotes = new Map();
    for (let crypto of this.nconf.get('cryptocurrencies').split(',')) {
      this.quotes.set(crypto.trim(), []);
    }
  }

  update() {
    this.updateCryptoPrices();
    this.updateScreen();
  }

  updateCryptoPrices() {
    const promises = [];
    const priceRegex = /"priceValue[^>]+>\$([^<]+)</;
    const codeRegex = /"nameSymbol[^>]+>([^<]+)</;
    const percentRegex = /"priceValue[^!]+icon-Caret-([^"]+)"><\/span>([^\s]+)\s*</;
    for (const [cryptocurrency, value] of this.quotes) {
      promises.push(new Promise((resolve) => {
        request(`https://coinmarketcap.com/currencies/${cryptocurrency}/`,
          (err, res, body) => {
          const priceResult = priceRegex.exec(body);
          const codeResult = codeRegex.exec(body);
          const percentResult = percentRegex.exec(body);
          if (priceResult && priceResult.length > 1) {
            let price = parseFloat(priceResult[1].replace(',',''));
            let code = codeResult[1];
            price = price.toFixed(2);
            let percentDirection = percentResult[1];
            let percent = parseFloat(percentResult[2].replace(',',''));
            if (percentDirection == 'down') {
              percent *= -1;
            }
            this.quotes.set(cryptocurrency, [code, price, percent]);
          }
          resolve();
        });
      }));
    }
    return Promise.all(promises);
  }

  updateScreen() {
    this.screen = [];
    for (const [key, value] of this.quotes) {
      if (value.length == 0) {
        continue;
      }
      let [code, price, percent] = value;
      this.screen.push(code.padStart(4) + ': $'
        + price.toString().substr(0, 7).padEnd(7)
        + (percent.toFixed(1) + '%').padStart(7));
    }
    super.updateScreen();
  }
}

module.exports = CryptoScreen;
