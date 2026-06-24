"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { buildBulbUrl, buildBulbWsUrl, type BulbResponse } from "./api";

const pollIntervalMs = 5000;

export let sharedBulbSocket: WebSocket | null = null;

async function fetchBulbState(): Promise<BulbResponse> {
  const response = await fetch(buildBulbUrl(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bulb state.");
  }

  return (await response.json()) as BulbResponse;
}

export function useBulbStateQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      sharedBulbSocket = new WebSocket(buildBulbWsUrl());

      sharedBulbSocket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data) as
          | {
              type: "bulb.state" | "rfid.scan";
              data: BulbResponse["data"];
            }
          | undefined;

        if (payload?.type === "bulb.state" || payload?.type === "rfid.scan") {
          queryClient.setQueryData<BulbResponse>(queryKeys.bulb.state(), {
            success: true,
            data: payload.data,
          });
        }
      });

      sharedBulbSocket.addEventListener("close", () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      sharedBulbSocket?.close();
      sharedBulbSocket = null;
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.bulb.state(),
    queryFn: fetchBulbState,
    refetchInterval: pollIntervalMs,
  });
}
