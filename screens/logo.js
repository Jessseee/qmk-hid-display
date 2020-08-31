'use strict';

const { Screen } = require('./screen.js');

class LogoScreen extends Screen {
  init() {
    super.init();
    this.name = 'Logo';

    // The logo is the 21 keys following each of these characters
    // in the default font.
    const startKeys = [0x80, 0xa0, 0xc0];
    this.screen = startKeys.map((startKey) => {
      let output = ''
      for (let i = 0; i < 21; ++i) {
        output += String.fromCharCode(startKey + i);
      }
      return output;
    });
    this.requestUpdateScreen();
  }
}

module.exports = LogoScreen;
