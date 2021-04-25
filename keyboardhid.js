'use strict';

// From https://github.com/BlankSourceCode/qmk-hid-display
const hid = require('node-hid');

let keyboardName = '';
let keyboardId = 0;
let keyboardPage = 0;

let keyboard = null;
let screenBuffer = null;
let screenLastUpdate = null;
let screenManager = null;

// Helper function to wait a few milliseconds using a promise
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

function init(inKeyboardName, inKeyboardId, inKeyboardPage, inScreenManager) {
  keyboardName = inKeyboardName;
  keyboardId = inKeyboardId;
  keyboardPage = inKeyboardPage;
  screenManager = inScreenManager;

  // keyboard will be set in initConnection()
  keyboard = null;
}

let lastUnsent = null;
async function sendToKeyboard(screen) {
  // If we are buffering a screen, note the last unsent message, and queue an
  // update in 1s.
  if (screenBuffer && screen) {
    lastUnsent = screen;
    setInterval(() => { sendToKeyboard() }, 1000);
    return;
  }

  // If we are not buffering a screen, check if screen is null. If the screen
  // is null, and we have an unsent message, then push that
  if (!screen && lastUnsent) {
    screen = lastUnsent;
  }

  // If we made it this far, the screen wasn't buffering when we sent the
  // message, or we are displaying the last unsent one. Clear the last unsent.
  lastUnsent = null;

  // If there is no update from what we sent last time, then exit early.
  // or if we are a queued message that was superceded by a later message
  if (screenLastUpdate === screen || !screen) {
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
      initConnection();
    }
  }

  // We have sent the screen data, so clear it ready for the next one
  screenBuffer = null;
}

let timeout;
function initConnection() {
  // If we don't have a connection to a keyboard yet, look now
  if (screenManager && !keyboard) {
    // Search all devices for a matching keyboard
    const devices = hid.devices();
    for (const d of devices) {
      if (d.product === keyboardName && d.usage === keyboardId && d.usagePage === keyboardPage) {
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
  else if (!timeout) {
    console.log('Could not connect to keyboard. Retrying...');
    timeout = setInterval(() => {
      initConnection();
      timeout = null; },
      1000);
    return;
  }
}

module.exports = {
  sendToKeyboard: sendToKeyboard,
  initConnection: initConnection,
  init: init
};
