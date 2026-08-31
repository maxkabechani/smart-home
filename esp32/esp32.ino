#include <HTTPClient.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Adafruit_NeoPixel.h>
#include "DHT.h"

// ======================================================
// CONFIGURATION
// ======================================================

// ---- GPIO map ----
constexpr uint8_t PIN_WS2812 = 2;
constexpr uint8_t PIN_KEYPAD_C1 = 4;
constexpr uint8_t PIN_RFID_SS = 5;
constexpr uint8_t PIN_GSM_TX = 13;
constexpr uint8_t PIN_KEYPAD_C2 = 14;
constexpr uint8_t PIN_SHIFT_LATCH = 15;
constexpr uint8_t PIN_SPI_SCK = 18;
constexpr uint8_t PIN_SPI_MISO = 19;
constexpr uint8_t PIN_LCD_SDA = 21;
constexpr uint8_t PIN_LCD_SCL = 22;
constexpr uint8_t PIN_SPI_MOSI = 23;
constexpr uint8_t PIN_DHT = 25;
constexpr uint8_t PIN_ULTRASONIC_TRIG = 26;
constexpr uint8_t PIN_KEYPAD_C3 = 27;
constexpr uint8_t PIN_SERVO = 32;
constexpr uint8_t PIN_KEYPAD_C4 = 33;
constexpr uint8_t PIN_PIR = 34;
constexpr uint8_t PIN_ULTRASONIC_ECHO = 35;
constexpr uint8_t PIN_LDR = 36;
constexpr uint8_t PIN_GSM_RX = 39;

// RC522 reset is not defined in the required map; keep configurable.
constexpr uint8_t PIN_RFID_RST = 12;

// 74HC595 outputs
constexpr uint8_t Q_ROW1 = 0;
constexpr uint8_t Q_ROW2 = 1;
constexpr uint8_t Q_ROW3 = 2;
constexpr uint8_t Q_ROW4 = 3;
constexpr uint8_t Q_FAN = 4;
constexpr uint8_t Q_PUMP = 5;
constexpr uint8_t Q_OUTSIDE_RELAY = 6;
constexpr uint8_t Q_ALARM = 7;

// ---- core behavior ----
constexpr char DEFAULT_PIN[] = "1234";
constexpr uint8_t MAX_PIN_LENGTH = 8;
constexpr unsigned long GATE_AUTO_CLOSE_MS = 7000;
constexpr int SERVO_OPEN_ANGLE = 95;
constexpr int SERVO_CLOSED_ANGLE = 10;

constexpr unsigned long DHT_INTERVAL_MS = 2000;
constexpr float FAN_AUTO_ON_TEMP_C = 29.0f;
constexpr float FAN_AUTO_OFF_TEMP_C = 27.0f;

constexpr unsigned long TANK_READ_INTERVAL_MS = 2000;
constexpr float TANK_FULL_DISTANCE_CM = 7.0f;
constexpr float TANK_EMPTY_DISTANCE_CM = 35.0f;
constexpr float PUMP_START_PERCENT = 25.0f;
constexpr float PUMP_STOP_PERCENT = 80.0f;
constexpr unsigned long MAX_PUMP_RUN_MS = 120000;

constexpr int LDR_DARK_THRESHOLD = 1500;
constexpr int LDR_BRIGHT_THRESHOLD = 2100;
constexpr unsigned long LDR_SAMPLE_INTERVAL_MS = 1200;
constexpr bool OUTSIDE_RELAY_ACTIVE_LOW = true;

constexpr unsigned long INSIDE_LIGHT_TIMEOUT_MS = 30000;
constexpr uint8_t INSIDE_LED_BRIGHTNESS = 60;
constexpr uint8_t INSIDE_LED_R = 255;
constexpr uint8_t INSIDE_LED_G = 160;
constexpr uint8_t INSIDE_LED_B = 80;
constexpr uint16_t INSIDE_LED_COUNT = 8;

constexpr bool GSM_ENABLED = false;
constexpr unsigned long GSM_BAUD = 9600;
constexpr char ALERT_PHONE_NUMBER[] = "+10000000000";

constexpr bool BACKEND_ENABLED = false;
constexpr char WIFI_SSID[] = "YOUR_WIFI_NAME";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
constexpr char BACKEND_BASE_URL[] = "http://your-backend.local";
constexpr char DEVICE_ID[] = "esp32-main";
constexpr char DEVICE_API_KEY[] = "REPLACE_WITH_API_KEY";
constexpr unsigned long WIFI_RETRY_MS = 8000;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 10000;
constexpr unsigned long COMMAND_POLL_INTERVAL_MS = 1000;
constexpr uint32_t HTTP_TIMEOUT_MS = 1200;

constexpr bool COMMAND_WS_ENABLED = false;
constexpr bool COMMAND_WS_SSL = false;
constexpr char COMMAND_WS_HOST[] = "your-backend.local";
constexpr uint16_t COMMAND_WS_PORT = 80;
constexpr char COMMAND_WS_PATH[] = "/devices/ws";

// Keep fast legacy bulb websocket path if backend uses it.
constexpr bool LEGACY_BULB_WS_ENABLED = false;
constexpr bool LEGACY_BULB_WS_SSL = true;
constexpr char LEGACY_BULB_WS_HOST[] = "api.temp.maxkabechani.dev";
constexpr uint16_t LEGACY_BULB_WS_PORT = 443;
constexpr char LEGACY_BULB_WS_PATH[] = "/bulb/ws";

constexpr unsigned long LCD_PAGE_ROTATE_MS = 3000;
constexpr unsigned long TEMP_LCD_MESSAGE_MS = 2000;
constexpr unsigned long STATUS_PRINT_INTERVAL_MS = 7000;
constexpr unsigned long INTRUSION_SMS_COOLDOWN_MS = 45000;
constexpr uint8_t MAX_INVALID_PIN_ATTEMPTS = 3;
constexpr uint8_t MAX_UNAUTHORIZED_RFID_FOR_ALERT = 3;

// Easy-to-edit authorized RFID list
const char* AUTHORIZED_UIDS[] = {
  "04 A1 B2 C3"
};
constexpr size_t AUTHORIZED_UID_COUNT = sizeof(AUTHORIZED_UIDS) / sizeof(AUTHORIZED_UIDS[0]);

// ======================================================
// STATE / ENUMS
// ======================================================

enum class ControlMode : uint8_t { Auto, On, Off };

HardwareSerial gsmSerial(1);
DHT dht(PIN_DHT, DHT11);
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
Servo gateServo;
Adafruit_NeoPixel strip(INSIDE_LED_COUNT, PIN_WS2812, NEO_GRB + NEO_KHZ800);
WebSocketsClient commandSocket;
WebSocketsClient legacyBulbSocket;

volatile uint8_t shiftRegisterState = 0x0F; // rows high, actuators off

ControlMode fanMode = ControlMode::Auto;
ControlMode pumpMode = ControlMode::Auto;
ControlMode outsideLightMode = ControlMode::Auto;
ControlMode insideLightMode = ControlMode::Auto;

bool fanOn = false;
bool pumpOn = false;
bool outsideLightOn = false;
bool insideLightOn = false;
bool gateOpen = false;
bool securityArmed = false;
bool alarmOn = false;
bool gsmReady = false;
bool wifiEverConnected = false;
bool commandSocketStarted = false;
bool legacyBulbSocketStarted = false;
bool outsideIsDark = false;

float lastTemperature = NAN;
float lastHumidity = NAN;
float lastTankDistanceCm = NAN;
float lastTankPercent = NAN;
int lastLdrReading = 0;
bool lastPirState = false;
String lastRfidUid = "";
String enteredPin = "";

uint8_t invalidPinAttempts = 0;
uint8_t unauthorizedRfidAttempts = 0;

unsigned long nowMs = 0;
unsigned long lastDhtReadAt = 0;
unsigned long lastTankReadAt = 0;
unsigned long lastLdrSampleAt = 0;
unsigned long lastTelemetryAt = 0;
unsigned long lastCommandPollAt = 0;
unsigned long lastWiFiRetryAt = 0;
unsigned long gateOpenedAt = 0;
unsigned long pumpStartedAt = 0;
unsigned long lastMotionAt = 0;
unsigned long tempMessageUntil = 0;
unsigned long lastLcdPageAt = 0;
unsigned long lastStatusPrintAt = 0;
unsigned long lastSecurityAlertAt = 0;

uint8_t lcdPage = 0;
String tempLcdLine1;
String tempLcdLine2;

char activeKey = '\0';
unsigned long keyPressedAt = 0;

// ======================================================
// HELPERS
// ======================================================

const char* modeToText(ControlMode mode) {
  switch (mode) {
    case ControlMode::Auto: return "AUTO";
    case ControlMode::On: return "ON";
    case ControlMode::Off: return "OFF";
  }
  return "?";
}

void showTempMessage(const String& line1, const String& line2 = "") {
  tempLcdLine1 = line1;
  tempLcdLine2 = line2;
  tempMessageUntil = nowMs + TEMP_LCD_MESSAGE_MS;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

float clampf(float value, float minValue, float maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

void beginSharedSpiTransaction() {
  digitalWrite(PIN_RFID_SS, HIGH);
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
}

void endSharedSpiTransaction() {
  SPI.endTransaction();
}

// ======================================================
// SHIFT REGISTER / ACTUATORS
// ======================================================

void shiftWriteRaw(uint8_t value) {
  beginSharedSpiTransaction();
  digitalWrite(PIN_SHIFT_LATCH, LOW);
  SPI.transfer(value);
  digitalWrite(PIN_SHIFT_LATCH, HIGH);
  endSharedSpiTransaction();
}

void applyShiftRegisterState() {
  shiftWriteRaw(shiftRegisterState);
}

void setShiftBit(uint8_t bitIndex, bool high) {
  if (high) {
    shiftRegisterState |= (1 << bitIndex);
  } else {
    shiftRegisterState &= ~(1 << bitIndex);
  }
  applyShiftRegisterState();
}

bool relayLogicalOnToOutput(bool requestedOn) {
  if (OUTSIDE_RELAY_ACTIVE_LOW) {
    return !requestedOn;
  }
  return requestedOn;
}

void setFanState(bool on) {
  if (fanOn == on) return;
  fanOn = on;
  setShiftBit(Q_FAN, on);
  Serial.printf("[FAN] state -> %s\n", fanOn ? "ON" : "OFF");
}

void setPumpState(bool on) {
  if (pumpOn == on) return;
  pumpOn = on;
  setShiftBit(Q_PUMP, on);
  if (pumpOn) {
    pumpStartedAt = nowMs;
  }
  Serial.printf("[PUMP] state -> %s\n", pumpOn ? "ON" : "OFF");
}

void setOutsideLightState(bool on) {
  if (outsideLightOn == on) return;
  outsideLightOn = on;
  setShiftBit(Q_OUTSIDE_RELAY, relayLogicalOnToOutput(on));
  Serial.printf("[OUTSIDE] state -> %s\n", outsideLightOn ? "ON" : "OFF");
}

void setAlarmState(bool on) {
  if (alarmOn == on) return;
  alarmOn = on;
  setShiftBit(Q_ALARM, on);
  Serial.printf("[ALARM] state -> %s\n", alarmOn ? "ON" : "OFF");
}

void setInsideLightState(bool on) {
  if (insideLightOn == on) return;
  insideLightOn = on;
  uint32_t color = on ? strip.Color(INSIDE_LED_R, INSIDE_LED_G, INSIDE_LED_B) : 0;
  for (uint16_t i = 0; i < INSIDE_LED_COUNT; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
  Serial.printf("[INSIDE] state -> %s\n", insideLightOn ? "ON" : "OFF");
}

// ======================================================
// GATE
// ======================================================

void closeGate(const char* source = "system") {
  if (!gateOpen) return;
  gateServo.write(SERVO_CLOSED_ANGLE);
  gateOpen = false;
  Serial.printf("[GATE] CLOSED by %s\n", source);
  showTempMessage("Gate Closed", source);
}

void openGate(const char* source = "system") {
  gateServo.write(SERVO_OPEN_ANGLE);
  gateOpen = true;
  gateOpenedAt = nowMs;
  Serial.printf("[GATE] OPEN by %s\n", source);
  showTempMessage("Gate Open", source);
}

void maintainGateAutoClose() {
  if (gateOpen && nowMs - gateOpenedAt >= GATE_AUTO_CLOSE_MS) {
    closeGate("auto");
  }
}

// ======================================================
// KEYPAD (4x4 via 74HC595 rows + direct columns)
// ======================================================

const char KEYS[4][4] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

const uint8_t KEYPAD_COL_PINS[4] = {
  PIN_KEYPAD_C1,
  PIN_KEYPAD_C2,
  PIN_KEYPAD_C3,
  PIN_KEYPAD_C4
};

char scanKeypad() {
  uint8_t saved = shiftRegisterState;
  for (uint8_t row = 0; row < 4; row++) {
    uint8_t rowPattern = 0x0F;
    rowPattern &= ~(1 << row); // active low row select
    uint8_t value = (saved & 0xF0) | (rowPattern & 0x0F);
    shiftWriteRaw(value);
    delayMicroseconds(40);
    for (uint8_t col = 0; col < 4; col++) {
      if (digitalRead(KEYPAD_COL_PINS[col]) == LOW) {
        shiftWriteRaw(saved);
        return KEYS[row][col];
      }
    }
  }
  shiftWriteRaw(saved);
  return '\0';
}

void handleSecurityEvent(const String& reason);

void processPinSubmit() {
  if (enteredPin.equals(DEFAULT_PIN)) {
    invalidPinAttempts = 0;
    showTempMessage("PIN OK", "Gate opening");
    openGate("keypad");
  } else {
    invalidPinAttempts++;
    showTempMessage("Invalid PIN", enteredPin);
    Serial.printf("[SECURITY] invalid PIN attempt %u\n", invalidPinAttempts);
    if (invalidPinAttempts >= MAX_INVALID_PIN_ATTEMPTS) {
      invalidPinAttempts = 0;
      handleSecurityEvent("Repeated invalid PIN attempts");
    }
  }
  enteredPin = "";
}

void processKey(char key) {
  Serial.printf("[KEYPAD] key=%c\n", key);
  if (key == '*') {
    enteredPin = "";
    showTempMessage("PIN cleared", "");
    return;
  }
  if (key == '#') {
    processPinSubmit();
    return;
  }

  if (key >= '0' && key <= '9') {
    if (enteredPin.length() < MAX_PIN_LENGTH) {
      enteredPin += key;
    }
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enter PIN:");
    lcd.setCursor(0, 1);
    for (size_t i = 0; i < enteredPin.length(); i++) {
      lcd.print('*');
    }
    tempMessageUntil = nowMs + 2500;
    return;
  }

  switch (key) {
    case 'A':
      securityArmed = true;
      showTempMessage("Security", "ARMED");
      break;
    case 'B':
      securityArmed = false;
      setAlarmState(false);
      showTempMessage("Security", "DISARMED");
      break;
    case 'C': {
      String line1 = "Tank " + String(lastTankPercent, 0) + "%";
      String line2 = String(lastTankDistanceCm, 1) + "cm " + String(modeToText(pumpMode));
      showTempMessage(line1, line2);
      break;
    }
    case 'D':
      if (outsideLightMode == ControlMode::Auto) outsideLightMode = ControlMode::On;
      else if (outsideLightMode == ControlMode::On) outsideLightMode = ControlMode::Off;
      else outsideLightMode = ControlMode::Auto;
      showTempMessage("Outside mode", modeToText(outsideLightMode));
      break;
    default:
      break;
  }
}

void handleKeypad() {
  char key = scanKeypad();
  if (key == '\0') {
    activeKey = '\0';
    return;
  }

  if (key != activeKey || nowMs - keyPressedAt > 280) {
    activeKey = key;
    keyPressedAt = nowMs;
    processKey(key);
  }
}

// ======================================================
// RFID
// ======================================================

String getRfidUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += " ";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

bool isAuthorizedTag(const String& uid) {
  for (size_t i = 0; i < AUTHORIZED_UID_COUNT; i++) {
    if (uid.equalsIgnoreCase(AUTHORIZED_UIDS[i])) {
      return true;
    }
  }
  return false;
}

void handleRfid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = getRfidUid();
  lastRfidUid = uid;
  bool authorized = isAuthorizedTag(uid);

  Serial.printf("[RFID] UID=%s authorized=%s\n", uid.c_str(), authorized ? "YES" : "NO");

  if (authorized) {
    unauthorizedRfidAttempts = 0;
    showTempMessage("RFID Granted", uid);
    openGate("rfid");
  } else {
    unauthorizedRfidAttempts++;
    showTempMessage("RFID Denied", uid);
    if (unauthorizedRfidAttempts >= MAX_UNAUTHORIZED_RFID_FOR_ALERT) {
      unauthorizedRfidAttempts = 0;
      handleSecurityEvent("Repeated unauthorized RFID scans");
    }
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ======================================================
// CLIMATE (DHT + fan)
// ======================================================

void updateFanAutomation() {
  if (fanMode == ControlMode::On) {
    setFanState(true);
    return;
  }
  if (fanMode == ControlMode::Off) {
    setFanState(false);
    return;
  }

  if (isnan(lastTemperature)) {
    setFanState(false);
    return;
  }

  if (!fanOn && lastTemperature >= FAN_AUTO_ON_TEMP_C) {
    Serial.printf("[FAN] AUTO threshold crossed ON (%.1fC)\n", lastTemperature);
    setFanState(true);
  } else if (fanOn && lastTemperature <= FAN_AUTO_OFF_TEMP_C) {
    Serial.printf("[FAN] AUTO threshold crossed OFF (%.1fC)\n", lastTemperature);
    setFanState(false);
  }
}

void readDhtIfDue() {
  if (nowMs - lastDhtReadAt < DHT_INTERVAL_MS) return;
  lastDhtReadAt = nowMs;

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("[DHT] read failed");
    return;
  }

  lastHumidity = h;
  lastTemperature = t;
  Serial.printf("[DHT] T=%.1fC H=%.1f%%\n", lastTemperature, lastHumidity);
  updateFanAutomation();
}

// ======================================================
// WATER SYSTEM (ultrasonic + pump)
// ======================================================

float readTankDistanceCm() {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  unsigned long us = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000UL);
  if (us == 0) {
    return NAN;
  }
  return (float)us * 0.0343f / 2.0f;
}

float distanceToPercent(float distanceCm) {
  float pct = (TANK_EMPTY_DISTANCE_CM - distanceCm) * 100.0f / (TANK_EMPTY_DISTANCE_CM - TANK_FULL_DISTANCE_CM);
  return clampf(pct, 0.0f, 100.0f);
}

void updatePumpAutomation() {
  if (pumpMode == ControlMode::On) {
    setPumpState(true);
  } else if (pumpMode == ControlMode::Off) {
    setPumpState(false);
  } else {
    if (isnan(lastTankPercent)) {
      Serial.println("[PUMP] invalid tank read -> FAIL SAFE OFF");
      setPumpState(false);
      return;
    }

    if (!pumpOn && lastTankPercent <= PUMP_START_PERCENT) {
      Serial.printf("[PUMP] AUTO start threshold %.1f%%\n", lastTankPercent);
      setPumpState(true);
    } else if (pumpOn && lastTankPercent >= PUMP_STOP_PERCENT) {
      Serial.printf("[PUMP] AUTO stop threshold %.1f%%\n", lastTankPercent);
      setPumpState(false);
    }
  }

  if (pumpOn && nowMs - pumpStartedAt >= MAX_PUMP_RUN_MS) {
    Serial.println("[PUMP] safety timeout -> OFF");
    setPumpState(false);
  }
}

void readTankIfDue() {
  if (nowMs - lastTankReadAt < TANK_READ_INTERVAL_MS) return;
  lastTankReadAt = nowMs;

  float distance = readTankDistanceCm();
  lastTankDistanceCm = distance;

  if (isnan(distance) || distance < 1.0f || distance > 500.0f) {
    lastTankPercent = NAN;
    Serial.println("[TANK] invalid ultrasonic reading");
  } else {
    lastTankPercent = distanceToPercent(distance);
    Serial.printf("[TANK] distance=%.1fcm tank=%.1f%% mode=%s state=%s\n",
                  lastTankDistanceCm,
                  lastTankPercent,
                  modeToText(pumpMode),
                  pumpOn ? "ON" : "OFF");
  }

  updatePumpAutomation();
}

// ======================================================
// OUTSIDE LIGHT
// ======================================================

void updateOutsideLightAutomation() {
  if (outsideLightMode == ControlMode::On) {
    setOutsideLightState(true);
    return;
  }
  if (outsideLightMode == ControlMode::Off) {
    setOutsideLightState(false);
    return;
  }

  if (!outsideIsDark && lastLdrReading <= LDR_DARK_THRESHOLD) {
    outsideIsDark = true;
    Serial.printf("[LDR] dark threshold reached (%d)\n", lastLdrReading);
  } else if (outsideIsDark && lastLdrReading >= LDR_BRIGHT_THRESHOLD) {
    outsideIsDark = false;
    Serial.printf("[LDR] bright threshold reached (%d)\n", lastLdrReading);
  }

  setOutsideLightState(outsideIsDark);
}

void sampleLdrIfDue() {
  if (nowMs - lastLdrSampleAt < LDR_SAMPLE_INTERVAL_MS) return;
  lastLdrSampleAt = nowMs;

  lastLdrReading = analogRead(PIN_LDR);
  Serial.printf("[LDR] adc=%d mode=%s\n", lastLdrReading, modeToText(outsideLightMode));
  updateOutsideLightAutomation();
}

// ======================================================
// PIR / SECURITY / INSIDE LIGHT
// ======================================================

void sendSms(const String& message);

void handleSecurityEvent(const String& reason) {
  Serial.printf("[SECURITY] ALERT: %s\n", reason.c_str());
  showTempMessage("SECURITY ALERT", reason.substring(0, 16));
  setAlarmState(true);
  if (nowMs - lastSecurityAlertAt >= INTRUSION_SMS_COOLDOWN_MS) {
    lastSecurityAlertAt = nowMs;
    sendSms("ALERT " + reason);
  }
}

void updateInsideLightAutomation(bool pirState) {
  if (insideLightMode == ControlMode::On) {
    setInsideLightState(true);
    return;
  }
  if (insideLightMode == ControlMode::Off) {
    setInsideLightState(false);
    return;
  }

  if (pirState) {
    lastMotionAt = nowMs;
    setInsideLightState(true);
  } else if (insideLightOn && nowMs - lastMotionAt >= INSIDE_LIGHT_TIMEOUT_MS) {
    setInsideLightState(false);
  }
}

void handlePirAndSecurity() {
  bool pirState = digitalRead(PIN_PIR) == HIGH;
  bool risingEdge = pirState && !lastPirState;
  lastPirState = pirState;

  updateInsideLightAutomation(pirState);

  if (securityArmed && risingEdge) {
    handleSecurityEvent("PIR motion detected");
  }
}

// ======================================================
// GSM
// ======================================================

bool waitForGsmResponse(const char* expected, unsigned long timeoutMs) {
  String response;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (gsmSerial.available()) {
      response += (char)gsmSerial.read();
    }
    if (response.indexOf(expected) >= 0) {
      return true;
    }
    delay(10);
  }
  return false;
}

bool gsmCommand(const char* cmd, const char* expected = "OK", unsigned long timeoutMs = 1200) {
  gsmSerial.println(cmd);
  bool ok = waitForGsmResponse(expected, timeoutMs);
  Serial.printf("[GSM] %s -> %s\n", cmd, ok ? "OK" : "FAIL");
  return ok;
}

void setupGsm() {
  if (!GSM_ENABLED) {
    Serial.println("[GSM] disabled");
    return;
  }

  gsmSerial.begin(GSM_BAUD, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX);
  gsmReady = gsmCommand("AT") && gsmCommand("AT+CMGF=1");
  Serial.printf("[GSM] ready=%s\n", gsmReady ? "YES" : "NO");
}

void sendSms(const String& message) {
  if (!GSM_ENABLED || !gsmReady) {
    Serial.printf("[GSM] SMS skipped (enabled=%d ready=%d)\n", GSM_ENABLED, gsmReady);
    return;
  }

  gsmSerial.print("AT+CMGS=\"");
  gsmSerial.print(ALERT_PHONE_NUMBER);
  gsmSerial.println("\"");
  delay(250);
  gsmSerial.print(message);
  gsmSerial.write(26);
  bool ok = waitForGsmResponse("OK", 7000);
  Serial.printf("[GSM] SMS send -> %s\n", ok ? "OK" : "FAIL");
}

// ======================================================
// WIFI / BACKEND
// ======================================================

void connectWiFi() {
  if (!BACKEND_ENABLED || WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWiFiRetryAt = nowMs;
}

void maintainWiFi() {
  if (!BACKEND_ENABLED) return;

  wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED) {
    if (!wifiEverConnected) {
      wifiEverConnected = true;
      Serial.printf("[WiFi] connected IP=%s RSSI=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
    return;
  }

  wifiEverConnected = false;
  if (nowMs - lastWiFiRetryAt >= WIFI_RETRY_MS) {
    connectWiFi();
  }
}

void applyLegacyBulbPayload(const String& response) {
  bool enabled = response.indexOf("\"enabled\":true") >= 0;
  outsideLightMode = ControlMode::Off;
  setOutsideLightState(enabled);
  Serial.printf("[LegacyBulbWS] bulb=%s\n", enabled ? "ON" : "OFF");
}

void executeRemoteCommand(const String& command) {
  Serial.printf("[REMOTE] command: %s\n", command.c_str());

  if (command.indexOf("OPEN_GATE") >= 0) {
    openGate("remote");
  } else if (command.indexOf("CLOSE_GATE") >= 0) {
    closeGate("remote");
  } else if (command.indexOf("SET_SECURITY") >= 0) {
    securityArmed = command.indexOf("on") >= 0 || command.indexOf("true") >= 0;
    showTempMessage("Security", securityArmed ? "ARMED" : "DISARMED");
  } else if (command.indexOf("SET_FAN_MODE") >= 0) {
    if (command.indexOf("on") >= 0) fanMode = ControlMode::On;
    else if (command.indexOf("off") >= 0) fanMode = ControlMode::Off;
    else fanMode = ControlMode::Auto;
    updateFanAutomation();
  } else if (command.indexOf("SET_PUMP_MODE") >= 0) {
    if (command.indexOf("on") >= 0) pumpMode = ControlMode::On;
    else if (command.indexOf("off") >= 0) pumpMode = ControlMode::Off;
    else pumpMode = ControlMode::Auto;
    updatePumpAutomation();
  } else if (command.indexOf("SET_OUTSIDE_LIGHT_MODE") >= 0) {
    if (command.indexOf("on") >= 0) outsideLightMode = ControlMode::On;
    else if (command.indexOf("off") >= 0) outsideLightMode = ControlMode::Off;
    else outsideLightMode = ControlMode::Auto;
    updateOutsideLightAutomation();
  } else if (command.indexOf("SET_INSIDE_LIGHT_MODE") >= 0) {
    if (command.indexOf("on") >= 0) insideLightMode = ControlMode::On;
    else if (command.indexOf("off") >= 0) insideLightMode = ControlMode::Off;
    else insideLightMode = ControlMode::Auto;
  } else if (command.indexOf("TRIGGER_ALARM") >= 0) {
    setAlarmState(true);
  } else if (command.indexOf("STOP_ALARM") >= 0) {
    setAlarmState(false);
  }
}

void onCommandSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("[WS] command socket connected");
  } else if (type == WStype_DISCONNECTED) {
    Serial.println("[WS] command socket disconnected");
  } else if (type == WStype_TEXT) {
    String message;
    message.reserve(length);
    for (size_t i = 0; i < length; i++) message += (char)payload[i];
    executeRemoteCommand(message);
  }
}

void onLegacyBulbSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_TEXT) {
    String message;
    message.reserve(length);
    for (size_t i = 0; i < length; i++) message += (char)payload[i];
    applyLegacyBulbPayload(message);
  } else if (type == WStype_CONNECTED) {
    Serial.println("[LegacyBulbWS] connected");
  } else if (type == WStype_DISCONNECTED) {
    Serial.println("[LegacyBulbWS] disconnected");
  }
}

void ensureWebSockets() {
  if (!BACKEND_ENABLED || WiFi.status() != WL_CONNECTED) return;

  if (COMMAND_WS_ENABLED && !commandSocketStarted) {
    if (COMMAND_WS_SSL) commandSocket.beginSSL(COMMAND_WS_HOST, COMMAND_WS_PORT, COMMAND_WS_PATH);
    else commandSocket.begin(COMMAND_WS_HOST, COMMAND_WS_PORT, COMMAND_WS_PATH);
    commandSocket.onEvent(onCommandSocketEvent);
    commandSocket.setReconnectInterval(2000);
    commandSocketStarted = true;
  }

  if (LEGACY_BULB_WS_ENABLED && !legacyBulbSocketStarted) {
    if (LEGACY_BULB_WS_SSL) legacyBulbSocket.beginSSL(LEGACY_BULB_WS_HOST, LEGACY_BULB_WS_PORT, LEGACY_BULB_WS_PATH);
    else legacyBulbSocket.begin(LEGACY_BULB_WS_HOST, LEGACY_BULB_WS_PORT, LEGACY_BULB_WS_PATH);
    legacyBulbSocket.onEvent(onLegacyBulbSocketEvent);
    legacyBulbSocket.setReconnectInterval(2000);
    legacyBulbSocketStarted = true;
  }
}

void sendTelemetry() {
  if (!BACKEND_ENABLED || WiFi.status() != WL_CONNECTED) return;
  if (nowMs - lastTelemetryAt < TELEMETRY_INTERVAL_MS) return;
  lastTelemetryAt = nowMs;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/devices/" + DEVICE_ID + "/telemetry";
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  String payload = "{";
  payload += "\"temperature\":" + String(lastTemperature, 2) + ",";
  payload += "\"humidity\":" + String(lastHumidity, 2) + ",";
  payload += "\"fanState\":" + String(fanOn ? "true" : "false") + ",";
  payload += "\"fanMode\":\"" + String(modeToText(fanMode)) + "\",";
  payload += "\"tankPercent\":" + String(lastTankPercent, 1) + ",";
  payload += "\"tankDistance\":" + String(lastTankDistanceCm, 1) + ",";
  payload += "\"pumpState\":" + String(pumpOn ? "true" : "false") + ",";
  payload += "\"pumpMode\":\"" + String(modeToText(pumpMode)) + "\",";
  payload += "\"gateOpen\":" + String(gateOpen ? "true" : "false") + ",";
  payload += "\"securityArmed\":" + String(securityArmed ? "true" : "false") + ",";
  payload += "\"pir\":" + String(lastPirState ? "true" : "false") + ",";
  payload += "\"outsideLightState\":" + String(outsideLightOn ? "true" : "false") + ",";
  payload += "\"outsideLightMode\":\"" + String(modeToText(outsideLightMode)) + "\",";
  payload += "\"insideLightState\":" + String(insideLightOn ? "true" : "false") + ",";
  payload += "\"insideLightMode\":\"" + String(modeToText(insideLightMode)) + "\",";
  payload += "\"wifiRssi\":" + String(WiFi.RSSI());
  payload += "}";

  int code = http.POST(payload);
  Serial.printf("[NET] telemetry POST code=%d\n", code);
  http.end();
}

void pollCommands() {
  if (!BACKEND_ENABLED || WiFi.status() != WL_CONNECTED) return;
  if (COMMAND_WS_ENABLED) return; // websocket handles real-time commands
  if (nowMs - lastCommandPollAt < COMMAND_POLL_INTERVAL_MS) return;
  lastCommandPollAt = nowMs;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/devices/" + DEVICE_ID + "/commands/next";
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(url);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  int code = http.GET();
  if (code > 0) {
    String body = http.getString();
    if (body.length() > 0 && body != "null") {
      executeRemoteCommand(body);
    }
  }
  http.end();
}

// ======================================================
// LCD
// ======================================================

void updateLcdStatus() {
  if (enteredPin.length() > 0) return;
  if (tempMessageUntil > nowMs) return;
  if (nowMs - lastLcdPageAt < LCD_PAGE_ROTATE_MS) return;
  lastLcdPageAt = nowMs;

  lcd.clear();
  switch (lcdPage) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print("Smart Home");
      lcd.setCursor(0, 1);
      lcd.print(gateOpen ? "Gate OPEN" : "Gate CLOSED");
      break;
    case 1:
      lcd.setCursor(0, 0);
      lcd.print("T"); lcd.print(lastTemperature, 1); lcd.print(" H"); lcd.print(lastHumidity, 0);
      lcd.setCursor(0, 1);
      lcd.print("Fan "); lcd.print(modeToText(fanMode)); lcd.print(" "); lcd.print(fanOn ? "ON" : "OFF");
      break;
    case 2:
      lcd.setCursor(0, 0);
      lcd.print("Tank "); lcd.print(lastTankPercent, 0); lcd.print("%");
      lcd.setCursor(0, 1);
      lcd.print("Pump "); lcd.print(modeToText(pumpMode)); lcd.print(" "); lcd.print(pumpOn ? "ON" : "OFF");
      break;
    case 3:
      lcd.setCursor(0, 0);
      lcd.print("Security:");
      lcd.setCursor(0, 1);
      lcd.print(securityArmed ? "ARMED" : "DISARMED");
      break;
    case 4:
      lcd.setCursor(0, 0);
      lcd.print("Out "); lcd.print(modeToText(outsideLightMode));
      lcd.setCursor(0, 1);
      lcd.print(outsideLightOn ? "Light ON" : "Light OFF");
      break;
    case 5:
      lcd.setCursor(0, 0);
      lcd.print("In "); lcd.print(modeToText(insideLightMode));
      lcd.setCursor(0, 1);
      lcd.print(insideLightOn ? "Motion ON" : "Motion OFF");
      break;
    default:
      lcd.setCursor(0, 0);
      lcd.print("WiFi:");
      lcd.print(WiFi.status() == WL_CONNECTED ? "ON" : "OFF");
      lcd.setCursor(0, 1);
      lcd.print("RSSI ");
      lcd.print(WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) : String(0));
      break;
  }

  lcdPage = (lcdPage + 1) % 7;
}

// ======================================================
// SERIAL DIAGNOSTICS
// ======================================================

void printStatus() {
  Serial.println("===== STATUS =====");
  Serial.printf("RFID last UID: %s\n", lastRfidUid.c_str());
  Serial.printf("Temp/Hum: %.1f C / %.1f %%\n", lastTemperature, lastHumidity);
  Serial.printf("Tank: %.1f cm / %.1f %%\n", lastTankDistanceCm, lastTankPercent);
  Serial.printf("Fan mode/state: %s / %s\n", modeToText(fanMode), fanOn ? "ON" : "OFF");
  Serial.printf("Pump mode/state: %s / %s\n", modeToText(pumpMode), pumpOn ? "ON" : "OFF");
  Serial.printf("Outside mode/state: %s / %s\n", modeToText(outsideLightMode), outsideLightOn ? "ON" : "OFF");
  Serial.printf("Inside mode/state: %s / %s\n", modeToText(insideLightMode), insideLightOn ? "ON" : "OFF");
  Serial.printf("PIR/security/gate: %s / %s / %s\n",
                lastPirState ? "MOTION" : "IDLE",
                securityArmed ? "ARMED" : "DISARMED",
                gateOpen ? "OPEN" : "CLOSED");
  Serial.printf("GSM ready: %s\n", gsmReady ? "YES" : "NO");
  Serial.printf("WiFi/backend: %s / %s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DOWN", BACKEND_ENABLED ? "ENABLED" : "DISABLED");
  Serial.println("==================");
}

void handleSerialCommands() {
  if (!Serial.available()) return;
  char c = (char)Serial.read();
  switch (c) {
    case '1':
      pumpMode = ControlMode::On;
      updatePumpAutomation();
      break;
    case '0':
      pumpMode = ControlMode::Off;
      updatePumpAutomation();
      break;
    case 'f':
      fanMode = (fanMode == ControlMode::On) ? ControlMode::Off : ControlMode::On;
      updateFanAutomation();
      break;
    case 'g':
      if (gateOpen) closeGate("serial"); else openGate("serial");
      break;
    case 'l':
      outsideLightMode = ControlMode::Off;
      setOutsideLightState(!outsideLightOn);
      break;
    case 'r':
      Serial.printf("Last RFID UID: %s\n", lastRfidUid.c_str());
      break;
    case 's':
      printStatus();
      break;
    default:
      break;
  }
}

void printStatusIfDue() {
  if (nowMs - lastStatusPrintAt >= STATUS_PRINT_INTERVAL_MS) {
    lastStatusPrintAt = nowMs;
    printStatus();
  }
}

// ======================================================
// SETUP / LOOP
// ======================================================

void setup() {
  Serial.begin(115200);
  delay(150);
  Serial.println("ESP32 Smart Home boot");

  pinMode(PIN_RFID_SS, OUTPUT);
  digitalWrite(PIN_RFID_SS, HIGH);
  pinMode(PIN_SHIFT_LATCH, OUTPUT);

  pinMode(PIN_KEYPAD_C1, INPUT_PULLUP);
  pinMode(PIN_KEYPAD_C2, INPUT_PULLUP);
  pinMode(PIN_KEYPAD_C3, INPUT_PULLUP);
  pinMode(PIN_KEYPAD_C4, INPUT_PULLUP);

  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_LDR, INPUT);

  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL);
  lcd.init();
  lcd.backlight();
  showTempMessage("Smart Home", "Starting...");

  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_RFID_SS);
  applyShiftRegisterState(); // ensure safe startup outputs

  rfid.PCD_Init();
  rfid.PCD_DumpVersionToSerial();

  gateServo.attach(PIN_SERVO);
  gateServo.write(SERVO_CLOSED_ANGLE);
  gateOpen = false;

  dht.begin();

  strip.begin();
  strip.setBrightness(INSIDE_LED_BRIGHTNESS);
  setInsideLightState(false);

  // Startup safety
  setFanState(false);
  setPumpState(false);
  setOutsideLightState(false);
  setAlarmState(false);
  securityArmed = false;

  setupGsm();

  connectWiFi();
  ensureWebSockets();

  Serial.println("System ready");
}

void loop() {
  nowMs = millis();

  maintainWiFi();
  ensureWebSockets();

  if (commandSocketStarted) commandSocket.loop();
  if (legacyBulbSocketStarted) legacyBulbSocket.loop();

  handleKeypad();
  handleRfid();
  handlePirAndSecurity();

  readDhtIfDue();
  readTankIfDue();
  sampleLdrIfDue();

  updateFanAutomation();
  updatePumpAutomation();
  updateOutsideLightAutomation();
  maintainGateAutoClose();

  sendTelemetry();
  pollCommands();

  updateLcdStatus();
  handleSerialCommands();
  printStatusIfDue();
}
