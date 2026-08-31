export type ControlMode = "AUTO" | "ON" | "OFF"

export type SmartHomeTelemetry = {
  deviceId: string
  updatedAt: string
  temperature: number
  humidity: number
  fanOn: boolean
  fanMode: ControlMode
  tankPercent: number
  tankDistanceCm: number
  pumpOn: boolean
  pumpMode: ControlMode
  gateOpen: boolean
  securityArmed: boolean
  motion: boolean
  outsideLightOn: boolean
  outsideLightMode: ControlMode
  insideLightOn: boolean
  insideLightMode: ControlMode
  wifiRssi: number
}

export type SmartHomeStatusResponse = {
  success: true
  data: SmartHomeTelemetry | null
  online: boolean
}

export const defaultDeviceId =
  process.env.NEXT_PUBLIC_SMART_HOME_DEVICE_ID ?? "esp32-home-01"

export function smartHomeUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? ""
  return `${base}${path}`
}

export function smartHomeWebSocketUrl() {
  const httpUrl = smartHomeUrl(`/smart-home/ws?deviceId=${encodeURIComponent(defaultDeviceId)}`)
  const url = new URL(httpUrl, typeof window === "undefined" ? "http://localhost" : window.location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}
