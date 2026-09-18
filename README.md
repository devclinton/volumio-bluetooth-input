# Volumio Bluetooth Input

An open-source Bluetooth A2DP sink source for Volumio. A phone or computer
connects to the Volumio Bluetooth adapter, BlueALSA receives the audio, and the
plugin bridges it to Volumio's output device.

## Features

- Bluetooth Input appears in Volumio Sources.
- Incoming A2DP audio is routed through BlueALSA.
- Selecting another source stops the bridge and releases the DAC.
- Pairing is handled by a small BlueZ agent that trusts devices.
- The source view reports service state and connected device names/addresses.
- Adapter/output settings are represented in `bluetooth_input_plugin/config.json`.

## Install on Volumio

Copy `bluetooth_input_plugin` to `/data/plugins/music_service/bluetooth_input`.
Copy the files in `bluetooth_input_system` to their matching system paths, run
`systemctl daemon-reload`, and enable `bluetooth_input` in Volumio's plugin
registry. The system helper needs the sudo rules from
`volumio-bluetooth-input.sudoers`.

The plugin depends on BlueZ, BlueALSA, `bluetoothctl`, and a working Volumio
ALSA output. It is intended for Volumio OS 4.x on Debian Bookworm.

## Development

```sh
node bluetooth_input_plugin/test.js
```

This plugin is not affiliated with Volumio or MyVolumio.
