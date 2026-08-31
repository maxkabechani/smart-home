import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = await buildApp();

try {
  await app.listen({ port: env.port, host: env.host });
  app.log.info(`Smart Home API running on http://localhost:${env.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
