'use strict';

const assert = require('assert');
const BluetoothInput = require('./index');

function createPlugin() {
  const calls = [];
  const commandRouter = {
    stateMachine: {
      setConsumeUpdateService: (service) => {
        calls.push(['setConsumeUpdateService', service]);
      },
      setVolatile: (data) => {
        calls.push(['setVolatile', data]);
      }
    },
    logger: {
      info: (message) => calls.push(['log', message]),
      error: (message) => calls.push(['error', message])
    },
    volumioAddToBrowseSources: (data) => {
      calls.push(['addSource', data]);
      return Promise.resolve();
    },
    volumioRemoveToBrowseSources: (name) => {
      calls.push(['removeSource', name]);
      return Promise.resolve();
    },
    volumioStop: () => {
      calls.push(['stopPlayback']);
      return Promise.resolve();
    },
    servicePushState: (state, service) => {
      calls.push(['pushState', service, state]);
      return Promise.resolve();
    }
  };

  const plugin = new BluetoothInput({
    coreCommand: commandRouter,
    logger: commandRouter.logger,
    runCommand: (command) => {
      calls.push(['run', command]);
      if (/ status$/.test(command)) {
        return Promise.resolve({ stdout: 'connected=Test Phone address=AA:BB:CC:DD:EE:FF', stderr: '' });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    }
  });

  return { plugin, calls };
}

async function testRegistersBrowseSource() {
  const { plugin, calls } = createPlugin();

  await plugin.onStart();

  const addSource = calls.find((call) => call[0] === 'addSource');
  assert(addSource, 'expected plugin to register a browse source');
  assert.strictEqual(addSource[1].name, 'Bluetooth Input');
  assert.strictEqual(addSource[1].uri, 'bluetooth_input');
  assert.strictEqual(addSource[1].plugin_type, 'music_service');
  assert.strictEqual(addSource[1].plugin_name, 'bluetooth_input');
}

async function testSelectingSourceStartsBridge() {
  const { plugin, calls } = createPlugin();

  const response = await plugin.handleBrowseUri('bluetooth_input');

  assert(calls.some((call) => call[0] === 'stopPlayback'), 'expected current playback to stop');
  assert(calls.some((call) => call[0] === 'setConsumeUpdateService' && call[1] === undefined), 'expected consume service to be cleared');
  assert(calls.some((call) => call[0] === 'setVolatile' && call[1].service === 'bluetooth_input' && typeof call[1].callback === 'function'), 'expected Bluetooth input to become volatile service');
  assert(calls.some((call) => call[0] === 'run' && call[1] === 'sudo -n /usr/local/bin/volumio-bluetooth-input start'), 'expected Bluetooth input helper to start');
  assert(calls.some((call) => call[0] === 'pushState' && call[1] === 'bluetooth_input' && call[2].status === 'play'), 'expected Volumio state to be pushed');
  assert(calls.some((call) => call[0] === 'run' && / status$/.test(call[1])), 'expected connection status to be queried');
  assert.strictEqual(response.navigation.lists[0].items[0].title, 'Bluetooth Input is active');
  assert.match(response.navigation.lists[0].items[0].artist, /Test Phone/);
}

async function testStopsBridgeOnStop() {
  const { plugin, calls } = createPlugin();

  await plugin.onStop();

  assert(calls.some((call) => call[0] === 'removeSource' && call[1] === 'Bluetooth Input'), 'expected browse source removal');
  assert(calls.some((call) => call[0] === 'run' && call[1] === 'sudo -n /usr/local/bin/volumio-bluetooth-input stop'), 'expected bridge stop');
}

async function main() {
  await testRegistersBrowseSource();
  await testSelectingSourceStartsBridge();
  await testStopsBridgeOnStop();
  console.log('bluetooth_input tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
