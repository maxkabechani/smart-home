import { eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { bulbState, type BulbStateRow } from "./schema.js";

export type BulbState = {
  enabled: boolean;
  pendingRfid: boolean;
  requestedAt: string | null;
  authorizedAt: string | null;
  lastRfidUid: string | null;
  lastRfidStatus: "authorized" | "denied" | "ignored" | null;
  lastRfidAt: string | null;
  updatedAt: string;
};

function toBulbState(row: BulbStateRow): BulbState {
  return {
    enabled: row.enabled,
    pendingRfid: row.pendingRfid,
    requestedAt: row.requestedAt,
    authorizedAt: row.authorizedAt,
    lastRfidUid: row.lastRfidUid,
    lastRfidStatus: row.lastRfidStatus,
    lastRfidAt: row.lastRfidAt,
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

  return switchBulbOff();
}

export async function requestBulbOn(): Promise<BulbState> {
  const row = await db
    .insert(bulbState)
    .values({ id: 1, enabled: false, pendingRfid: true })
    .onConflictDoUpdate({
      target: bulbState.id,
      set: {
        enabled: false,
        pendingRfid: true,
        requestedAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        updatedAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      },
    })
    .returning()
    .get();

  return toBulbState(row);
}

export async function switchBulbOff(): Promise<BulbState> {
  const row = await db
    .insert(bulbState)
    .values({ id: 1, enabled: false, pendingRfid: false })
    .onConflictDoUpdate({
      target: bulbState.id,
      set: {
        enabled: false,
        pendingRfid: false,
        updatedAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      },
    })
    .returning()
    .get();

  return toBulbState(row);
}

export async function recordRfidScan(
  uid: string,
  allowed: boolean,
): Promise<BulbState> {
  const current = await getBulbState();
  const status = current.pendingRfid
    ? allowed
      ? "authorized"
      : "denied"
    : "ignored";

  const row = await db
    .update(bulbState)
    .set({
      enabled: status === "authorized" ? true : current.enabled,
      pendingRfid: status === "authorized" ? false : current.pendingRfid,
      authorizedAt:
        status === "authorized"
          ? sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
          : current.authorizedAt,
      lastRfidUid: uid,
      lastRfidStatus: status,
      lastRfidAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      updatedAt: sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    })
    .where(eq(bulbState.id, 1))
    .returning()
    .get();

  return toBulbState(row);
}
