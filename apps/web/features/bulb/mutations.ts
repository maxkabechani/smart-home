"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { buildBulbUrl, type BulbResponse } from "./api";

async function setBulbState(enabled: boolean): Promise<BulbResponse> {
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
