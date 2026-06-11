import { desc, gte } from "drizzle-orm";
import type { ReadingInput } from "../schemas/readings.schema.js";
import { db } from "./client.js";
import { sensorReadings, type SensorReadingRow } from "./schema.js";

export type SensorReading = {
  temperature: number;
  humidity: number;
  status: "online";
  createdAt: string;
};

function toSensorReading(row: SensorReadingRow): SensorReading {
  return {
    temperature: row.temperature,
    humidity: row.humidity,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function createReading(input: ReadingInput): Promise<SensorReading> {
  const result = await db
    .insert(sensorReadings)
    .values({
      temperature: input.temperature,
      humidity: input.humidity,
      status: "online",
    })
    .returning()
    .get();

  return toSensorReading(result);
}

export async function findLatestReading(): Promise<SensorReading | null> {
  const reading = await db
    .select()
    .from(sensorReadings)
    .orderBy(desc(sensorReadings.createdAt), desc(sensorReadings.id))
    .limit(1)
    .get() as SensorReadingRow | undefined;

  return reading ? toSensorReading(reading) : null;
}

export async function findReadingsSince(
  since: string,
): Promise<SensorReading[]> {
  const rows = await db
    .select()
    .from(sensorReadings)
    .where(gte(sensorReadings.createdAt, since))
    .orderBy(desc(sensorReadings.createdAt), desc(sensorReadings.id))
    .all() as SensorReadingRow[];

  return rows.reverse().map(toSensorReading);
}
