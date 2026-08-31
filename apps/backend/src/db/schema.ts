import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deviceTelemetry = sqliteTable("device_telemetry", {
  deviceId: text("device_id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const deviceCommands = sqliteTable(
  "device_commands",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: text("device_id").notNull(),
    command: text("command").notNull(),
    createdAt: text("created_at").notNull(),
    deliveredAt: text("delivered_at"),
  },
  (table) => [index("device_commands_pending_idx").on(table.deviceId, table.deliveredAt, table.id)],
);

export const createSmartHomeTablesSql = `
CREATE TABLE IF NOT EXISTS device_telemetry (
  device_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  command TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS device_commands_pending_idx
  ON device_commands (device_id, delivered_at, id);
`;
