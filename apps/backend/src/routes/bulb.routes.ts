import type { FastifyPluginAsync } from "fastify";
import {
  getBulbState,
  requestBulbOn,
  switchBulbOff,
} from "../db/bulb.repository.js";
import {
  addBulbClient,
  broadcastBulbState,
} from "../realtime/bulb-events.js";
import {
  bulbInputSchema,
  bulbResponseSchema,
  type BulbInput,
} from "../schemas/bulb.schema.js";

const bulbRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bulb/ws",
    { websocket: true },
    async (socket, request) => {
      addBulbClient(socket, await getBulbState());

      socket.on("message", async (message: Buffer) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.type === "bulb.request" && payload.data && typeof payload.data.enabled === "boolean") {
            const state = payload.data.enabled
              ? await requestBulbOn()
              : await switchBulbOff();
            broadcastBulbState(state);
          }
        } catch (e) {
          request.log.error(e, "Failed to process websocket message");
        }
      });
    },
  );

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
      const state = request.body.enabled
        ? await requestBulbOn()
        : await switchBulbOff();
      broadcastBulbState(state);

      return {
        success: true,
        data: state,
      };
    },
  );
};

export default bulbRoutes;
