"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { defaultDeviceId, smartHomeUrl, smartHomeWebSocketUrl, type SmartHomeStatusResponse } from "./api"

export function useSmartHomeStatusQuery() {
  const client = useQueryClient()
  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const connect = () => {
      socket = new WebSocket(smartHomeWebSocketUrl())
      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data) as { type: string; data: SmartHomeStatusResponse["data"]; online?: boolean }
        if (payload.type === "smart-home.state") client.setQueryData(queryKeys.smartHome.status(defaultDeviceId), { success: true, data: payload.data, online: payload.online ?? true })
      })
      socket.addEventListener("close", () => { if (!stopped) reconnect = setTimeout(connect, 2000) })
    }
    connect()
    return () => { stopped = true; if (reconnect) clearTimeout(reconnect); socket?.close() }
  }, [client])

  return useQuery({
    queryKey: queryKeys.smartHome.status(defaultDeviceId),
    queryFn: async () => {
      const response = await fetch(smartHomeUrl(`/smart-home/status?deviceId=${encodeURIComponent(defaultDeviceId)}`), { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load smart-home status")
      return response.json() as Promise<SmartHomeStatusResponse>
    },
    refetchInterval: 15000,
  })
}
