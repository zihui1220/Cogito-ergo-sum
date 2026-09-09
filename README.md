# Cogito, ergo sum?

Interactive installation exploring identity, autonomy, and algorithmic normalisation.

## p5.js

The p5.js system processes real-time facial landmark data from MediaPipe Face Mesh to generate a digital portrait of the visitor.

As the visitor interacts with the physical installation, the portrait gradually changes from an individualised representation into a more regularised and standardised form.

The p5.js system also receives serial data from Arduino and controls the visual feedback of the digital portrait and LED system.

## Arduino

The Arduino system reads input from three pressure sensors placed underneath the missing sections of the physical mirror figure.

When a visitor places a mirror fragment onto a sensor, Arduino detects the pressure and sends the sensor data to the p5.js system through serial communication.

The Arduino also controls the WS2812B LED system, which changes from an irregular pattern to a more synchronised state as the three fragments are returned.

## Hardware

- Arduino Uno
- 3 × Pressure Sensors
- WS2812B LED Strip
- Acrylic Mirror Fragments
- USB Camera
- Monitor# Cogito-ergo-sum

