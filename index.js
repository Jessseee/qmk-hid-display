'use strict';

const nconf = require('nconf');
const fs = require('fs');
const crypto = require('crypto');
const { app, Menu, Tray, session } = require('electron');
const ScreenManager = require('./screenmanager.js');
const keyboardHid = require('./keyboardhid.js');

// config
// get a secret or create one. hacky but whatever 
let secret = '';
const secret_file = './secret.txt';
if (fs.existsSync(secret_file)) {
  secret = fs.readFileSync(secret_file);
} else {
  const buf = Buffer.alloc(10);
  secret = crypto.randomFillSync(buf).toString('hex');
  fs.writeFile(secret_file, secret, () => {});
}

// read conf, encrypt user data
nconf.argv()
  .file('user', {
    file: './user.json',
    secure: {
      secret: secret,
      alg: 'aes-256-ctr'
    }
  })
  .file('./config.json')
  .defaults({
    'keyboardName': 'SPIN',
    'keyboardId': '0x61',
    'keyboardPage': '0xFF60',
    'spotifyClientId': '<spotify client id>',
    'spotifyClientSecret': '<spotify client secret>',
    'weatherLocation': 'Santa Monica, CA',
    'weatherDegreeType': 'F',
    'stocks': 'TSLA,NFLX,AMZN,AAPL',
    'coinmarketcapApiKey': '<coinmarketcap API key>',
    'cryptocurrencies': 'BTC,ETH,ADA',
  });
nconf.load();

let screenManager = null;
let tray = null;

function updateContextMenu() {
  if (!app.isReady()) {
    return;
  }
  let contextTemplate = [];
  if (screenManager) {
    contextTemplate.push(...screenManager.getContextMenus());
  }
  contextTemplate.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(contextTemplate));
}

function createTray () {
  tray = new Tray('./icon16.png');
  tray.setToolTip('QMK HID Display');
  updateContextMenu();
  screenManager = new ScreenManager([tray, nconf, session],
    updateContextMenu,
    () => { keyboardHid.sendToKeyboard(screenManager.getActiveOutput()); });
  keyboardHid.init(nconf.get('keyboardName'),
    parseInt(nconf.get('keyboardId')),
    parseInt(nconf.get('keyboardPage')),
    screenManager);
  keyboardHid.initConnection();
}

app.on('window-all-closed', () => {
  // keep running.
  // the tray doesn't count as a window, so
  // this will keep the app running when we only have the tray
})

app.whenReady().then(createTray);
