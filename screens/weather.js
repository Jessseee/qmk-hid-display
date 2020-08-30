// weather page
// logic from https://github.com/BlankSourceCode/qmk-hid-display
'use strict';

const { LoopingScreen } = require('./screen.js');
const request = require('request');

class WeatherScreen extends LoopingScreen {
  init() {
    super.init();
    this.name = 'Weather';

    this.description = '';
    this.temp = '';
    this.high = '';
    this.rain = '';
  }

  getWeather() {
    // Regex's for reading out the weather info from the yahoo page
    const tempRegex = /"temperature":({[^}]+})/;
    const condRegex = /"conditionDescription":"([^"]+)"/;
    const rainRegex = /"precipitationProbability":([^,]+),/;
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

  updateScreen() {
    this.screen = [
      this.screenScroll(this.description),
      'temp: ' + this.temp,
      'high: ' + this.high,
      'rain: ' + this.rain
    ]
    super.updateScreen();
  }

  update() {
    // Get the current weather for Seattle
    this.getWeather().then((weather) => {
      if (weather && weather.temp && weather.desc && weather.rain) {
        // update info
        this.description = weather.desc;
        this.temp = weather.temp.now + '\u0009';
        this.high = weather.temp.high + '\u0009';
        this.rain = weather.rain + '%';

        // Create the new screen
        this.updateScreen();
      }
    });
  }
}

module.exports = WeatherScreen;

