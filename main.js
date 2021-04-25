'use strict';

const { app, Menu, Tray, session } = require('electron');
const ScreenManager = require('./screenmanager.js');
const keyboardHid = require('./keyboardhid.js');
const { Config } = require('./config.js');

let screenManager = new ScreenManager();;
let tray = null;
let config = new Config();

function updateContextMenu() {
  if (!app.isReady()) {
    return;
  }
  let contextTemplate = [];
  if (screenManager) {
    contextTemplate.push(...screenManager.getContextMenus());
  }
  contextTemplate.push({ label: 'Configuration',
    click: () => { config.createWindow(); } });
  contextTemplate.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(contextTemplate));
}

function createTray () {
  tray = new Tray('./icon16.png');
  tray.setToolTip('QMK HID Display');
  updateContextMenu();
  // todo: make this init flow simpler
  screenManager.init([tray, config, session],
    config,
    updateContextMenu,
    () => { keyboardHid.sendToKeyboard(screenManager.getActiveOutput()); });
  config.init(screenManager);
  screenManager.initScreens();
  initKeyboardHid();

  config.store.onDidChange('keyboard-name', initKeyboardHid);
  config.store.onDidChange('keyboard-id', initKeyboardHid);
  config.store.onDidChange('keyboard-page', initKeyboardHid);
}

function initKeyboardHid() {
  keyboardHid.init(config.store.get('keyboard-name'),
    parseInt(config.store.get('keyboard-id')),
    parseInt(config.store.get('keyboard-page')),
    screenManager);
  keyboardHid.initConnection();
}

app.on('window-all-closed', () => {
  // keep running.
  // the tray doesn't count as a window, so
  // this will keep the app running when we only have the tray
})

app.whenReady().then(createTray);
