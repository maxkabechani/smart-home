import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { env } from "../env.js";
import { createReadingsTableSql } from "./schema.js";
import * as schema from "./schema.js";

const sqlite = new DatabaseSync(env.databaseFile);

export const db = drizzle({ client: sqlite, schema });

export async function initializeDatabase() {
  sqlite.exec(createReadingsTableSql);
}
