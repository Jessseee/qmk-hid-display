'use strict';

const { merge } = require('lodash');
const LogoScreen = require('./screens/logo.js');
const SpotifyScreen = require('./screens/spotify.js');
const PerfScreen = require('./screens/perf.js');
const WeatherScreen = require('./screens/weather.js');
const NotificationsScreen = require('./screens/notifications.js');
const NotificationsSingleScreen = require('./screens/notifications_single.js');

const screenClasses = [
  LogoScreen,
  PerfScreen,
  WeatherScreen,
  SpotifyScreen,
  NotificationsScreen,
  NotificationsSingleScreen
];

class ScreenManager {
  constructor() {
    this.activeScreen = 0;
    this.screens = {};
  }

  init(screenArgs, config, updateTrayMenuCallback, updateScreenCallback, displayHeight = 4, displayWidth = 21) {
    this.screenArgs = screenArgs;
    this.config = config;
    this.updateTrayMenuCallback = updateTrayMenuCallback;
    this.updateScreenCallback = updateScreenCallback;
    this.displayHeight = displayHeight;
    this.displayWidth = displayWidth;

    this.screens = {};
    for (let i = 0; i < screenClasses.length; i++) {
      let screen = new screenClasses[i](
        ...this.screenArgs,
        ((index) => { return () => { this.handleTrayUpdated(i); }; })(i),
        ((index) => { return () => { this.handleScreenUpdated(i); }; })(i));
      if (screen.available) {
        this.screens[screen.name] = screen;
      }
    }

    this.numScreens = Object.values(this.screens).length;
    this.lastContextMenus = [];
  }

  handleTrayUpdated(index) {
    const newContextMenu = this.getContextMenus();
    if (newContextMenu !== this.lastContextMenus) {
      this.updateTrayMenuCallback();
    }
  }

  handleScreenUpdated(index) {
    if (index === this.activeScreen) {
      this.updateScreenCallback();
    }
  }

  getContextMenus() {
    let output = [];
    if (this.getActiveScreen()) {
      output.push({ label: 'Current: ' + this.getActiveScreen().name });
    }
    for (const screen of Object.values(this.screens)) {
      output.push(...screen.trayMenu);
    }
    return output;
  }

  setActiveScreen(index) {
    const lastActive = this.activeScreen;
    this.activeScreen = Math.min(Math.max(index, 0), Object.values(this.screens).length);

    if (lastActive == this.activeScreen) {
      return;
    }
    Object.values(this.screens)[lastActive].deactivate();
    Object.values(this.screens)[this.activeScreen].activate();
    this.updateScreenCallback();
    this.updateTrayMenuCallback();
  }

  getActiveScreen() {
    return Object.values(this.screens)[this.activeScreen];
  }

  getActiveOutput() {
    if (this.getActiveScreen()) {
      return this.getActiveScreen().parsedScreen();
    }
    return ' '.repeat(this.displayHeight * this.displayWidth);
  }

  initScreens() {
    Object.values(this.screens).map(screen => screen.init());
  }
}

module.exports = ScreenManager;
