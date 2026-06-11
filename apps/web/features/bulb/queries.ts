"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { buildBulbUrl, type BulbResponse } from "./api";

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
  return useQuery({
    queryKey: queryKeys.bulb.state(),
    queryFn: fetchBulbState,
    refetchInterval: pollIntervalMs,
  });
}
