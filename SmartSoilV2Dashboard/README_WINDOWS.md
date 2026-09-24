# Smart Soil Probe AI - Windows Read Guide

This package runs the Smart Soil Probe AI Dashboard locally on Windows.
It includes the bilingual dashboard, crop screening, history view, 3D field view,
simulation controls, and Web Serial connection support for the ESP32.

## 1. Install Node.js

1. Open <https://nodejs.org/en/download>.
2. Download the **LTS** Windows installer.
3. Install it with the default options.
4. Restart Windows if the installer asks you to.

## 2. Start the dashboard

1. Extract this ZIP to a normal folder, for example `C:\SmartSoil`.
2. Double-click `start_windows.bat`.
3. The browser should open `http://localhost:4173/` automatically.

Keep the black command window open while using the dashboard. Press `Ctrl+C`
in that window to stop the local server.

## 3. Use simulation mode

Use the scenario buttons to test the prototype:

- **Healthy Farm**: balanced conditions
- **Drought Stress**: dry soil and heat stress
- **Waterlogged**: wet soil and fungal-risk conditions
- **Heat Stress**: high-temperature conditions

The Dashboard shows sensor values, soil diagnosis, the top three crops,
explanations, recommendations, the digital twin, and history.

## 4. Connect the ESP32

Use Google Chrome or Microsoft Edge on `localhost` because Web Serial requires
a supported browser and a local secure context.

1. Connect the ESP32 with a USB data cable.
2. Close Arduino IDE's Serial Monitor first. Only one program can use the COM port.
3. Click **START MEASUREMENT** in the Dashboard.
4. Choose the ESP32 serial port in the browser dialog.
5. Wait for the live reading and crop recommendation.
6. Use the physical NEXT button or the Dashboard **NEXT PAGE** button to move
   through the ESP32 screen pages.

If the port is missing, check **Device Manager > Ports (COM & LPT)** and install
the USB-serial driver required by the board.

## 5. Upload the ESP32 firmware

The web package does not upload firmware automatically.

1. Install Arduino IDE 2.x.
2. Open the supplied SmartSoilTFT firmware folder, if included by your team.
3. Select the ESP32 board and the correct COM port.
4. Close the Dashboard's Web Serial connection before uploading.
5. Upload the sketch.
6. Reconnect the Dashboard and press **START MEASUREMENT**.

## 6. Important prototype notes

- Crop recommendation is an MVP screening result, not a laboratory diagnosis.
- The current common ranking uses pH, soil moisture band, and soil temperature.
- NPK, rainfall, and cloud AI remain future extensions until real data sources
  are connected.
- Keep the server window open; closing it stops the Dashboard API and history.

## Troubleshooting

### Browser says the server cannot be reached

Make sure `start_windows.bat` is still running. Then open
`http://localhost:4173/` manually.

### ESP32 port is busy

Close Arduino IDE Serial Monitor and any other serial terminal. Refresh the
Dashboard before trying START again.

### The web and screen show different crops

Restart the Dashboard server, refresh the browser, press START once, and use
the same measurement cycle. The ESP32 firmware locks the recommendation to the
first valid reading in a cycle so NEXT only changes the display page.
