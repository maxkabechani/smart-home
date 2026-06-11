"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import {
  buildReadingsUrl,
  type ReadingResponse,
  type ReadingsHistoryResponse,
  type ReadingsHistoryRange,
} from "./api";

const pollIntervalMs = 5000;

async function fetchLatestReading(): Promise<ReadingResponse> {
  const response = await fetch(buildReadingsUrl("/readings/latest"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the latest reading.");
  }

  return (await response.json()) as ReadingResponse;
}

async function fetchReadingsHistory(
  range: ReadingsHistoryRange,
): Promise<ReadingsHistoryResponse> {
  const params = new URLSearchParams({ range });
  const response = await fetch(buildReadingsUrl(`/readings/history?${params}`), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch reading history.");
  }

  return (await response.json()) as ReadingsHistoryResponse;
}

export function useLatestReadingQuery() {
  return useQuery({
    queryKey: queryKeys.readings.latest(),
    queryFn: fetchLatestReading,
    refetchInterval: pollIntervalMs,
  });
}

export function useReadingsHistoryQuery(range: ReadingsHistoryRange) {
  return useQuery({
    queryKey: queryKeys.readings.history(range),
    queryFn: () => fetchReadingsHistory(range),
    refetchInterval: pollIntervalMs,
  });
}
