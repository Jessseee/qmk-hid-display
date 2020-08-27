// weather page
// logic from https://github.com/BlankSourceCode/qmk-hid-display
'use strict';

const Screen = require('./screen.js');
const request = require('request');

class WeatherScreen extends Screen {
  init() {
    super.init();
    this.startWeatherMonitor();
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

  async startWeatherMonitor() {
    // Used for scrolling long weather descriptions
    let lastWeather = null;
    let lastWeatherDescIndex = 0;

    // Just keep updating the data forever
    while (true) {
      // Get the current weather for Seattle
      const weather = await this.getWeather();
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
        this.screen = [
          'desc: ' + description,
          'temp: ' + weather.temp.now,
          'high: ' + weather.temp.high,
          'rain: ' + weather.rain
        ]
        this.updateScreenCallback()
      }

      // Pause a bit before requesting more info
      await this.wait(1000);
    }
  }
}

module.exports = WeatherScreen;

