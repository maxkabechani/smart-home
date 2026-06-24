import type { BulbState } from "../db/bulb.repository.js";

type BulbSocket = {
  readyState: number;
  send: (data: string) => void;
  on: (event: "close" | "error", listener: () => void) => void;
};

const openReadyState = 1;
const clients = new Set<BulbSocket>();

function serializeBulbState(state: BulbState) {
  return JSON.stringify({
    type: "bulb.state",
    data: state,
  });
}

export function addBulbClient(socket: BulbSocket, initialState: BulbState) {
  clients.add(socket);
  socket.send(serializeBulbState(initialState));

  const removeClient = () => clients.delete(socket);
  socket.on("close", removeClient);
  socket.on("error", removeClient);
}

export function broadcastBulbState(state: BulbState) {
  const message = serializeBulbState(state);

  for (const client of clients) {
    if (client.readyState === openReadyState) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  }
}
