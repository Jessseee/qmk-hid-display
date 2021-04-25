// base screen class
'use strict';

const { isEqual, merge } = require('lodash');
const { ConfigPage } = require('../config.js');

class Screen {
  constructor(tray, config, session, updateTrayMenuCallback, updateScreenCallback, displayHeight = 4, displayWidth = 21) {
    this.name = 'Screen';
    this.storePrefix = 'screens-screen-';
    this.tray = tray;
    this.config = config;
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

    this.configPage = new ConfigPage(this.storePrefix); 

    // Default screen to name
    if (this.screen.length == 0) {
      this.screen = [this.name];
    }

    this.available = true;
  }

  init() {
    // Init is called after other dependent classes, like config,
    // have been init()d themselves.
    // probably turn this into some callback
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
    if (this.screen.length < 4) {
      for (let i = this.screen.length; i < 4; i++) {
        this.screen.push('');
      }
    }
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

  // electron-store wrapping
  getStoreKey(localKey) {
    return this.storePrefix + localKey;
  }

  getStore(localKey) {
    return this.config.store.get(this.getStoreKey(localKey));
  }

  setStore(localKey, value) {
    return this.config.store.set(this.getStoreKey(localKey), value);
  }

  onStoreChanged(localKey, callback) {
    return this.config.store.onDidChange(this.getStoreKey(localKey), callback);
  }

  // helpers
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

  screenSplit(str, numLines = -1) {
    let out = [];
    let width = this.displayWidth;

    // split words, then add words into max width length strings.
    let words = str.split(' ');
    let currentLine = '';
    for (let word of words) {
      if (currentLine.length + word.length > width) {
        out.push(currentLine);
        currentLine = word;
      } else {
        if (currentLine.length > 0) {
          currentLine += ' ';
        }
        currentLine += word;
      }
    }
    out.push(currentLine);

    // If number of lines were specified, turn last one into a scroll
    if (numLines > 0) {
      let scrolledLastLine = this.screenScroll(
        out.slice(numLines - 1).join(' '));
      out = out.slice(0, numLines - 1);
      out.push(scrolledLastLine);
    }
    return out;
  }

  // Helper wait function
  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
  }
}

class LoopingScreen extends Screen {
  constructor(...args) {
    super(...args);
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

module.exports = {
  Screen: Screen,
  LoopingScreen: LoopingScreen,
};
