'use strict';

const hid = require('node-hid');
const nconf = require('nconf');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, Menu, Tray, session } = require('electron');

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
    'spotifyClientSecret': '<spotify client secret>'
  });
nconf.load();

// Keyboard info
const KEYBOARD_NAME = nconf.get('keyboardName');
const KEYBOARD_USAGE_ID =  0x61;
const KEYBOARD_USAGE_PAGE = 0xFF60;
const KEYBOARD_UPDATE_TIME = 1000;

// Info screen types
const SCREEN_PERF = 0;
const SCREEN_STOCK = 1;
const SCREEN_WEATHER = 2;
const SCREEN_SPOTIFY = 3;
const screens = ['', '', '', ''];
let currentScreenIndex = 0;

let keyboard = null;
let screenBuffer = null;
let screenLastUpdate = null;

// Helper function to wait a few milliseconds using a promise
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

function title(i, titleIndex) {
  // Return the character that indicates the title part from the font data
  if (i === 3) {
    return '\u00DE';
  }
  return String.fromCharCode((0x9A - titleIndex) + i * 32);
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
    keyboard.write(line);
    await wait(10);
  }

  // We have sent the screen data, so clear it ready for the next one
  screenBuffer = null;
}

function updateKeyboardScreen() {
  // If we don't have a connection to a keyboard yet, look now
  if (!keyboard) {
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
          if (e[0] >= 1 && e[0] <= screens.length) {
            currentScreenIndex = e[0] - 1;
            console.log(`Keyboard requested screen index: ${currentScreenIndex}`);
          }
        });

        // On the initial connection write our special sequence
        // 1st byte - unused and thrown away on windows see bug in node-hid
        // 2nd byte - 1 to indicate a new connection
        // 3rd byte - number of screens the keyboard can scroll through
        keyboard.write([0, 1, screens.length]);
        break;
      }
    }
  }

  // If we have a connection to a keyboard and a valid screen
  if (keyboard && screens[currentScreenIndex].length === 84) {
    // Send that data to the keyboard
    sendToKeyboard(screens[currentScreenIndex]);
  }
  else if (keyboard)
  {
    console.log('incomplete screen: ' + currentScreenIndex + ' size: ' + screens[currentScreenIndex].length)
  }
}

const SpotifyScreen = require('./screens/spotify.js');
const PerfScreen = require('./screens/perf.js');
const StocksScreen = require('./screens/stocks.js');
const WeatherScreen = require('./screens/weather.js');
let tray = null;
let spotifyScreen = null;
let perfScreen = null;
let stocksScreen = null;
let weatherScreen = null;

function updateContextMenu() {
  if (!app.isReady()) {
    return;
  }
  let contextTemplate = [];
  if (spotifyScreen) {
    contextTemplate.push(...spotifyScreen.trayMenu);
  }
  contextTemplate.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(contextTemplate));
}

function createTray () {
  tray = new Tray('./icon16.png')
  tray.setToolTip('QMK HID Display');
  updateContextMenu();
  weatherScreen = new WeatherScreen(tray, nconf, session, updateContextMenu,
    () => { if (weatherScreen) screens[SCREEN_WEATHER] = weatherScreen.parsedScreen() });
  stocksScreen = new StocksScreen(tray, nconf, session, updateContextMenu,
    () => { if (stocksScreen) screens[SCREEN_STOCK] = stocksScreen.parsedScreen() });
  perfScreen = new PerfScreen(tray, nconf, session, updateContextMenu,
    () => { if (perfScreen) screens[SCREEN_PERF] = perfScreen.parsedScreen() });
  spotifyScreen = new SpotifyScreen(tray, nconf, session, updateContextMenu,
    () => { if (spotifyScreen) screens[SCREEN_SPOTIFY] = spotifyScreen.parsedScreen() });
}

app.on('window-all-closed', () => {
  // keep running.
  // the tray doesn't count as a window, so
  // this will keep the app running when we only have the tray
})

app.whenReady().then(createTray)

// Update the data on the keyboard with the current info screen every second
setInterval(updateKeyboardScreen, KEYBOARD_UPDATE_TIME);
