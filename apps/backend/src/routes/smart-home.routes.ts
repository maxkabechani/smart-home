import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { enqueueCommand, getTelemetry, saveTelemetry, takeNextCommand } from "../db/smart-home.repository.js";
import { commandInputSchema, isSmartHomeCommand, telemetryInputSchema, type CommandInput, type TelemetryInput } from "../schemas/smart-home.schema.js";
import { addSmartHomeClient, broadcastCommandQueued, broadcastSmartHomeState } from "../realtime/smart-home-events.js";

function deviceId(request: FastifyRequest) {
  const queryId = (request.query as { deviceId?: string } | undefined)?.deviceId;
  return String(request.headers["x-device-id"] ?? queryId ?? "esp32-home-01");
}

function authorizeDevice(request: FastifyRequest) {
  return !env.deviceApiKey || request.headers["x-api-key"] === env.deviceApiKey;
}

const smartHomeRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: TelemetryInput }>("/telemetry", { schema: { body: telemetryInputSchema } }, async (request, reply) => {
    if (!authorizeDevice(request)) return reply.status(401).send({ success: false, message: "Invalid device API key" });
    const data = await saveTelemetry(deviceId(request), request.body);
    broadcastSmartHomeState(data);
    return reply.status(201).send({ success: true, data });
  });

  app.get<{ Querystring: { deviceId?: string } }>("/smart-home/status", async (request) => {
    const data = await getTelemetry(request.query.deviceId ?? "esp32-home-01");
    const online = data ? Date.now() - Date.parse(data.updatedAt) <= env.deviceStaleAfterSeconds * 1000 : false;
    return { success: true, data, online };
  });

  app.post<{ Body: CommandInput }>("/smart-home/commands", { schema: { body: commandInputSchema } }, async (request, reply) => {
    const queued = await enqueueCommand(request.body.deviceId, request.body.command);
    broadcastCommandQueued(request.body.deviceId, request.body.command);
    return reply.status(202).send({ success: true, data: queued });
  });

  app.get<{ Querystring: { deviceId?: string } }>("/smart-home/ws", { websocket: true }, async (socket, request) => {
    const id = request.query.deviceId ?? "esp32-home-01";
    const state = await getTelemetry(id);
    const online = state ? Date.now() - Date.parse(state.updatedAt) <= env.deviceStaleAfterSeconds * 1000 : false;
    addSmartHomeClient(id, socket, state, online);
    socket.on("message", async (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string; command?: string };
        if (message.type === "smart-home.command" && isSmartHomeCommand(message.command)) {
          await enqueueCommand(id, message.command);
          broadcastCommandQueued(id, message.command);
        }
      } catch (error) {
        request.log.warn(error, "Ignored malformed smart-home websocket message");
      }
    });
  });

  // The firmware expects a plain-text response and treats an empty body as no command.
  app.get<{ Querystring: { deviceId?: string } }>("/commands/next", async (request, reply) => {
    if (!authorizeDevice(request)) return reply.status(401).type("text/plain").send("UNAUTHORIZED");
    const command = await takeNextCommand(deviceId(request));
    return reply.type("text/plain").send(command ?? "");
  });
};

export default smartHomeRoutes;
