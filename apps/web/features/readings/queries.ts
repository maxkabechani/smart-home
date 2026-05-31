"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { buildReadingsUrl, type ReadingResponse } from "./api";

const pollIntervalMs = 5000;

async function fetchLatestReading(): Promise<ReadingResponse> {
  const response = await fetch(buildReadingsUrl("/api/readings/latest"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the latest reading.");
  }

  return (await response.json()) as ReadingResponse;
}

export function useLatestReadingQuery() {
  return useQuery({
    queryKey: queryKeys.readings.latest(),
    queryFn: fetchLatestReading,
    refetchInterval: pollIntervalMs,
  });
}
