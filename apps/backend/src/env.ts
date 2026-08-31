import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseFile: process.env.DB_FILE_NAME ?? "temperature-humidity.sqlite",
  deviceApiKey: process.env.DEVICE_API_KEY ?? "",
  deviceStaleAfterSeconds: Number(process.env.DEVICE_STALE_AFTER_SECONDS ?? 45),
};
