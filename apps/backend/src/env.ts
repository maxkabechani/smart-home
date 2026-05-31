import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseFile: process.env.DB_FILE_NAME ?? "temperature-humidity.sqlite",
  readingStaleAfterSeconds: Number.isFinite(
    Number(process.env.READING_STALE_AFTER_SECONDS),
  )
    ? Number(process.env.READING_STALE_AFTER_SECONDS)
    : 30,
};
