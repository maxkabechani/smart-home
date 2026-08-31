import type { TelemetryInput } from "../schemas/smart-home.schema.js";

export type SmartHomeState = TelemetryInput & { deviceId: string; updatedAt: string };
type SmartHomeSocket = {
  readyState: number;
  send: (data: string) => void;
  on: (event: "close" | "error", listener: () => void) => void;
};

const clients = new Map<string, Set<SmartHomeSocket>>();

export function addSmartHomeClient(deviceId: string, socket: SmartHomeSocket, state: SmartHomeState | null, online: boolean) {
  const deviceClients = clients.get(deviceId) ?? new Set<SmartHomeSocket>();
  deviceClients.add(socket);
  clients.set(deviceId, deviceClients);
  socket.send(JSON.stringify({ type: "smart-home.state", data: state, online }));
  const remove = () => {
    deviceClients.delete(socket);
    if (deviceClients.size === 0) clients.delete(deviceId);
  };
  socket.on("close", remove);
  socket.on("error", remove);
}

export function broadcastSmartHomeState(state: SmartHomeState) {
  broadcast(state.deviceId, { type: "smart-home.state", data: state, online: true });
}

export function broadcastCommandQueued(deviceId: string, command: string) {
  broadcast(deviceId, { type: "smart-home.command-queued", data: { command } });
}

function broadcast(deviceId: string, payload: unknown) {
  const deviceClients = clients.get(deviceId);
  if (!deviceClients) return;
  const message = JSON.stringify(payload);
  for (const client of deviceClients) {
    if (client.readyState === 1) client.send(message);
    else deviceClients.delete(client);
  }
}
