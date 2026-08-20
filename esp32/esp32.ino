#include <HTTPClient.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include "DHT.h"

// ======================================================
// PIN DEFINITIONS
// ======================================================

// DHT11
#define DHTPIN 14
#define DHTTYPE DHT11

// Bulb / relay
#define BULB_PIN 27

// RFID RC522
#define RFID_SS_PIN 5
#define RFID_RST_PIN 4

// RFID indicator LEDs
#define ACCESS_GRANTED_LED 26
#define ACCESS_DENIED_LED 25

// ======================================================
// WIFI / API
// ======================================================

// Keep your existing Wi-Fi details here
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_BASE_URL = "https://api.temp.maxkabechani.dev";

const char* BULB_WS_HOST = "api.temp.maxkabechani.dev";
const uint16_t BULB_WS_PORT = 443;
const char* BULB_WS_PATH = "/bulb/ws";
const bool BULB_WS_SSL = true;

// ======================================================
// TIMING
// ======================================================

const unsigned long READ_INTERVAL_MS = 5000;

// RFID LED stays on for 3 seconds
const unsigned long RFID_LED_DURATION_MS = 3000;

unsigned long lastReadAt = 0;
unsigned long rfidLedStartedAt = 0;

bool rfidLedActive = false;


const char* AUTHORIZED_UID = "04 A1 B2 C3";

// ======================================================
// DEVICES
// ======================================================

DHT dht(DHTPIN, DHTTYPE);

LiquidCrystal_I2C lcd(0x27, 16, 2);

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

WebSocketsClient bulbSocket;

bool bulbSocketStarted = false;

// ======================================================
// WIFI
// ======================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startAt = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startAt < 15000
  ) {
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

// ======================================================
// LCD
// ======================================================

void updateLcd(float temperature, float humidity) {
  // Don't overwrite RFID result while its LED is active
  if (rfidLedActive) {
    return;
  }

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(temperature, 1);
  lcd.print(" C");

  lcd.setCursor(0, 1);
  lcd.print("Hum: ");
  lcd.print(humidity, 0);
  lcd.print(" %");
}

// ======================================================
// RFID
// ======================================================

String getRfidUid() {
  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) {
      uid += " ";
    }

    // Add leading zero if needed
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }

    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  return uid;
}

bool isAuthorizedTag(const String& uid) {
  return uid.equalsIgnoreCase(AUTHORIZED_UID);
}

void turnOffRfidLeds() {
  digitalWrite(ACCESS_GRANTED_LED, LOW);
  digitalWrite(ACCESS_DENIED_LED, LOW);

  rfidLedActive = false;
}

void showRfidResult(bool authorized, const String& uid) {
  // Make sure both LEDs are off first
  digitalWrite(ACCESS_GRANTED_LED, LOW);
  digitalWrite(ACCESS_DENIED_LED, LOW);

  lcd.clear();

  if (authorized) {
    // GPIO 26 ON
    digitalWrite(ACCESS_GRANTED_LED, HIGH);

    Serial.println("ACCESS GRANTED");

    lcd.setCursor(0, 0);
    lcd.print("Access Granted");
  } else {
    // GPIO 25 ON
    digitalWrite(ACCESS_DENIED_LED, HIGH);

    Serial.println("ACCESS DENIED");

    lcd.setCursor(0, 0);
    lcd.print("Access Denied");
  }

  // Show UID on second LCD row
  lcd.setCursor(0, 1);

  if (uid.length() > 16) {
    lcd.print(uid.substring(0, 16));
  } else {
    lcd.print(uid);
  }

  rfidLedStartedAt = millis();
  rfidLedActive = true;
}

void handleRfid() {
  // ----------------------------------------------
  // Turn RFID LED off after 3 seconds
  // ----------------------------------------------

  if (
    rfidLedActive &&
    millis() - rfidLedStartedAt >= RFID_LED_DURATION_MS
  ) {
    turnOffRfidLeds();
  }

  // ----------------------------------------------
  // Check for a new RFID card
  // ----------------------------------------------

  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  // Read card UID
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = getRfidUid();

  Serial.println();
  Serial.println("==============================");
  Serial.println("RFID CARD DETECTED");
  Serial.print("RFID UID: ");
  Serial.println(uid);

  // Check card
  bool authorized = isAuthorizedTag(uid);

  showRfidResult(authorized, uid);

  Serial.println("==============================");
  Serial.println();

  // Stop communication with current card
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ======================================================
// TEMPERATURE API
// ======================================================

void postReading(float temperature, float humidity) {
  HTTPClient http;

  String url = String(API_BASE_URL) + "/readings";

  http.begin(url);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

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
    Serial.print(
      "POST /readings response code: "
    );

    Serial.println(httpCode);

    Serial.println(http.getString());
  } else {
    Serial.print(
      "POST /readings failed: "
    );

    Serial.println(
      http.errorToString(httpCode)
    );
  }

  http.end();
}

// ======================================================
// BULB
// ======================================================

void applyBulbPayload(const String& response) {
  bool enabled =
    response.indexOf("\"enabled\":true") >= 0;

  digitalWrite(
    BULB_PIN,
    enabled ? HIGH : LOW
  );

  Serial.print("Bulb state: ");

  Serial.println(
    enabled ? "on" : "off"
  );
}

void syncBulbState() {
  HTTPClient http;

  String url =
    String(API_BASE_URL) + "/bulb";

  http.begin(url);

  int httpCode = http.GET();

  if (httpCode <= 0) {
    Serial.print("GET /bulb failed: ");

    Serial.println(
      http.errorToString(httpCode)
    );

    http.end();

    return;
  }

  String response = http.getString();

  Serial.print(
    "GET /bulb response code: "
  );

  Serial.println(httpCode);

  applyBulbPayload(response);

  http.end();
}

// ======================================================
// BULB WEBSOCKET
// ======================================================

void onBulbSocketEvent(
  WStype_t type,
  uint8_t* payload,
  size_t length
) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println(
        "Bulb websocket connected."
      );
      break;

    case WStype_DISCONNECTED:
      Serial.println(
        "Bulb websocket disconnected."
      );
      break;

    case WStype_TEXT: {
      String message = "";

      for (size_t i = 0; i < length; i++) {
        message += (char)payload[i];
      }

      Serial.print(
        "Bulb websocket message: "
      );

      Serial.println(message);

      applyBulbPayload(message);

      break;
    }

    default:
      break;
  }
}

void ensureBulbWebSocket() {
  if (
    bulbSocketStarted ||
    WiFi.status() != WL_CONNECTED
  ) {
    return;
  }

  if (BULB_WS_SSL) {
    bulbSocket.beginSSL(
      BULB_WS_HOST,
      BULB_WS_PORT,
      BULB_WS_PATH
    );
  } else {
    bulbSocket.begin(
      BULB_WS_HOST,
      BULB_WS_PORT,
      BULB_WS_PATH
    );
  }

  bulbSocket.onEvent(
    onBulbSocketEvent
  );

  bulbSocket.setReconnectInterval(
    2000
  );

  bulbSocketStarted = true;
}

// ======================================================
// SETUP
// ======================================================

void setup() {
  Serial.begin(115200);

  Serial.println();
  Serial.println(
    "ESP32 Temperature + RFID Monitor"
  );

  // --------------------------------------------------
  // Bulb
  // --------------------------------------------------

  pinMode(BULB_PIN, OUTPUT);
  digitalWrite(BULB_PIN, LOW);

  // --------------------------------------------------
  // RFID LEDs
  // --------------------------------------------------

  pinMode(
    ACCESS_GRANTED_LED,
    OUTPUT
  );

  pinMode(
    ACCESS_DENIED_LED,
    OUTPUT
  );

  digitalWrite(
    ACCESS_GRANTED_LED,
    LOW
  );

  digitalWrite(
    ACCESS_DENIED_LED,
    LOW
  );

  // --------------------------------------------------
  // RFID / SPI
  // --------------------------------------------------

  SPI.begin(
    18,             // SCK
    19,             // MISO
    23,             // MOSI
    RFID_SS_PIN      // SS
  );

  rfid.PCD_Init();

  delay(100);

  Serial.println(
    "RFID reader initialized."
  );

  // Prints RC522 firmware information
  rfid.PCD_DumpVersionToSerial();

  // --------------------------------------------------
  // LCD
  // --------------------------------------------------

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("ESP32 Monitor");

  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  // --------------------------------------------------
  // DHT
  // --------------------------------------------------

  dht.begin();

  // --------------------------------------------------
  // WiFi
  // --------------------------------------------------

  connectWiFi();

  ensureBulbWebSocket();

  Serial.println();
  Serial.println("System ready.");
  Serial.println(
    "Scan RFID card..."
  );
}

// ======================================================
// LOOP
// ======================================================

void loop() {
  // --------------------------------------------------
  // RFID
  //
  // This runs every loop so card detection is fast.
  // --------------------------------------------------

  handleRfid();

  const unsigned long now = millis();

  // --------------------------------------------------
  // WebSocket
  // --------------------------------------------------

  if (WiFi.status() == WL_CONNECTED) {
    ensureBulbWebSocket();

    bulbSocket.loop();
  }

  // --------------------------------------------------
  // Only read DHT every 5 seconds
  // --------------------------------------------------

  if (
    now - lastReadAt <
    READ_INTERVAL_MS
  ) {
    delay(50);
    return;
  }

  lastReadAt = now;

  // --------------------------------------------------
  // WiFi
  // --------------------------------------------------

  connectWiFi();

  // --------------------------------------------------
  // Temperature / humidity
  // --------------------------------------------------

  float humidity =
    dht.readHumidity();

  float temperature =
    dht.readTemperature();

  if (
    isnan(humidity) ||
    isnan(temperature)
  ) {
    Serial.println(
      "Failed to read from DHT sensor!"
    );

    // Don't overwrite RFID message
    if (!rfidLedActive) {
      lcd.clear();

      lcd.setCursor(0, 0);

      lcd.print(
        "DHT read failed"
      );
    }

    return;
  }

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.print(" %\t");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" C");

  // Update LCD unless we're showing RFID result
  updateLcd(
    temperature,
    humidity
  );

  // --------------------------------------------------
  // API
  // --------------------------------------------------

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {
    Serial.println(
      "Skipping API calls "
      "(WiFi not connected)."
    );

    return;
  }

  postReading(
    temperature,
    humidity
  );
}