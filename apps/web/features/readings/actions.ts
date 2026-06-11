import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import {
  buildReadingsUrl,
  type ReadingResponse,
  type ReadingsHistoryRange,
  type ReadingsHistoryResponse,
} from "./api";

export async function getLatestReading(): Promise<ReadingResponse> {
  const response = await fetch(buildReadingsUrl("/readings/latest"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the latest reading.");
  }

  return (await response.json()) as ReadingResponse;
}

export async function getReadingsHistory(
  range: ReadingsHistoryRange = "day",
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

export async function prefetchLatestReading(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.readings.latest(),
    queryFn: getLatestReading,
  });
}

export async function prefetchReadingsHistory(
  queryClient: QueryClient,
  range: ReadingsHistoryRange = "day",
) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.readings.history(range),
    queryFn: () => getReadingsHistory(range),
  });
}
