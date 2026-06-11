import { eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { bulbState, type BulbStateRow } from "./schema.js";

export type BulbState = {
  enabled: boolean;
  updatedAt: string;
};

function toBulbState(row: BulbStateRow): BulbState {
  return {
    enabled: row.enabled,
    updatedAt: row.updatedAt,
  };
}

export async function getBulbState(): Promise<BulbState> {
  const row = await db
    .select()
    .from(bulbState)
    .where(eq(bulbState.id, 1))
    .limit(1)
    .get() as BulbStateRow | undefined;

  if (row) {
    return toBulbState(row);
  }

  return setBulbState(false);
}

export async function setBulbState(enabled: boolean): Promise<BulbState> {
  const row = await db
    .insert(bulbState)
    .values({ id: 1, enabled })
    .onConflictDoUpdate({
      target: bulbState.id,
      set: {
        enabled,
        updatedAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      },
    })
    .returning()
    .get();

  return toBulbState(row);
}
