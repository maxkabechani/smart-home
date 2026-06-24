import type { FastifyPluginAsync } from "fastify";
import {
  getBulbState,
  recordRfidScan,
  requestBulbOn,
  switchBulbOff,
} from "../db/bulb.repository.js";
import {
  bulbInputSchema,
  bulbResponseSchema,
  rfidScanInputSchema,
  type BulbInput,
  type RfidScanInput,
} from "../schemas/bulb.schema.js";

function normalizeUid(uid: string) {
  return uid.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function getAllowedRfidUids() {
  return new Set(
    (process.env.ALLOWED_RFID_UIDS ?? "")
      .split(",")
      .map((uid) => normalizeUid(uid))
      .filter(Boolean),
  );
}

const bulbRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bulb",
    {
      schema: {
        response: {
          200: bulbResponseSchema,
        },
      },
    },
    async () => {
      return {
        success: true,
        data: await getBulbState(),
      };
    },
  );

  app.post<{ Body: BulbInput }>(
    "/bulb",
    {
      schema: {
        body: bulbInputSchema,
        response: {
          200: bulbResponseSchema,
        },
      },
    },
    async (request) => {
      return {
        success: true,
        data: request.body.enabled
          ? await requestBulbOn()
          : await switchBulbOff(),
      };
    },
  );

  app.post<{ Body: RfidScanInput }>(
    "/bulb/rfid-scan",
    {
      schema: {
        body: rfidScanInputSchema,
        response: {
          200: bulbResponseSchema,
        },
      },
    },
    async (request) => {
      const uid = normalizeUid(request.body.uid);
      const allowedUids = getAllowedRfidUids();
      const isAllowed = allowedUids.size === 0 || allowedUids.has(uid);

      return {
        success: true,
        data: await recordRfidScan(uid, isAllowed),
      };
    },
  );
};

export default bulbRoutes;
