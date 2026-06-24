CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS sensor_readings_created_at_idx
  ON sensor_readings (created_at DESC);

CREATE TABLE IF NOT EXISTS bulb_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  pending_rfid INTEGER NOT NULL DEFAULT 0 CHECK (pending_rfid IN (0, 1)),
  requested_at TEXT,
  authorized_at TEXT,
  last_rfid_uid TEXT,
  last_rfid_status TEXT CHECK (
    last_rfid_status IS NULL OR last_rfid_status IN ('authorized', 'denied', 'ignored')
  ),
  last_rfid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO bulb_state (id, enabled)
  VALUES (1, 0);
