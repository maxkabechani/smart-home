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
`;
