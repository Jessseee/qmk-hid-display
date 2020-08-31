'use strict';

const { LoopingScreen } = require('./screen.js');
const weather = require('weather-js');

class WeatherScreen extends LoopingScreen {
  init() {
    super.init();
    this.name = 'Weather';

    this.description = '';
    this.temp = '';
    this.high = '';
    this.rain = '';

    this.location = this.nconf.get('weatherLocation');
    this.degreeType = this.nconf.get('weatherDegreeType');
  }

  updateScreen() {
    this.screen = [
      this.screenScroll(this.description),
      'temp: ' + this.temp + '\u0009',
      'high: ' + this.high + '\u0009',
      'rain: ' + this.rain + '%'
    ]
    super.updateScreen();
  }

  update() {
    weather.find({search: this.location, degreeType: this.degreeType},
      (err, result) => {
        if (err) {
          this.log('Error: ' + err);
          return;
        }
        this.description = result[0].current.skytext;
        this.temp = result[0].current.temperature;
        // forecast[1] is today
        this.high = result[0].forecast[1].high;
        this.rain = result[0].forecast[1].precip;
      }
    );
    this.requestUpdateScreen();
  }
}

module.exports = WeatherScreen;

