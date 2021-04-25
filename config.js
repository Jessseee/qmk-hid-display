// config window.
// used https://github.com/pbarbiero/basic-electron-react-boilerplate
// as a starting off point
'use strict';

const Store = require('electron-store');
const { app, BrowserWindow, ipcMain } = require('electron');
const ScreenManager = require('./screenmanager.js');
const { merge } = require('lodash');
const url = require('url');
const path = require('path');

class ConfigPage {
  constructor(storePrefix, groups, parentConfig) {
    this.prefix = storePrefix;
    this.originalGroups = [
      ...(parentConfig ? parentConfig.originalGroups : []),
      ...(groups ? groups : [])];
    // Prefixed
    this.groups = this.originalGroups;
    for (let group of this.groups) {
      let prefixedParams = {};
      for (const [key, value] of Object.entries(group.params)) {
        prefixedParams[this.prefix + key] = value;
      }
      group.params = prefixedParams;
    }
  }

  getDefaults() {
    return Object.fromEntries(
      Object.entries(this.groups.map(group => group.params)
        .reduce((accum, params) => merge(accum, params), {}))
      .filter(([key, param]) => param.default != null)
      .map(([key, param]) => [key, param.default]));
  }
}

let dev = false;
if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath)) {
  dev = true;
}

class Config {
  constructor() {
    this.screenManager = null;
    this.keyboardConfigPage = new ConfigPage('keyboard-', [
      { params: {
        name: { label: 'Name', default: 'SPIN' },
        id: { label: 'ID', default: '0x61' },
        page: { label: 'Page', default: '0xFF60' }
      }}]);
  }

  init(screenManager) {
    this.screenManager = screenManager;
    this.store = new Store({defaults: this.getStoreSchema()});

    ipcMain.handle('get-config', async (event, field) => {
      return this.store.get(field);
    });

    ipcMain.on('set-config', (event, data) => {
      this.store.set(data.key, data.value)
    });

    ipcMain.handle('get-pages', async (event) => {
      return this.getPages();
    });

    ipcMain.handle('get-page-groups', async (event, page) => {
      return this.getGroupsForPage(page);
    });
  }

  getConfigPages() {
    return [this.keyboardConfigPage,
      ...Object.values(this.screenManager.screens).map(
        screen => screen.configPage)];
  }

  getStoreSchema() {
    return merge({}, ...Object.values(this.getConfigPages()).map(
      configPage => configPage.getDefaults()));
  }

  getPages() {
    return [
      'Keyboard',
      ...Object.values(this.screenManager.screens)
      .filter(screen => screen.configPage.groups.length > 0)
      .map(screen => screen.name)];
  }

  getGroupsForPage(page) {
    if (page == 'Keyboard') {
      return this.keyboardConfigPage.groups;
    } else if (page in this.screenManager.screens) {
      return this.screenManager.screens[page].configPage.groups;
    }
    return [];
  }

  createWindow() {
    // Create the browser window.
    this.configWindow = new BrowserWindow({
      width: 1024, height: 768, show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // and load the index.html of the app.
    let indexPath;
    if (dev && process.argv.indexOf('--noDevServer') === -1) {
      indexPath = url.format({
        protocol: 'http:',
        host: 'localhost:8080',
        pathname: 'index.html',
        slashes: true
      });
    } else {
      indexPath = url.format({
        protocol: 'file:',
        pathname: path.join(__dirname, 'dist', 'index.html'),
        slashes: true
      });
    }
    this.configWindow.loadURL(indexPath);

    // Don't show until we are ready and loaded
    this.configWindow.once('ready-to-show', () => {
      if (dev) {
        // Open the window and DevTools automatically if developing
        this.configWindow.show();
        this.configWindow.webContents.openDevTools();
      }
    });

    // Emitted when the window is closed.
    this.configWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      this.configWindow = null;
    });
  }
}

module.exports = {
  Config: Config,
  ConfigPage: ConfigPage
};
