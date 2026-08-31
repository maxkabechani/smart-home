"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { defaultDeviceId, smartHomeUrl } from "./api"

export function useQueueSmartHomeCommand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (command: string) => {
      const response = await fetch(smartHomeUrl("/smart-home/commands"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: defaultDeviceId, command }),
      })
      if (!response.ok) throw new Error("Unable to queue device command")
      return response.json()
    },
    onSuccess: () => setTimeout(() => client.invalidateQueries({ queryKey: queryKeys.smartHome.status(defaultDeviceId) }), 1500),
  })
}
