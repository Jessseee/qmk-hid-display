'use strict';

const { LoopingScreen } = require('./screen.js');
const weather = require('weather-js');
const { ConfigPage } = require('../config.js');

class WeatherScreen extends LoopingScreen {
  constructor(...args) {
    super(...args);
    this.name = 'Weather';
    this.storePrefix = 'screens-weather-';

    this.description = '';
    this.temp = '';
    this.high = '';
    this.rain = '';

    this.configPage = new ConfigPage(this.storePrefix, [
      { params: {
        location: { label: 'Location', default: 'Santa Monica, CA' },
        temperatureUnits: { label: 'Temperature Units', default: 'F' }
      }}], this.configPage);
  }

  init() {
    super.init();
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
    weather.find({search: this.getStore('location'),
      degreeType: this.getStore('temperatureUnits')},
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

