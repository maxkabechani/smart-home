#include <HTTPClient.h>
#include <WiFi.h>
#include "DHT.h"

#define DHTPIN 14
#define DHTTYPE DHT11

const char* WIFI_SSID = "ODIN";
const char* WIFI_PASSWORD = "TheForce";

// Update this once you know the backend IP and port.
const char* API_URL = "https://api.temp.maxkabechani.dev/readings";

const unsigned long READ_INTERVAL_MS = 5000;
unsigned long lastReadAt = 0;

DHT dht(DHTPIN, DHTTYPE);

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

void setup() {
  Serial.begin(115200);
  Serial.println("DHT11 test with HTTP POST");
  dht.begin();
  connectWiFi();
}

void loop() {
  const unsigned long now = millis();
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
    return;
  }

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.print(" %\t");
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" *C");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping POST (WiFi not connected).");
    return;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");

  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"temperature\":%.2f,\"humidity\":%.2f}",
           temperature, humidity);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.print("POST response code: ");
    Serial.println(httpCode);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.print("POST failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}
