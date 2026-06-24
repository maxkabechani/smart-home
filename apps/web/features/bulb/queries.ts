"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { buildBulbUrl, buildBulbWsUrl, type BulbResponse } from "./api";

const pollIntervalMs = 5000;

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
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(buildBulbWsUrl());

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data) as
          | { type: "bulb.state"; data: BulbResponse["data"] }
          | undefined;

        if (payload?.type === "bulb.state") {
          queryClient.setQueryData<BulbResponse>(queryKeys.bulb.state(), {
            success: true,
            data: payload.data,
          });
        }
      });

      socket.addEventListener("close", () => {
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
      socket?.close();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.bulb.state(),
    queryFn: fetchBulbState,
    refetchInterval: pollIntervalMs,
  });
}
