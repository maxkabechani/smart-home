import type { FastifyPluginAsync } from "fastify";
import {
  readingInputSchema,
  readingResponseSchema,
  readingsHistoryResponseSchema,
  type ReadingInput,
} from "../schemas/readings.schema.js";
import {
  createReading,
  findLatestReading,
  findReadingsSince,
} from "../db/readings.repository.js";
import { env } from "../env.js";

type ReadingHistoryRange = "day" | "week" | "month";

const historyRangeToMs: Record<ReadingHistoryRange, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const maxHistoryPoints = 240;

function buildReadingStatus(createdAt: string) {
  const createdAtMs = Date.parse(createdAt);
  const staleAfterMs = env.readingStaleAfterSeconds * 1000;

  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs <= staleAfterMs
    ? "online"
    : "offline";
}

function normalizeHistoryRange(range: unknown): ReadingHistoryRange {
  return range === "week" || range === "month" ? range : "day";
}

function buildHistoryStart(range: ReadingHistoryRange) {
  return new Date(Date.now() - historyRangeToMs[range]).toISOString();
}

function downsampleReadings<T>(readings: T[], maxPoints = maxHistoryPoints) {
  if (readings.length <= maxPoints) {
    return readings;
  }

  const step = readings.length / maxPoints;

  return Array.from({ length: maxPoints }, (_, index) => {
    return readings[Math.floor(index * step)];
  });
}

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

      return {
        success: true,
        data: {
          ...reading,
          status: buildReadingStatus(reading.createdAt),
        },
      };
    },
  );

  app.get<{ Querystring: { range?: ReadingHistoryRange } }>(
    "/readings/history",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            range: {
              type: "string",
              enum: ["day", "week", "month"],
            },
          },
        },
        response: {
          200: readingsHistoryResponseSchema,
        },
      },
    },
    async (request) => {
      const range = normalizeHistoryRange(request.query.range);
      const readings = await findReadingsSince(buildHistoryStart(range));

      return {
        success: true,
        data: downsampleReadings(readings).map((reading) => ({
          ...reading,
          status: buildReadingStatus(reading.createdAt),
        })),
      };
    },
  );
};

export default readingsRoutes;
