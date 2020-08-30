// perfmon page
// logic from https://github.com/BlankSourceCode/qmk-hid-display
'use strict';

const Screen = require('./screen.js');
const perfmon = require('perfmon');

class PerfScreen extends Screen {
  init() {
    super.init();
    this.startPerfMonitor();

    this.cpu = 0;
    this.mem = 0;
    this.dsk = 0;
  }

  startPerfMonitor() {
    // Set the perf counter that we need for the performance screen
    const counters = new Map();
    counters.set('cpu', '\\Processor(_Total)\\% Processor Time');
    counters.set('mem', '\\Memory\\% Committed Bytes In Use');
    counters.set('dsk', '\\PhysicalDisk(_Total)\\% Disk Time');

    function getStat(name, data) {
      const value = data.counters[counters.get(name)] / 100.0;
      return Math.min(1.0, Math.max(0.0, value));
    }

    perfmon([...counters.values()], (err, data) => {
      if (!data || Object.getOwnPropertyNames(data.counters).length < counters.size) {
        // Sometimes perfmon doesn't get all the counters working, no idea why.
        // Let's just restart to try it again
        console.log('Could not find all perf counters, restarting perfmon...');
        perfmon.stop();
        perfmon.start();
        return;
      }

      // Get the value for each stat
      this.cpu = getStat('cpu', data);
      this.mem = getStat('mem', data);
      this.dsk = getStat('dsk', data);;

      this.updateScreen();
    });
  }

  updateScreen() {
    this.screen = [
      this.screenBar(this.cpu, 'cpu'),
      this.screenBar(this.mem, 'mem'),
      this.screenBar(this.dsk, 'dsk')];
    super.updateScreen();
  }
}

module.exports = PerfScreen;
