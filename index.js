'use strict';

const hid = require('node-hid');
const nconf = require('nconf');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, Menu, Tray, session } = require('electron');
const ScreenManager = require('./screenmanager.js');

let screenManager = null;
// config
// get a secret or create one. hacky but whatever 
let secret = '';
const secret_file = './secret.txt';
if (fs.existsSync(secret_file)) {
  secret = fs.readFileSync(secret_file);
} else {
  const buf = Buffer.alloc(10);
  secret = crypto.randomFillSync(buf).toString('hex');
  fs.writeFile(secret_file, secret, function() {});
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
    'spotifyClientId': '<spotify client id>',
    'spotifyClientSecret': '<spotify client secret>',
    'weatherLocation': 'Santa Monica, CA',
    'weatherDegreeType': 'F',
    'stocks': 'TSLA,NFLX,AMZN,AAPL'
  });
nconf.load();

// Keyboard info
const KEYBOARD_NAME = nconf.get('keyboardName');
const KEYBOARD_USAGE_ID =  0x61;
const KEYBOARD_USAGE_PAGE = 0xFF60;

let keyboard = null;
let screenBuffer = null;
let screenLastUpdate = null;

// Helper function to wait a few milliseconds using a promise
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

async function sendToKeyboard(screen) {
  // If we are already buffering a screen to the keyboard just quit early.
  // Or if there is no update from what we sent last time.
  if (screenBuffer || screenLastUpdate === screen) {
    return;
  }

  screenLastUpdate = screen;

  // Convert the screen string into raw bytes
  screenBuffer = [];
  for (let i = 0; i < screen.length; i++) {
    screenBuffer.push(screen.charCodeAt(i));
  }

  // Split the bytes into 4 lines that we will send one at a time
  // This is to prevent hitting the 32 length limit on the connection
  const lines = [];
  lines.push([0].concat(screenBuffer.slice(0, 21)));
  lines.push([0].concat(screenBuffer.slice(21, 42)));
  lines.push([0].concat(screenBuffer.slice(42, 63)));
  lines.push([0].concat(screenBuffer.slice(63, 84)));

  // Loop through and send each line after a small delay to allow the
  // keyboard to store it ready to send to the slave side once full.
  let index = 0;
  for (const line of lines) {
    try {
      keyboard.write(line);
      await wait(10);
    } catch {
      keyboard = null;
      initializeConnection();
    }
  }

  // We have sent the screen data, so clear it ready for the next one
  screenBuffer = null;
}

function initializeConnection() {
  // If we don't have a connection to a keyboard yet, look now
  if (screenManager && !keyboard) {
    // Search all devices for a matching keyboard
    const devices = hid.devices();
    for (const d of devices) {
      if (d.product === KEYBOARD_NAME && d.usage === KEYBOARD_USAGE_ID && d.usagePage === KEYBOARD_USAGE_PAGE) {
        // Create a new connection and store it as the keyboard
        keyboard = new hid.HID(d.path);
        console.log(`Keyboard connection established.`);

        // Listen for data from the keyboard which indicates the screen to show
        keyboard.on('data', (e) => {
          // Check that the data is a valid screen index and update the current one
          const requestedScreen = e[0] - 1;
          if (requestedScreen >= 0 && requestedScreen < screenManager.numScreens) {
            screenManager.setActiveScreen(requestedScreen);
            console.log(`Activating screen: ${screenManager.getActiveScreen().name}`);
          }
        });

        // On the initial connection write our special sequence
        // 1st byte - unused and thrown away on windows see bug in node-hid
        // 2nd byte - 1 to indicate a new connection
        // 3rd byte - number of screens the keyboard can scroll through
        keyboard.write([0, 1, screenManager.numScreens]);
        break;
      }
    }
  }
  else {
    setInterval(initializeConnection, 1000);
    return;
  }
}

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
    () => { sendToKeyboard(screenManager.getActiveOutput()); });
  initializeConnection();
}

app.on('window-all-closed', () => {
  // keep running.
  // the tray doesn't count as a window, so
  // this will keep the app running when we only have the tray
})

app.whenReady().then(createTray);
