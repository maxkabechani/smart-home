import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sensorReadings = sqliteTable(
  "sensor_readings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    temperature: real("temperature").notNull(),
    humidity: real("humidity").notNull(),
    status: text("status", { enum: ["online"] }).notNull().default("online"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [index("sensor_readings_created_at_idx").on(table.createdAt)],
);

export type SensorReadingRow = typeof sensorReadings.$inferSelect;
export type NewSensorReadingRow = typeof sensorReadings.$inferInsert;

export const bulbState = sqliteTable("bulb_state", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type BulbStateRow = typeof bulbState.$inferSelect;

export const createReadingsTableSql = `
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
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO bulb_state (id, enabled)
  VALUES (1, 0);
`;

export const bulbStateMigrationSql = [
];
