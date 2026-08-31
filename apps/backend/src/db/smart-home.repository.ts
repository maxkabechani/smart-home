import { and, asc, eq, isNull } from "drizzle-orm";
import type { TelemetryInput } from "../schemas/smart-home.schema.js";
import { db } from "./client.js";
import { deviceCommands, deviceTelemetry } from "./schema.js";

export async function saveTelemetry(deviceId: string, telemetry: TelemetryInput) {
  const updatedAt = new Date().toISOString();
  await db.insert(deviceTelemetry).values({ deviceId, payload: JSON.stringify(telemetry), updatedAt })
    .onConflictDoUpdate({ target: deviceTelemetry.deviceId, set: { payload: JSON.stringify(telemetry), updatedAt } }).run();
  return { ...telemetry, deviceId, updatedAt };
}

export async function getTelemetry(deviceId: string) {
  const row = await db.select().from(deviceTelemetry).where(eq(deviceTelemetry.deviceId, deviceId)).get();
  return row ? { ...(JSON.parse(row.payload) as TelemetryInput), deviceId, updatedAt: row.updatedAt } : null;
}

export async function enqueueCommand(deviceId: string, command: string) {
  const createdAt = new Date().toISOString();
  return db.insert(deviceCommands).values({ deviceId, command, createdAt }).returning().get();
}

export async function takeNextCommand(deviceId: string) {
  const pending = await db.select().from(deviceCommands)
    .where(and(eq(deviceCommands.deviceId, deviceId), isNull(deviceCommands.deliveredAt)))
    .orderBy(asc(deviceCommands.id)).limit(1).get();
  if (!pending) return null;
  await db.update(deviceCommands).set({ deliveredAt: new Date().toISOString() }).where(eq(deviceCommands.id, pending.id)).run();
  return pending.command;
}
