#include <Adafruit_NeoPixel.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>
#include <Wire.h>

// ======================================================
// CONFIGURATION (edit these values for your installation)
// ======================================================
constexpr uint8_t PIN_WS2812 = 2;
constexpr uint8_t PIN_KEYPAD_COLUMNS[] = {4, 14, 27, 33};
constexpr uint8_t PIN_RFID_SS = 5;
constexpr uint8_t PIN_GSM_TX = 13;
constexpr uint8_t PIN_SHIFT_LATCH = 15;
constexpr uint8_t PIN_SPI_SCK_SHIFT_CLOCK = 18;
constexpr uint8_t PIN_RFID_MISO = 19;
constexpr uint8_t PIN_LCD_SDA = 21;
constexpr uint8_t PIN_LCD_SCL = 22;
constexpr uint8_t PIN_SPI_MOSI_SHIFT_DATA = 23;
constexpr uint8_t PIN_DHT = 25;
constexpr uint8_t PIN_ULTRASONIC_TRIG = 26;
constexpr uint8_t PIN_SERVO = 32;
constexpr uint8_t PIN_PIR = 34;
constexpr uint8_t PIN_ULTRASONIC_ECHO = 35;
constexpr uint8_t PIN_PHOTORESISTOR = 36;
constexpr uint8_t PIN_GSM_RX = 39;

constexpr uint8_t SHIFT_KEYPAD_MASK = 0x0F; // Q0-Q3
constexpr uint8_t SHIFT_FAN = 1U << 4;      // Q4
constexpr uint8_t SHIFT_PUMP = 1U << 5;     // Q5
constexpr uint8_t SHIFT_OUTSIDE = 1U << 6;  // Q6
constexpr uint8_t SHIFT_ALARM = 1U << 7;    // Q7

constexpr char ACCESS_PIN[] = "1234";
constexpr uint8_t GATE_CLOSED_ANGLE = 10;
constexpr uint8_t GATE_OPEN_ANGLE = 100;
constexpr unsigned long GATE_OPEN_MS = 5000;

// Add/remove uppercase, space-separated UIDs here.
const char *const AUTHORIZED_RFID_UIDS[] = {"04 A1 B2 C3"};
constexpr size_t AUTHORIZED_RFID_UID_COUNT = sizeof(AUTHORIZED_RFID_UIDS) / sizeof(AUTHORIZED_RFID_UIDS[0]);

constexpr float FAN_ON_C = 29.0F;
constexpr float FAN_OFF_C = 27.0F;
constexpr float TANK_FULL_DISTANCE_CM = 5.0F;
constexpr float TANK_EMPTY_DISTANCE_CM = 40.0F;
constexpr int PUMP_START_PERCENT = 25;
constexpr int PUMP_STOP_PERCENT = 80;
constexpr unsigned long MAX_PUMP_RUNTIME_MS = 10UL * 60UL * 1000UL;

constexpr int OUTSIDE_DARK_ADC = 1200;
constexpr int OUTSIDE_BRIGHT_ADC = 1800;
constexpr bool OUTSIDE_RELAY_ACTIVE_LOW = true;
constexpr uint16_t WS2812_LED_COUNT = 8;
constexpr uint8_t WS2812_BRIGHTNESS = 50;
constexpr unsigned long INSIDE_LIGHT_TIMEOUT_MS = 60UL * 1000UL;

constexpr bool GSM_ENABLED = false;
constexpr uint32_t GSM_BAUD_RATE = 9600;
constexpr char ALERT_PHONE_NUMBER[] = "+000000000000";
constexpr unsigned long SECURITY_ALERT_COOLDOWN_MS = 60UL * 1000UL;
constexpr uint8_t INVALID_PIN_ALERT_COUNT = 3;
constexpr uint8_t UNAUTHORIZED_RFID_ALERT_COUNT = 3;

constexpr bool BACKEND_ENABLED = false;
constexpr char WIFI_SSID[] = "YOUR_WIFI_SSID";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
constexpr char BACKEND_BASE_URL[] = "https://example.invalid/api";
constexpr char DEVICE_ID[] = "esp32-home-01";
constexpr char DEVICE_API_KEY[] = "YOUR_DEVICE_API_KEY";
constexpr unsigned long WIFI_RETRY_MS = 15000;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 30000;
constexpr unsigned long COMMAND_POLL_INTERVAL_MS = 1000;
constexpr uint16_t HTTP_TIMEOUT_MS = 1200;

constexpr unsigned long DHT_INTERVAL_MS = 2000;
constexpr unsigned long TANK_INTERVAL_MS = 3000;
constexpr unsigned long LIGHT_INTERVAL_MS = 1000;
constexpr unsigned long LCD_PAGE_INTERVAL_MS = 4000;
constexpr unsigned long STATUS_INTERVAL_MS = 15000;

// ======================================================
// STATE / DEVICES
// ======================================================
enum class ControlMode : uint8_t { Auto, On, Off };

DHT dht(PIN_DHT, DHT11);
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(PIN_RFID_SS, UINT8_MAX); // RC522 RST is tied high; no ESP32 GPIO is allocated.
Servo gateServo;
Adafruit_NeoPixel insideStrip(WS2812_LED_COUNT, PIN_WS2812, NEO_GRB + NEO_KHZ800);
HardwareSerial gsmSerial(2);

ControlMode fanMode = ControlMode::Auto;
ControlMode pumpMode = ControlMode::Auto;
ControlMode outsideLightMode = ControlMode::Auto;
ControlMode insideLightMode = ControlMode::Auto;
bool fanOn = false, pumpOn = false, outsideLightOn = false, insideLightOn = false;
bool gateOpen = false, securityArmed = false, pirMotion = false, previousPirMotion = false;
bool gsmResponding = false, alarmOn = false, tankReadingValid = false, climateReadingValid = false;
float temperatureC = NAN, humidityPercent = NAN, tankDistanceCm = NAN;
int tankPercent = 0, photoresistorAdc = 0;
uint8_t shiftActuatorBits = 0;
String pinEntry, lastRfidUid = "none";
uint8_t invalidPinAttempts = 0, unauthorizedRfidAttempts = 0;
unsigned long gateOpenedAt = 0, pumpStartedAt = 0, lastMotionAt = 0, lastAlertAt = 0;
unsigned long lastDhtAt = 0, lastTankAt = 0, lastLightAt = 0, lastLcdAt = 0;
unsigned long lastWiFiAttemptAt = 0, lastTelemetryAt = 0, lastCommandPollAt = 0, lastStatusAt = 0;
unsigned long temporaryMessageUntil = 0;
uint8_t lcdPage = 0;

// ======================================================
// HELPERS / SHIFT REGISTER
// ======================================================
const char *modeName(ControlMode mode) {
  if (mode == ControlMode::On) return "ON";
  if (mode == ControlMode::Off) return "OFF";
  return "AUTO";
}

void writeShiftRegister(uint8_t keypadRows = SHIFT_KEYPAD_MASK) {
  // Keeping SS high deselects RC522 while its shared SCK/MOSI pins are toggled.
  digitalWrite(PIN_RFID_SS, HIGH);
  digitalWrite(PIN_SHIFT_LATCH, LOW);
  shiftOut(PIN_SPI_MOSI_SHIFT_DATA, PIN_SPI_SCK_SHIFT_CLOCK, MSBFIRST,
           shiftActuatorBits | (keypadRows & SHIFT_KEYPAD_MASK));
  digitalWrite(PIN_SHIFT_LATCH, HIGH); // Outputs change only at this edge.
}

void setShiftOutput(uint8_t mask, bool electricalHigh) {
  if (electricalHigh) shiftActuatorBits |= mask;
  else shiftActuatorBits &= ~mask;
  writeShiftRegister();
}

void setFan(bool on) { if (fanOn != on) Serial.printf("Fan %s\n", on ? "ON" : "OFF"); fanOn = on; setShiftOutput(SHIFT_FAN, on); }
void setPump(bool on) {
  if (pumpOn == on) return;
  pumpOn = on;
  if (on) pumpStartedAt = millis();
  Serial.printf("Pump %s (mode %s)\n", on ? "ON" : "OFF", modeName(pumpMode));
  setShiftOutput(SHIFT_PUMP, on);
}
void setOutsideLight(bool on) {
  outsideLightOn = on;
  setShiftOutput(SHIFT_OUTSIDE, OUTSIDE_RELAY_ACTIVE_LOW ? !on : on);
}
void setAlarm(bool on) { alarmOn = on; setShiftOutput(SHIFT_ALARM, on); }

// ======================================================
// LCD
// ======================================================
void lcdLines(const String &line1, const String &line2) {
  lcd.clear(); lcd.setCursor(0, 0); lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(line2.substring(0, 16));
}
void showTemporaryMessage(const String &line1, const String &line2, unsigned long durationMs = 2500) {
  temporaryMessageUntil = millis() + durationMs;
  lcdLines(line1, line2);
}

// ======================================================
// GATE
// ======================================================
void openGate() {
  gateServo.write(GATE_OPEN_ANGLE); gateOpen = true; gateOpenedAt = millis();
  Serial.println("Gate OPEN"); showTemporaryMessage("Access granted", "Gate opening");
}
void closeGate() { gateServo.write(GATE_CLOSED_ANGLE); gateOpen = false; Serial.println("Gate CLOSED"); }
void maintainGate() { if (gateOpen && millis() - gateOpenedAt >= GATE_OPEN_MS) closeGate(); }

// ======================================================
// GSM / SECURITY
// ======================================================
bool waitForGsmResponse(unsigned long timeoutMs) {
  unsigned long start = millis(); String response;
  while (millis() - start < timeoutMs) { while (gsmSerial.available()) response += char(gsmSerial.read()); delay(1); }
  if (response.length()) Serial.println("GSM: " + response);
  return response.indexOf("OK") >= 0;
}
bool sendSms(const String &message) {
  if (!GSM_ENABLED || !gsmResponding) { Serial.println("SMS skipped: GSM unavailable/disabled"); return false; }
  gsmSerial.print("AT+CMGS=\""); gsmSerial.print(ALERT_PHONE_NUMBER); gsmSerial.println("\"");
  delay(50); gsmSerial.print(message); gsmSerial.write(26);
  bool sent = waitForGsmResponse(1500); Serial.println(sent ? "SMS sent" : "SMS failed"); return sent;
}
void triggerSecurityEvent(const String &reason) {
  unsigned long now = millis();
  if (lastAlertAt != 0 && now - lastAlertAt < SECURITY_ALERT_COOLDOWN_MS) { Serial.println("Alert suppressed by cooldown: " + reason); return; }
  lastAlertAt = now; Serial.println("SECURITY ALERT: " + reason); showTemporaryMessage("SECURITY ALERT", reason, 5000);
  setAlarm(true); sendSms("Smart home alert: " + reason);
}
void handlePir() {
  pirMotion = digitalRead(PIN_PIR) == HIGH;
  if (pirMotion) lastMotionAt = millis();
  if (pirMotion && !previousPirMotion && securityArmed) triggerSecurityEvent("PIR intrusion");
  previousPirMotion = pirMotion;
}

// ======================================================
// KEYPAD (Q0-Q3 rows; actuator bits are always preserved)
// ======================================================
const char KEYS[4][4] = {{'1','2','3','A'}, {'4','5','6','B'}, {'7','8','9','C'}, {'*','0','#','D'}};
char scanKeypad() {
  static char lastRaw = 0, reported = 0; static unsigned long changedAt = 0;
  char raw = 0;
  for (uint8_t row = 0; row < 4 && !raw; ++row) {
    writeShiftRegister(uint8_t(SHIFT_KEYPAD_MASK & ~(1U << row)));
    delayMicroseconds(20);
    for (uint8_t col = 0; col < 4; ++col) if (digitalRead(PIN_KEYPAD_COLUMNS[col]) == LOW) { raw = KEYS[row][col]; break; }
  }
  writeShiftRegister();
  if (raw != lastRaw) { lastRaw = raw; changedAt = millis(); }
  if (millis() - changedAt >= 30) { if (raw && raw != reported) { reported = raw; return raw; } if (!raw) reported = 0; }
  return 0;
}
void processKey(char key) {
  Serial.printf("Keypad: %c\n", key);
  if (key == '*') { pinEntry = ""; showTemporaryMessage("PIN cleared", "Enter PIN:", 1000); return; }
  if (key == '#') {
    if (pinEntry == ACCESS_PIN) { invalidPinAttempts = 0; openGate(); }
    else { ++invalidPinAttempts; Serial.printf("Invalid PIN attempt %u\n", invalidPinAttempts); showTemporaryMessage("Access denied", "Invalid PIN"); if (invalidPinAttempts >= INVALID_PIN_ALERT_COUNT) { invalidPinAttempts = 0; triggerSecurityEvent("Repeated bad PIN"); } }
    pinEntry = ""; return;
  }
  if (key == 'A') { securityArmed = true; showTemporaryMessage("Security", "ARMED"); return; }
  if (key == 'B') { securityArmed = false; setAlarm(false); showTemporaryMessage("Security", "DISARMED"); return; }
  if (key == 'C') { showTemporaryMessage("Tank " + String(tankReadingValid ? String(tankPercent) + "%" : "ERROR"), "Pump " + String(pumpOn ? "ON " : "OFF ") + modeName(pumpMode)); return; }
  if (key == 'D') { outsideLightMode = outsideLightMode == ControlMode::Auto ? ControlMode::On : outsideLightMode == ControlMode::On ? ControlMode::Off : ControlMode::Auto; showTemporaryMessage("Outside light", modeName(outsideLightMode)); return; }
  if (key >= '0' && key <= '9' && pinEntry.length() < 8) {
    pinEntry += key;
    String masked;
    for (size_t i = 0; i < pinEntry.length(); ++i) masked += '*';
    lcdLines("Enter PIN:", masked);
  }
}

// ======================================================
// RFID (SS is explicitly high whenever not reading)
// ======================================================
String getRfidUid() {
  String uid;
  for (byte i = 0; i < rfid.uid.size; ++i) { if (i) uid += ' '; if (rfid.uid.uidByte[i] < 0x10) uid += '0'; uid += String(rfid.uid.uidByte[i], HEX); }
  uid.toUpperCase(); return uid;
}
bool isAuthorizedTag(const String &uid) { for (size_t i = 0; i < AUTHORIZED_RFID_UID_COUNT; ++i) if (uid.equalsIgnoreCase(AUTHORIZED_RFID_UIDS[i])) return true; return false; }
void handleRfid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  lastRfidUid = getRfidUid(); Serial.println("RFID UID: " + lastRfidUid);
  if (isAuthorizedTag(lastRfidUid)) { unauthorizedRfidAttempts = 0; openGate(); }
  else { ++unauthorizedRfidAttempts; Serial.println("RFID ACCESS DENIED: " + lastRfidUid); showTemporaryMessage("RFID denied", lastRfidUid); if (unauthorizedRfidAttempts >= UNAUTHORIZED_RFID_ALERT_COUNT) { unauthorizedRfidAttempts = 0; triggerSecurityEvent("Bad RFID scans"); } }
  rfid.PICC_HaltA(); rfid.PCD_StopCrypto1(); digitalWrite(PIN_RFID_SS, HIGH);
}

// ======================================================
// CLIMATE / WATER / LIGHT AUTOMATION
// ======================================================
void updateClimate() {
  humidityPercent = dht.readHumidity(); temperatureC = dht.readTemperature();
  climateReadingValid = !isnan(humidityPercent) && !isnan(temperatureC);
  if (!climateReadingValid) { Serial.println("DHT read failed; AUTO fan OFF"); if (fanMode == ControlMode::Auto) setFan(false); return; }
  Serial.printf("DHT: %.1f C, %.1f %%\n", temperatureC, humidityPercent);
  if (fanMode == ControlMode::Auto) { if (!fanOn && temperatureC >= FAN_ON_C) setFan(true); else if (fanOn && temperatureC <= FAN_OFF_C) setFan(false); }
}
void applyFanMode() { if (fanMode == ControlMode::On) setFan(true); else if (fanMode == ControlMode::Off) setFan(false); else if (!climateReadingValid) setFan(false); }

void updateTank() {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW); delayMicroseconds(2); digitalWrite(PIN_ULTRASONIC_TRIG, HIGH); delayMicroseconds(10); digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  unsigned long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000UL);
  tankDistanceCm = duration ? duration * 0.0343F / 2.0F : NAN;
  tankReadingValid = duration && tankDistanceCm >= 1.0F && tankDistanceCm <= 500.0F;
  if (!tankReadingValid) { Serial.println("Tank sensor invalid; AUTO pump fails safe OFF"); if (pumpMode == ControlMode::Auto) setPump(false); return; }
  float pct = 100.0F * (TANK_EMPTY_DISTANCE_CM - tankDistanceCm) / (TANK_EMPTY_DISTANCE_CM - TANK_FULL_DISTANCE_CM);
  tankPercent = constrain(int(roundf(pct)), 0, 100);
  Serial.printf("Tank: %.1f cm, %d%%; pump %s/%s\n", tankDistanceCm, tankPercent, modeName(pumpMode), pumpOn ? "ON" : "OFF");
  if (pumpMode == ControlMode::Auto) { if (!pumpOn && tankPercent <= PUMP_START_PERCENT) { Serial.println("Pump start threshold crossed"); setPump(true); } else if (pumpOn && tankPercent >= PUMP_STOP_PERCENT) { Serial.println("Pump stop threshold crossed"); setPump(false); } }
}
void applyPumpSafety() {
  if (pumpMode == ControlMode::On && !pumpOn) setPump(true);
  if (pumpMode == ControlMode::Off && pumpOn) setPump(false);
  if (pumpOn && millis() - pumpStartedAt >= MAX_PUMP_RUNTIME_MS) { Serial.println("Pump safety timeout reached"); setPump(false); }
}
void setInsideLight(bool on) {
  if (insideLightOn == on) return; insideLightOn = on;
  uint32_t color = on ? insideStrip.Color(255, 150, 70) : 0;
  for (uint16_t i = 0; i < insideStrip.numPixels(); ++i) insideStrip.setPixelColor(i, color);
  insideStrip.show();
}
void updateLights() {
  photoresistorAdc = analogRead(PIN_PHOTORESISTOR); Serial.printf("Photoresistor GPIO36 ADC: %d\n", photoresistorAdc);
  if (outsideLightMode == ControlMode::On) setOutsideLight(true);
  else if (outsideLightMode == ControlMode::Off) setOutsideLight(false);
  else if (!outsideLightOn && photoresistorAdc <= OUTSIDE_DARK_ADC) setOutsideLight(true);
  else if (outsideLightOn && photoresistorAdc >= OUTSIDE_BRIGHT_ADC) setOutsideLight(false);
  if (insideLightMode == ControlMode::On) setInsideLight(true);
  else if (insideLightMode == ControlMode::Off) setInsideLight(false);
  else setInsideLight(lastMotionAt != 0 && millis() - lastMotionAt < INSIDE_LIGHT_TIMEOUT_MS);
}

// ======================================================
// WI-FI / BACKEND (small isolated HTTP adapter)
// ======================================================
void connectWiFi() {
  if (!BACKEND_ENABLED || WiFi.status() == WL_CONNECTED) return;
  lastWiFiAttemptAt = millis(); WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Wi-Fi connection started (local automation remains active)");
}
void maintainWiFi() { if (BACKEND_ENABLED && WiFi.status() != WL_CONNECTED && millis() - lastWiFiAttemptAt >= WIFI_RETRY_MS) connectWiFi(); }
void addBackendHeaders(HTTPClient &http) { http.addHeader("Content-Type", "application/json"); http.addHeader("X-Device-Id", DEVICE_ID); http.addHeader("X-API-Key", DEVICE_API_KEY); }
void sendTelemetry() {
  if (!BACKEND_ENABLED || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http; http.setTimeout(HTTP_TIMEOUT_MS); if (!http.begin(String(BACKEND_BASE_URL) + "/telemetry")) return; addBackendHeaders(http);
  String json = "{\"temperature\":" + String(temperatureC, 1) + ",\"humidity\":" + String(humidityPercent, 1) +
    ",\"fanOn\":" + String(fanOn ? "true" : "false") + ",\"fanMode\":\"" + modeName(fanMode) + "\",\"tankPercent\":" + String(tankPercent) +
    ",\"tankDistanceCm\":" + String(tankDistanceCm, 1) + ",\"pumpOn\":" + String(pumpOn ? "true" : "false") + ",\"pumpMode\":\"" + modeName(pumpMode) +
    "\",\"gateOpen\":" + String(gateOpen ? "true" : "false") + ",\"securityArmed\":" + String(securityArmed ? "true" : "false") +
    ",\"motion\":" + String(pirMotion ? "true" : "false") + ",\"outsideLightOn\":" + String(outsideLightOn ? "true" : "false") +
    ",\"outsideLightMode\":\"" + modeName(outsideLightMode) + "\",\"insideLightOn\":" + String(insideLightOn ? "true" : "false") +
    ",\"insideLightMode\":\"" + modeName(insideLightMode) + "\",\"wifiRssi\":" + String(WiFi.RSSI()) + "}";
  int code = http.POST(json); Serial.printf("Telemetry HTTP: %d\n", code); http.end();
}
ControlMode parseMode(String value) { value.trim(); value.toLowerCase(); return value == "on" ? ControlMode::On : value == "off" ? ControlMode::Off : ControlMode::Auto; }
void executeRemoteCommand(String command) {
  command.trim(); Serial.println("Remote command: " + command);
  if (command == "OPEN_GATE") openGate(); else if (command == "CLOSE_GATE") closeGate();
  else if (command.startsWith("SET_SECURITY:")) { String v = command.substring(command.indexOf(':') + 1); v.toLowerCase(); securityArmed = v == "on" || v == "true" || v == "armed"; }
  else if (command.startsWith("SET_FAN_MODE:")) { fanMode = parseMode(command.substring(command.indexOf(':') + 1)); applyFanMode(); }
  else if (command.startsWith("SET_PUMP_MODE:")) { pumpMode = parseMode(command.substring(command.indexOf(':') + 1)); applyPumpSafety(); }
  else if (command.startsWith("SET_OUTSIDE_LIGHT_MODE:")) outsideLightMode = parseMode(command.substring(command.indexOf(':') + 1));
  else if (command.startsWith("SET_INSIDE_LIGHT_MODE:")) insideLightMode = parseMode(command.substring(command.indexOf(':') + 1));
  else if (command == "TRIGGER_ALARM") setAlarm(true); else if (command == "STOP_ALARM") setAlarm(false);
}
void pollCommands() {
  if (!BACKEND_ENABLED || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http; http.setTimeout(HTTP_TIMEOUT_MS); if (!http.begin(String(BACKEND_BASE_URL) + "/commands/next?deviceId=" + DEVICE_ID)) return; addBackendHeaders(http);
  int code = http.GET(); if (code == HTTP_CODE_OK) { String command = http.getString(); if (command.length()) executeRemoteCommand(command); } http.end();
}

// ======================================================
// LCD / SERIAL DIAGNOSTICS
// ======================================================
void updateLcdPage() {
  if (pinEntry.length() || millis() < temporaryMessageUntil) return;
  switch (lcdPage++ % 6) {
    case 0: lcdLines("Smart Home", String(securityArmed ? "ARMED " : "DISARMED ") + (gateOpen ? "Gate OPEN" : "Gate shut")); break;
    case 1: lcdLines(climateReadingValid ? String(temperatureC, 1) + "C " + String(humidityPercent, 0) + "%" : "DHT unavailable", "Fan " + String(fanOn ? "ON " : "OFF ") + modeName(fanMode)); break;
    case 2: lcdLines(tankReadingValid ? "Tank " + String(tankPercent) + "%" : "Tank ERROR", "Pump " + String(pumpOn ? "ON " : "OFF ") + modeName(pumpMode)); break;
    case 3: lcdLines("Security", securityArmed ? "ARMED" : "DISARMED"); break;
    case 4: lcdLines("Outside " + String(outsideLightOn ? "ON" : "OFF"), String(modeName(outsideLightMode)) + " ADC " + photoresistorAdc); break;
    default: lcdLines("WiFi/backend", !BACKEND_ENABLED ? "Disabled" : WiFi.status() == WL_CONNECTED ? "Connected" : "Offline/local OK"); break;
  }
}
void printStatus() {
  Serial.println("\n--- SMART HOME STATUS ---"); Serial.printf("RFID last UID: %s\n", lastRfidUid.c_str());
  Serial.printf("Temperature/humidity: %.1f C / %.1f %% (valid %s)\n", temperatureC, humidityPercent, climateReadingValid ? "yes" : "no");
  Serial.printf("Tank: %.1f cm / %d%% (valid %s)\n", tankDistanceCm, tankPercent, tankReadingValid ? "yes" : "no");
  Serial.printf("Fan %s/%s; pump %s/%s; outside %s/%s; inside %s/%s\n", modeName(fanMode), fanOn ? "ON" : "OFF", modeName(pumpMode), pumpOn ? "ON" : "OFF", modeName(outsideLightMode), outsideLightOn ? "ON" : "OFF", modeName(insideLightMode), insideLightOn ? "ON" : "OFF");
  Serial.printf("PIR %s; gate %s; security %s; GSM %s; WiFi %s; backend %s\n", pirMotion ? "MOTION" : "clear", gateOpen ? "OPEN" : "CLOSED", securityArmed ? "ARMED" : "DISARMED", gsmResponding ? "ready" : "offline", WiFi.status() == WL_CONNECTED ? "connected" : "offline", BACKEND_ENABLED ? "enabled" : "disabled");
}
void handleSerialDiagnostics() {
  while (Serial.available()) { char c = Serial.read(); if (c == '1') { Serial.println("Temporary pump ON test"); setPump(true); pumpStartedAt = millis(); } else if (c == '0') setPump(false); else if (c == 'f') { setFan(!fanOn); Serial.println("Temporary fan test; AUTO will re-evaluate"); } else if (c == 'g') openGate(); else if (c == 'l') { setOutsideLight(!outsideLightOn); Serial.println("Temporary outside-light test; AUTO will re-evaluate"); } else if (c == 'r') Serial.println("Last RFID UID: " + lastRfidUid); else if (c == 's') printStatus(); }
}

// ======================================================
// SETUP / RESPONSIVE LOOP
// ======================================================
void setup() {
  Serial.begin(115200); Serial.println("\nESP32 Smart Home starting safely...");
  pinMode(PIN_RFID_SS, OUTPUT); digitalWrite(PIN_RFID_SS, HIGH);
  pinMode(PIN_SHIFT_LATCH, OUTPUT); pinMode(PIN_SPI_SCK_SHIFT_CLOCK, OUTPUT); pinMode(PIN_SPI_MOSI_SHIFT_DATA, OUTPUT);
  // Desired safe boot image: fan/pump/alarm off; relay gets its configured OFF level.
  shiftActuatorBits = OUTSIDE_RELAY_ACTIVE_LOW ? SHIFT_OUTSIDE : 0; writeShiftRegister();
  for (uint8_t pin : PIN_KEYPAD_COLUMNS) pinMode(pin, INPUT_PULLUP);
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT); digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT); pinMode(PIN_PIR, INPUT); pinMode(PIN_PHOTORESISTOR, INPUT);
  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL); lcd.init(); lcd.backlight(); lcdLines("Smart Home", "Starting safely");
  insideStrip.begin(); insideStrip.setBrightness(WS2812_BRIGHTNESS); insideStrip.clear(); insideStrip.show();
  gateServo.setPeriodHertz(50); gateServo.attach(PIN_SERVO, 500, 2400); closeGate(); dht.begin();
  SPI.begin(PIN_SPI_SCK_SHIFT_CLOCK, PIN_RFID_MISO, PIN_SPI_MOSI_SHIFT_DATA, PIN_RFID_SS); rfid.PCD_Init(); digitalWrite(PIN_RFID_SS, HIGH); Serial.println("RC522 initialized");
  if (GSM_ENABLED) { gsmSerial.begin(GSM_BAUD_RATE, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX); gsmSerial.println("AT"); gsmResponding = waitForGsmResponse(800); if (gsmResponding) { gsmSerial.println("AT+CMGF=1"); gsmResponding = waitForGsmResponse(800); } Serial.println(gsmResponding ? "GSM ready" : "GSM unavailable; continuing locally"); }
  connectWiFi(); lastDhtAt = lastTankAt = lastLightAt = millis(); Serial.println("System ready. Diagnostics: 1 0 f g l r s");
}
void loop() {
  unsigned long now = millis();
  handlePir(); if (char key = scanKeypad()) processKey(key); handleRfid(); maintainGate(); maintainWiFi(); handleSerialDiagnostics(); applyPumpSafety();
  if (now - lastDhtAt >= DHT_INTERVAL_MS) { lastDhtAt = now; updateClimate(); applyFanMode(); }
  if (now - lastTankAt >= TANK_INTERVAL_MS) { lastTankAt = now; updateTank(); }
  if (now - lastLightAt >= LIGHT_INTERVAL_MS) { lastLightAt = now; updateLights(); }
  if (now - lastLcdAt >= LCD_PAGE_INTERVAL_MS) { lastLcdAt = now; updateLcdPage(); }
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) { lastTelemetryAt = now; sendTelemetry(); }
  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) { lastCommandPollAt = now; pollCommands(); }
  if (now - lastStatusAt >= STATUS_INTERVAL_MS) { lastStatusAt = now; printStatus(); }
}
