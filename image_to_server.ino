#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Wire.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Pins
#define BUTTON_MODE 2
#define BUTTON_CAPTURE 4
#define TRIG_PIN 12
#define ECHO_PIN 13
#define OLED_SDA 15
#define OLED_SCL 14

// WiFi
const char* ssid = "Swarnav-5G";
const char* password = "swarnav2005";

// Server
const char* server = "http://192.168.154.66:3000";

bool manualMode = false;
unsigned long lastCapture = 0;


void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);
  pinMode(BUTTON_MODE, INPUT_PULLUP);
  pinMode(BUTTON_CAPTURE, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
    return;
  }

  showOnOLED("Connecting WiFi...");
  WiFi.begin(ssid, password);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    showOnOLED("WiFi connected");
    Serial.println("Connected to WiFi");
  } else {
    showOnOLED("WiFi failed");
    Serial.println("Failed to connect to WiFi");
    return;
  }

  setupCamera();
}

void loop() {
  static bool lastModeBtn = HIGH;
  static bool lastCaptureBtn = HIGH;

  bool modeBtn = digitalRead(BUTTON_MODE);
  bool captureBtn = digitalRead(BUTTON_CAPTURE);

  if (lastModeBtn == HIGH && modeBtn == LOW) {
    manualMode = !manualMode;
    showOnOLED(manualMode ? "Manual Mode" : "Auto Mode");
    delay(500);
  }

  if (manualMode && lastCaptureBtn == HIGH && captureBtn == LOW) {
    captureAndSend();
    lastCapture = millis();
    delay(500);
  }

  if (!manualMode && millis() - lastCapture > 15000) {
    long dist = getDistance();
    if (dist > 200) {
      showOnOLED("Come closer");
    } else if (dist < 30) {
      showOnOLED("Go back");
    } else {
      captureAndSend();
      lastCapture = millis();
    }
  }

  checkRetake();

  lastModeBtn = modeBtn;
  lastCaptureBtn = captureBtn;

  delay(100);
}


void showOnOLED(const String& text) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.setTextColor(SSD1306_WHITE);
  display.println(text);
  display.display();
  Serial.println("OLED: " + text);
}

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sccb_sda = 26;
  config.pin_sccb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 10;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x", err);
    return;
  }
}

long getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 20000);
  long distance = duration * 0.034 / 2;
  return distance;
}

bool captureAndSend() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    showOnOLED("Camera capture failed");
    return false;
  }

  showOnOLED("Uploading...");
  HTTPClient http;
  http.begin(String(server) + "/upload");
  http.addHeader("Content-Type", "application/octet-stream");

  int httpResponseCode = http.sendRequest("POST", fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (httpResponseCode != 200) {
    showOnOLED("Upload failed");
    return false;
  }

  showOnOLED("Processing...");
  http.begin(String(server) + "/process");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(18000);  // 15 seconds timeout for processing (YOLO + OCR)
  int code = http.POST("{}");
  String result = http.getString();

  showOnOLED("HTTP Code:\n" + String(code));
  delay(2000);

  // Show server result briefly
  showOnOLED("Resp:\n" + result.substring(0, 20));  // Trimmed to fit screen
  delay(3000);

  if (code == 200) {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, result);
    if (error) {
      showOnOLED("JSON Error");
      delay(2000);
      showOnOLED(error.c_str());  // optional, might be long
      return false;
    }

    String text = doc["text"].as<String>();
    showOnOLED("Result:\n" + text);
  } else {
    showOnOLED("Proc failed");
  }
  return true;
}

void checkRetake() {
  HTTPClient http;
  http.begin(String(server) + "/should-retake");
  int code = http.GET();
  if (code == 200) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, http.getString());
    if (doc["retake"]) {
      showOnOLED("Retake requested");
      captureAndSend();
    }
  }
}
