// base screen class
'use strict';

const { isEqual } = require('lodash');

class Screen {
  constructor(tray, nconf, session, updateTrayMenuCallback, updateScreenCallback, displayHeight = 4, displayWidth = 21) {
    this.name = 'Screen';
    this.tray = tray;
    this.nconf = nconf;
    this.session = session;
    this.updateTrayMenuCallback = updateTrayMenuCallback;
    this.updateScreenCallback = updateScreenCallback;
    this.active = false;

    this.displayHeight = displayHeight;
    this.displayWidth = displayWidth;

    this.screen = [];
    this.trayMenu = [];

    this.lastScreen = [];
    this.lastTrayMenu = [];

    this.init();
    // Default screen to name
    if (this.screen.length == 0) {
      this.screen = [this.name];
    }
  }

  init() {
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }

  updateTrayMenu() {
    if (!isEqual(this.trayMenu, this.lastTrayMenu)) {
      this.lastTrayMenu = this.trayMenu;
      this.updateTrayMenuCallback();
    }
  }

  requestUpdateScreen() {
    if (this.active) {
      this.updateScreen();
    }
  }

  updateScreen() {
    if (!isEqual(this.screen, this.lastScreen)) {
      this.lastScreen = this.screen;
      this.updateScreenCallback();
    }
  }

  parsedScreen() {
    let parsedScreen = '';
    let clampPad = (str, size) => {
      if (str.length < size) {
        return str + ' '.repeat(size - str.length);
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

  log(output) {
    console.log(`[${this.name}|${new Date().toLocaleString()}] ${output}`);
  }

  screenBar(progress, label = '', showNum = false, endPoints = true) {
    let out = label;
    let actualBarSize = this.displayWidth - label.length;
    if (showNum) {
      actualBarSize -= 2;
    }
    if (endPoints) {
      actualBarSize -= 2;
    }

    const progressQuantized = Math.floor(actualBarSize * progress);
    const progressRemainder = progress * actualBarSize - progressQuantized;
    // 6 different characters to show sub-char progress
    const progressRemainderQuantized = Math.floor(progressRemainder * 6);
    let progressBar = '\u009b'.repeat(progressQuantized) + String.fromCharCode(149 + progressRemainderQuantized);
    progressBar += ' '.repeat(actualBarSize - Math.min(progressBar.length, actualBarSize));
    if (endPoints) {
      progressBar = '\u009c' + progressBar + '\u009d';
    }
    if (showNum) {
      let tens = Math.floor(progress * 10);
      let ones = Math.floor(progress * 100) % 10;
      if (tens == 0) {
        tens = ' ';
      }
      progressBar += tens;
      progressBar += ones;
    }
    out += progressBar;
    return out;
  }

  screenScroll(str, speed = 1000, label = '', displayWidth = -1) {
    const ms = Date.now();
    if (displayWidth < 0) {
      displayWidth = this.displayWidth;
    }
    const scrollSpace = displayWidth - label.length;
    if (scrollSpace < 1 || str.length + label.length < scrollSpace) {
      // cannot scroll
      return label + str;
    }
    // pause on ends
    const endPauseTicks = 3;
    const scrollMod = str.length - scrollSpace;
    let offset = Math.floor(ms/1000) % (scrollMod + 2 * endPauseTicks);
    offset = Math.min(Math.max(offset - endPauseTicks, 0), scrollMod);
    return label + str.substr(offset, scrollSpace);
  }

  // Helper wait function
  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
  }
}

class LoopingScreen extends Screen {
  init() {
    super.init();
    this.activeLoop = null;
    this.loopDelay = 1000;
  }

  activate() {
    // If we have a running loop, then wait for it to finish and then start
    // a new one
    if (this.activeLoop && !this.active) {
      this.activeLoop.then(() => {
        super.activate();
        this.activeLoop = this.loop();
      });
    } else {
      super.activate();
      this.runningMonitor = this.loop();
    }
  }

  update() {
    this.requestUpdateScreen();
  }

  async loop() {
    while (true) {
      if (!this.active) {
        break;
      }
      this.update();
      await this.wait(this.loopDelay);
    }
  }
}

module.exports = {Screen: Screen, LoopingScreen: LoopingScreen};
