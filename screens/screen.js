// base screen class
'use strict';

class Screen {
  constructor(tray, nconf, session, updateScreenCallback, updateTrayMenuCallback, displayHeight = 4, displayWidth = 21) {
    this.tray = tray;
    this.nconf = nconf;
    this.session = session;
    this.updateTrayMenuCallback = updateTrayMenuCallback;
    this.updateScreenCallback = updateScreenCallback;

    this.displayHeight = displayHeight;
    this.displayWidth = displayWidth;

    this.screen = [];
    this.trayMenu = [];

    this.init();
  }

  init() {
  }

  parsedScreen() {
    let parsedScreen = '';
    let clampPad = (str, size) => {
      if (str.size < size) {
        return ' '.repeat(size - str.length);
      } else {
        return str.substr(0, size);
      }
    };

    for (const line of this.screen) {
      // todo: marquee
      parsedScreen += clampPad(line, this.displayWidth);
    }
    parsedScreen = clampPad(parsedScreen, this.displayHeight * this.displayWidth);
    return parsedScreen;
  }

  screenBar(progress, label = '', endPoints = true) {
    let out = label;
    let actualBarSize = this.displayWidth - label.length;
    if (endPoints) {
      actualBarSize -= 2;
    }

    const progressQuantized = Math.floor(actualBarSize * progress);
    const progressRemainder = progress * actualBarSize - progressQuantized;
    // 6 different characters to show sub-char progress
    const progressRemainderQuantized = Math.floor(progressRemainder * 6);
    let progressBar = '\u009b'.repeat(progressQuantized) + String.fromCharCode(149 + progressRemainderQuantized);
    progressBar += ' '.repeat(actualBarSize - Math.min(progressBar.length, 19));
    if (endPoints) {
      progressBar = '\u009c' + progressBar + '\u009d';
    }
    out += progressBar;
    return out;
  }

  // Helper wait function
  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
  }
}

module.exports = Screen;
