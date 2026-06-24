import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { FastifyError } from "fastify";
import fastify from "fastify";
import { initializeDatabase } from "./db/client.js";
import bulbRoutes from "./routes/bulb.routes.js";
import readingsRoutes from "./routes/readings.routes.js";

export async function buildApp() {
  await initializeDatabase();

  const isProd = process.env.NODE_ENV === "production";

  const app = fastify({
    logger: isProd
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        },
  });

  app.register(cors, {
    origin: true,
  });
  app.register(websocket);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        message: "Invalid request payload",
      });
    }

    return reply.status(error.statusCode ?? 500).send({
      success: false,
      message: error.message || "Internal server error",
    });
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      message: "Temperature and humidity API is running",
    };
  });

  app.register(readingsRoutes);
  app.register(bulbRoutes);

  return app;
}
