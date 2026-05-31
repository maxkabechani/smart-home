"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import {
  buildReadingsUrl,
  type ReadingInput,
  type ReadingResponse,
} from "./api";

async function createReading(input: ReadingInput): Promise<ReadingResponse> {
  const response = await fetch(buildReadingsUrl("/api/readings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to create a new reading.");
  }

  return (await response.json()) as ReadingResponse;
}

export function useCreateReadingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReading,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.readings.latest(),
      });
    },
  });
}
