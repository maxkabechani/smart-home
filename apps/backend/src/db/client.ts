import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { env } from "../env.js";
import { bulbStateMigrationSql, createReadingsTableSql } from "./schema.js";
import * as schema from "./schema.js";

const sqlite = new DatabaseSync(env.databaseFile);

export const db = drizzle({ client: sqlite, schema });

export async function initializeDatabase() {
  sqlite.exec(createReadingsTableSql);

  for (const statement of bulbStateMigrationSql) {
    try {
      sqlite.exec(statement);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
        throw error;
      }
    }
  }
}
