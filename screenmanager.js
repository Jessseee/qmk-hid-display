'use strict';

const LogoScreen = require('./screens/logo.js');
const SpotifyScreen = require('./screens/spotify.js');
const PerfScreen = require('./screens/perf.js');
const StocksScreen = require('./screens/stocks.js');
const WeatherScreen = require('./screens/weather.js');

const screenClasses = [
  LogoScreen,
  PerfScreen,
  StocksScreen,
  WeatherScreen,
  SpotifyScreen
];

class ScreenManager {
  constructor(screenArgs, updateTrayMenuCallback, updateScreenCallback, displayHeight = 4, displayWidth = 21) {
    this.screenArgs = screenArgs;
    this.updateTrayMenuCallback = updateTrayMenuCallback;
    this.updateScreenCallback = updateScreenCallback;
    this.displayHeight = displayHeight;
    this.displayWidth = displayWidth;

    this.activeScreen = 0;
    this.screens = [];
    for (let i = 0; i < screenClasses.length; i++)
    {
      this.screens[i] = new screenClasses[i](
        ...this.screenArgs,
        ((index) => { return () => { this.handleTrayUpdated(i); }; })(i),
        ((index) => { return () => { this.handleScreenUpdated(i); }; })(i));
    }
    this.numScreens = this.screens.length;
    this.lastContextMenus = [];
  }

  handleTrayUpdated(index) {
    const newContextMenu = this.getContextMenus();
    if (newContextMenu != this.lastContextMenus) {
      this.updateTrayMenuCallback();
    }
  }

  handleScreenUpdated(index) {
    if (index == this.activeScreen) {
      this.updateScreenCallback();
    }
  }

  getContextMenus() {
    let output = [];
    output.push({ label: 'Current: ' + this.getActiveScreen().name });
    for (const screen of this.screens) {
      output.push(...screen.trayMenu);
    }
    return output;
  }

  setActiveScreen(index) {
    const lastActive = this.activeScreen;
    this.activeScreen = Math.min(Math.max(index, 0), this.screens.length);

    if (lastActive == this.activeScreen) {
      return;
    }
    this.screens[lastActive].deactivate();
    this.screens[this.activeScreen].activate();
    this.updateScreenCallback();
    this.updateTrayMenuCallback();
  }

  getActiveScreen() {
    return this.screens[this.activeScreen];
  }

  getActiveOutput() {
    if (this.getActiveScreen()) {
      return this.getActiveScreen().parsedScreen();
    }
    return ' '.repeat(this.displayHeight * this.displayWidth);
  }
}

module.exports = ScreenManager;
