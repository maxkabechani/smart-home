import type { FastifyPluginAsync } from "fastify";
import {
  readingInputSchema,
  readingResponseSchema,
  type ReadingInput,
} from "../schemas/readings.schema.js";
import { createReading, findLatestReading } from "../db/readings.repository.js";
import { env } from "../env.js";

const readingsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ReadingInput }>(
    "/readings",
    {
      schema: {
        body: readingInputSchema,
        response: {
          201: readingResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const reading = await createReading(request.body);

      return reply.status(201).send({
        success: true,
        message: "Reading saved successfully",
        data: reading,
      });
    },
  );

  app.get(
    "/readings/latest",
    {
      schema: {
        response: {
          200: readingResponseSchema,
        },
      },
    },
    async () => {
      const reading = await findLatestReading();

      if (!reading) {
        return {
          success: false,
          message: "No sensor reading available yet",
          data: null,
        };
      }

      const createdAtMs = Date.parse(reading.createdAt);
      const staleAfterMs = env.readingStaleAfterSeconds * 1000;
      const isFresh =
        Number.isFinite(createdAtMs) &&
        Date.now() - createdAtMs <= staleAfterMs;

      return {
        success: true,
        data: {
          ...reading,
          status: isFresh ? "online" : "offline",
        },
      };
    },
  );
};

export default readingsRoutes;
