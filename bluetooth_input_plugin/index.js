'use strict';

const childProcess = require('child_process');
let libQ;

try {
  libQ = require('kew');
} catch (error) {
  try {
    libQ = require('/volumio/node_modules/kew');
  } catch (fallbackError) {
    libQ = {
      resolve: (value) => Promise.resolve(value),
      reject: (error) => Promise.reject(error)
    };
  }
}

module.exports = BluetoothInput;

if (typeof Promise.prototype.fail !== 'function') {
  Promise.prototype.fail = Promise.prototype.catch;
}

const SERVICE_NAME = 'bluetooth_input';
const SOURCE_NAME = 'Bluetooth Input';
const SOURCE_URI = 'bluetooth_input';
const HELPER = 'sudo -n /usr/local/bin/volumio-bluetooth-input';

function BluetoothInput(context) {
  this.context = context;
  this.commandRouter = context.coreCommand;
  this.logger = context.logger || this.commandRouter.logger || console;
  this.runCommand = context.runCommand || runCommand;
  this.state = {
    status: 'stop',
    service: SERVICE_NAME,
    title: SOURCE_NAME,
    artist: '',
    album: '',
    albumart: '/albumart?sourceicon=music_service/bluetooth_input/icon.png',
    uri: SOURCE_URI,
    trackType: 'bluetooth',
    seek: 0,
    duration: 0,
    samplerate: '',
    bitdepth: '',
    channels: 2,
    disableUiControls: true,
    volatile: true
  };
}

BluetoothInput.prototype.onVolumioStart = function () {
  return libQ.resolve();
};

BluetoothInput.prototype.onStart = function () {
  const self = this;
  return libQ.resolve().then(function () {
    return self.addToBrowseSources();
  });
};

BluetoothInput.prototype.onStop = function () {
  const self = this;
  return libQ.resolve()
    .then(function () {
      return self.commandRouter.volumioRemoveToBrowseSources(SOURCE_NAME);
    })
    .then(function () {
      return self.stopBridge();
    });
};

BluetoothInput.prototype.onRestart = function () {
  return this.onStop().then(this.onStart.bind(this));
};

BluetoothInput.prototype.addToBrowseSources = function () {
  return this.commandRouter.volumioAddToBrowseSources({
    albumart: '/albumart?sourceicon=music_service/bluetooth_input/icon.png',
    icon: 'fa fa-bluetooth',
    name: SOURCE_NAME,
    uri: SOURCE_URI,
    plugin_type: 'music_service',
    plugin_name: SERVICE_NAME,
    static: false
  });
};

BluetoothInput.prototype.handleBrowseUri = function () {
  const self = this;
  return libQ.resolve()
    .then(function () {
      if (typeof self.commandRouter.volumioStop === 'function') {
        return self.commandRouter.volumioStop();
      }
    })
    .then(function () {
      self.prepareVolatilePlayback();
    })
    .then(function () {
      return self.startBridge();
    })
    .then(function () {
      return self.pushState('play');
    })
    .then(function () {
      return self.browseResponse();
    });
};

BluetoothInput.prototype.prepareVolatilePlayback = function () {
  if (!this.commandRouter.stateMachine) {
    return;
  }

  this.commandRouter.stateMachine.setConsumeUpdateService(undefined);
  this.commandRouter.stateMachine.setVolatile({
    service: SERVICE_NAME,
    callback: this.stopBridge.bind(this)
  });
};

BluetoothInput.prototype.startBridge = function () {
  this.logger.info('Starting Bluetooth input bridge');
  return this.runCommand(HELPER + ' start');
};

BluetoothInput.prototype.stopBridge = function () {
  this.logger.info('Stopping Bluetooth input bridge');
  return this.runCommand(HELPER + ' stop')
    .then(() => this.pushState('stop'));
};

BluetoothInput.prototype.pushState = function (status) {
  const state = Object.assign({}, this.state, { status: status });
  return this.commandRouter.servicePushState(state, SERVICE_NAME);
};

BluetoothInput.prototype.browseResponse = function () {
  return this.status().then((result) => {
    const details = String(result.stdout || '').trim();
    return {
    navigation: {
      prev: { uri: '/' },
      lists: [{
        availableListViews: ['list'],
        items: [{
          service: SERVICE_NAME,
          type: 'song',
          title: 'Bluetooth Input is active',
          artist: details || 'Pair or connect to "volumio", then play audio from your device.',
          album: 'A2DP via BlueALSA | Connection status available here',
          albumart: '/albumart?sourceicon=music_service/bluetooth_input/icon.png',
          uri: SOURCE_URI
        }]
      }]
    }
    };
  });
};

BluetoothInput.prototype.status = function () {
  return this.runCommand(HELPER + ' status');
};

BluetoothInput.prototype.clearAddPlayTrack = function () {
  return this.handleBrowseUri(SOURCE_URI);
};

BluetoothInput.prototype.stop = function () {
  return this.stopBridge();
};

BluetoothInput.prototype.pause = function () {
  return this.stopBridge();
};

BluetoothInput.prototype.getState = function () {
  return this.state;
};

BluetoothInput.prototype.getUIConfig = function () {
  return {
    page: { label: SOURCE_NAME },
    sections: [{
      id: 'status',
      element: 'section',
      label: SOURCE_NAME,
      content: 'Select Bluetooth Input from Sources, then pair/connect to volumio from your phone or computer.'
    }]
  };
};

BluetoothInput.prototype.setUIConfig = function () {};
BluetoothInput.prototype.getConf = function () {};
BluetoothInput.prototype.setConf = function () {};

function runCommand(command) {
  const defer = libQ.defer ? libQ.defer() : null;
  const promise = defer ? defer.promise : new Promise(function (resolve, reject) {
    childProcess.exec(command, { timeout: 15000 }, function (error, stdout, stderr) {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout: stdout, stderr: stderr });
    });
  });

  if (!defer) {
    return promise;
  }

  childProcess.exec(command, { timeout: 15000 }, function (error, stdout, stderr) {
    if (error) {
      error.stdout = stdout;
      error.stderr = stderr;
      defer.reject(error);
      return;
    }
    defer.resolve({ stdout: stdout, stderr: stderr });
  });
  return promise;
}
