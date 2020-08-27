class Screen {
  constructor(tray, nconf, session, updateScreenCallback, updateTrayMenuCallback) {
    this.tray = tray;
    this.nconf = nconf;
    this.session = session;
    this.updateTrayMenuCallback = updateTrayMenuCallback;
    this.updateScreenCallback = updateScreenCallback;

    this.screen = [];
    this.trayMenu = [];

    this.lastParsedScreen = 0;

    this.init();
  }

  init() {
  }

  parsedScreen(curMs) {
    let parsedScreen = '';
    for (const rawLine of this.screen) {
      let line = rawLine;
      if (line.length < 21) {
        line = line + ' '.repeat(21 - line.length);
      } else {
        line = line.substr(0, 21);
      }
      parsedScreen += line;
    }
    if (parsedScreen.length < 84) {
      parsedScreen += ' '.repeat(84 - parsedScreen);
    }
    return parsedScreen;
  }

  // Helper wait function
  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
  }
}

module.exports = Screen;
