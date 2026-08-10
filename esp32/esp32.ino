#include <HTTPClient.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"

#define DHTPIN 14
#define DHTTYPE DHT11
#define BULB_PIN 27

const char* WIFI_SSID = "ODIN";
const char* WIFI_PASSWORD = "TheForce";

// Use your computer LAN IP here when testing locally, for example:
// const char* API_BASE_URL = "http://192.168.1.25:4000";
const char* API_BASE_URL = "https://api.temp.maxkabechani.dev";
const char* BULB_WS_HOST = "api.temp.maxkabechani.dev";
const uint16_t BULB_WS_PORT = 443;
const char* BULB_WS_PATH = "/bulb/ws";
const bool BULB_WS_SSL = true;

const unsigned long READ_INTERVAL_MS = 5000;
unsigned long lastReadAt = 0;

DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebSocketsClient bulbSocket;
bool bulbSocketStarted = false;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAt < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connect timeout.");
  }
}

void updateLcd(float temperature, float humidity) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(temperature, 1);
  lcd.print(" C");
  lcd.setCursor(0, 1);
  lcd.print("Hum:  ");
  lcd.print(humidity, 0);
  lcd.print(" %");
}

void postReading(float temperature, float humidity) {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/readings";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  char payload[128];
  snprintf(
    payload,
    sizeof(payload),
    "{\"temperature\":%.2f,\"humidity\":%.2f}",
    temperature,
    humidity
  );

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.print("POST /readings response code: ");
    Serial.println(httpCode);
    Serial.println(http.getString());
  } else {
    Serial.print("POST /readings failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

void applyBulbPayload(const String& response) {
  bool enabled = response.indexOf("\"enabled\":true") >= 0;
  digitalWrite(BULB_PIN, enabled ? HIGH : LOW);

  Serial.print("Bulb state: ");
  Serial.println(enabled ? "on" : "off");
}

void syncBulbState() {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/bulb";
  http.begin(url);

  int httpCode = http.GET();
  if (httpCode <= 0) {
    Serial.print("GET /bulb failed: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    return;
  }

  String response = http.getString();
  Serial.print("GET /bulb response code: ");
  Serial.println(httpCode);
  applyBulbPayload(response);

  http.end();
}

void onBulbSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("Bulb websocket connected.");
      break;
    case WStype_DISCONNECTED:
      Serial.println("Bulb websocket disconnected.");
      break;
    case WStype_TEXT: {
      String message = "";
      for (size_t i = 0; i < length; i++) {
        message += (char)payload[i];
      }
      Serial.print("Bulb websocket message: ");
      Serial.println(message);
      applyBulbPayload(message);
      break;
    }
    default:
      break;
  }
}

void ensureBulbWebSocket() {
  if (bulbSocketStarted || WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (BULB_WS_SSL) {
    bulbSocket.beginSSL(BULB_WS_HOST, BULB_WS_PORT, BULB_WS_PATH);
  } else {
    bulbSocket.begin(BULB_WS_HOST, BULB_WS_PORT, BULB_WS_PATH);
  }

  bulbSocket.onEvent(onBulbSocketEvent);
  bulbSocket.setReconnectInterval(2000);
  bulbSocketStarted = true;
}

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 temperature, humidity, LCD, and bulb control");

  pinMode(BULB_PIN, OUTPUT);
  digitalWrite(BULB_PIN, LOW);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ESP32 Monitor");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  dht.begin();
  connectWiFi();
  ensureBulbWebSocket();
}

void loop() {
  const unsigned long now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    ensureBulbWebSocket();
    bulbSocket.loop();
  }

  if (now - lastReadAt < READ_INTERVAL_MS) {
    delay(100);
    return;
  }

  lastReadAt = now;
  connectWiFi();

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("DHT read failed");
    return;
  }

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.print(" %\t");
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" C");

  updateLcd(temperature, humidity);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping API calls (WiFi not connected).");
    return;
  }

  postReading(temperature, humidity);
}
