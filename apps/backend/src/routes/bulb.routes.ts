import type { FastifyPluginAsync } from "fastify";
import { getBulbState, setBulbState } from "../db/bulb.repository.js";
import {
  bulbInputSchema,
  bulbResponseSchema,
  type BulbInput,
} from "../schemas/bulb.schema.js";

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
        data: await setBulbState(request.body.enabled),
      };
    },
  );
};

export default bulbRoutes;
