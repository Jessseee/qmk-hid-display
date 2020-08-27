'use strict';

const hid = require('node-hid');
const nconf = require('nconf');
const request = require('request');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, Menu, Tray, session } = require('electron')

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


async function startWeatherMonitor() {
  // Regex's for reading out the weather info from the yahoo page
  const tempRegex = /"temperature":({[^}]+})/;
  const condRegex = /"conditionDescription":"([^"]+)"/;
  const rainRegex = /"precipitationProbability":([^,]+),/;

  function getWeather() {
    return new Promise((resolve) => {
      request(`https://www.yahoo.com/news/weather/united-states/seattle/seattle-2490383`, (err, res, body) => {
        const weather = {};
        const temp = tempRegex.exec(body);
        if (temp && temp.length > 1) {
          weather.temp = JSON.parse(temp[1]);
        }

        const cond = condRegex.exec(body);
        if (cond && cond.length > 1) {
          weather.desc = cond[1];
        }

        const rain = rainRegex.exec(body);
        if (rain && rain.length > 1) {
          weather.rain = rain[1];
        }
        resolve(weather);
      });
    });
  }

  // Used for scrolling long weather descriptions
  let lastWeather = null;
  let lastWeatherDescIndex = 0;

  // Just keep updating the data forever
  while (true) {
    // Get the current weather for Seattle
    const weather = await getWeather();
    if (weather && weather.temp && weather.desc && weather.rain) {
      let description = weather.desc;

      // If we are trying to show the same weather description more than once, and it is longer than 9
      // Which is all that will fit in our space, lets scroll it.
      if (lastWeather && weather.desc == lastWeather.desc && weather.desc.length > 9) {
        // Move the string one character over
        lastWeatherDescIndex++;
        description = description.slice(lastWeatherDescIndex, lastWeatherDescIndex + 9);
        if (lastWeatherDescIndex > weather.desc.length - 9) {
          // Restart back at the beginning
          lastWeatherDescIndex = -1; // minus one since we increment before we show
        }
      } else {
        lastWeatherDescIndex = 0;
      }
      lastWeather = weather;

      // Create the new screen
      const screen =
        `desc: ${description}${' '.repeat(Math.max(0, 9 - ('' + description).length))} |  ${title(0, 2)} ` +
        `temp: ${weather.temp.now}${' '.repeat(Math.max(0, 9 - ('' + weather.temp.now).length))} |  ${title(1, 2)} ` +
        `high: ${weather.temp.high}${' '.repeat(Math.max(0, 9 - ('' + weather.temp.high).length))} |  ${title(2, 2)} ` +
        `rain: ${weather.rain}%${' '.repeat(Math.max(0, 8 - ('' + weather.rain).length))} |  ${title(3, 2)} `;

      // Set this to be the latest weather info
      screens[SCREEN_WEATHER] = screen;
    }

    // Pause a bit before requesting more info
    await wait(KEYBOARD_UPDATE_TIME);
  }
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

// Start the monitors that collect the info to display
startWeatherMonitor();

// spotify stuff
let tray = null;
let spotifyPage = null;
let perfPage = null;
let stocksPage = null;

async function updateSpotifyScreen() {
  while (true) {
    let parsedScreen = '';
    if (spotifyPage) {
      for (const rawLine of spotifyPage.screen) {
        let line = rawLine;
        if (line.length < 21) {
          line = line + ' '.repeat(21 - line.length);
        } else {
          line = line.substr(0, 21);
        }
        parsedScreen += line;
      }
    }
    if (parsedScreen.length < 84) {
      parsedScreen += ' '.repeat(84 - parsedScreen);
    }
    screens[SCREEN_SPOTIFY] = parsedScreen;
    await wait(KEYBOARD_UPDATE_TIME);
  }
}
updateSpotifyScreen();

function updateContextMenu() {
  if (!app.isReady()) {
    return;
  }
  let contextTemplate = [];
  if (spotifyPage) {
    contextTemplate.push(...spotifyPage.trayMenu);
  }
  contextTemplate.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(contextTemplate));
}

const SpotifyScreen = require('./screens/spotify.js');
const PerfScreen = require('./screens/perf.js');
const StocksScreen = require('./screens/stocks.js');
function createTray () {
  tray = new Tray('./icon16.png')
  tray.setToolTip('QMK HID Display');
  updateContextMenu();
  stocksPage = new StocksScreen(tray, nconf, session, updateContextMenu,
    () => { if (stocksPage) screens[SCREEN_STOCK] = stocksPage.parsedScreen() });
  perfPage = new PerfScreen(tray, nconf, session, updateContextMenu,
    () => { if (perfPage) screens[SCREEN_PERF] = perfPage.parsedScreen() });
  spotifyPage = new SpotifyScreen(tray, nconf, session, updateContextMenu,
    () => { if (spotifyPage) screens[SCREEN_SPOTIFY] = spotifyPage.parsedScreen() });
}

app.on('window-all-closed', () => {
  // keep running.
  // the tray doesn't count as a window, so
  // this will keep the app running when we only have the tray
})

app.whenReady().then(createTray)

// Update the data on the keyboard with the current info screen every second
setInterval(updateKeyboardScreen, KEYBOARD_UPDATE_TIME);
