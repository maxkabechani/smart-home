"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { buildBulbUrl, type BulbResponse } from "./api";
import { sharedBulbSocket } from "./queries";

async function setBulbState(enabled: boolean): Promise<BulbResponse> {
  if (sharedBulbSocket && sharedBulbSocket.readyState === WebSocket.OPEN) {
    sharedBulbSocket.send(JSON.stringify({ type: "bulb.request", data: { enabled } }));
    return {
      success: true,
      data: {
        enabled,
        pendingRfid: false,
        requestedAt: new Date().toISOString(),
        authorizedAt: null,
        lastRfidUid: null,
        lastRfidStatus: null,
        lastRfidAt: null,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const response = await fetch(buildBulbUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    throw new Error("Failed to update bulb state.");
  }

  return (await response.json()) as BulbResponse;
}

export function useSetBulbStateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setBulbState,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bulb.state(),
      });
    },
  });
}
