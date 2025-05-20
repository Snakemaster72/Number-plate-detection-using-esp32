# ESP32-CAM Webserver with Ultrasonic Sensor, OLED Display, and License Plate Recognition

This project implements a smart ESP32-CAM system that captures images automatically based on object distance, sends the image to a local server for license plate detection using YOLOv11, and displays the processed license plate text on an OLED screen. It also supports manual mode and server-triggered retakes.

## 🔧 Features

- **Automatic image capture** when an object is detected within 30 cm to 2 meters.
- **Manual capture mode** using a physical button.
- **Mode switching** between automatic and manual via button toggle.
- **OLED display** shows the processed license plate text.
- **Server communication** for image upload and result retrieval.
- **Retake support** via server API.
- **15-second cooldown** between auto-captures.

## 🧰 Hardware Used

- ESP32-CAM module  
- HC-SR04 ultrasonic distance sensor  
- 0.96" I2C OLED display (SSD1306)  
- Push buttons (x2)  
- 7.5V battery + buck converter (to power ESP32)  

## 📶 System Overview


## 📁 Project Structure

### On the ESP32-CAM:
- Captures image when object detected in range.
- Sends image to local server via HTTP POST.
- Receives processed license plate text in response.
- Displays result on OLED and Serial Monitor.
- Handles mode switching and debouncing.

### On the Server (Node.js + Express):
- Accepts image uploads at `/upload`
- Calls YOLOv11 license plate detection script locally
- Saves only the latest image
- Logs detected text with timestamp to a CSV or JSON
- Serves a frontend dashboard
- Provides `GET /retake` endpoint to trigger image recapture

## 🌐 API Endpoints

| Endpoint       | Method | Description                                 |
|----------------|--------|---------------------------------------------|
| `/upload`      | POST   | Receives image from ESP32, processes it     |
| `/retake`      | GET    | Triggers ESP32 to retake the image          |
| `/latest`      | GET    | Serves the latest processed image and text  |
| `/logs`        | GET    | Returns CSV/JSON of all past captures       |

## 🛠 Setup Instructions

### 1. ESP32-CAM Setup
- Connect the ultrasonic sensor, OLED, and buttons as per schematic.
- Flash the Arduino sketch to the ESP32-CAM using Arduino IDE or PlatformIO.
- Configure the server IP (e.g., `192.168.215.238`) in your sketch.

### 2. Server Setup

```bash
git clone https://github.com/your-username/esp32-cam-server
cd esp32-cam-server
npm install
node server.js
```
- Make sure the YOLOv11 detector from AKSMA/Licence_Plate_Detector is correctly integrated.
- Server runs on: http://xx.xx.xx.xx:3000

### 3. Dashboard
    Access the frontend via http://192.168.xx.x:3000 to view:
    -   Latest captured image
    -   Processed plate text
    -   Manual validation and retake buttons
    -   Capture history

### 📸 Sample Use Case

-  Car enters the sensor's range.
-  ESP32-CAM captures the image and uploads it.
-  Server detects the license plate using YOLOv3.
-  Plate text is displayed on OLED and stored in the log.
-  User can verify, retake, or view data via dashboard.