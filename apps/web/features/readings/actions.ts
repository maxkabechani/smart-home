import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { buildReadingsUrl, type ReadingResponse } from "./api";

export async function getLatestReading(): Promise<ReadingResponse> {
  const response = await fetch(buildReadingsUrl("/readings/latest"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the latest reading.");
  }

  return (await response.json()) as ReadingResponse;
}

export async function prefetchLatestReading(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.readings.latest(),
    queryFn: getLatestReading,
  });
}
