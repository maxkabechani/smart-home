"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Reading } from "@/features/readings/api"
import {
  DropletsIcon,
  LightbulbIcon,
  ThermometerIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"

type SectionCardsProps = {
  reading: Reading | null
  historyCount: number
  isLoading: boolean
  bulbEnabled: boolean
}

export function SectionCards({
  reading,
  historyCount,
  isLoading,
  bulbEnabled,
}: SectionCardsProps) {
  const isOnline = reading?.status === "online"
  const temperature = reading ? `${reading.temperature.toFixed(1)} C` : "--"
  const humidity = reading ? `${reading.humidity.toFixed(0)}%` : "--"
  const recordedAt = reading
    ? new Date(reading.createdAt).toLocaleTimeString()
    : "No packet received"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Temperature</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "--" : temperature}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ThermometerIcon />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Comfort range: 18 C - 26 C
          </div>
          <div className="text-muted-foreground">Recorded at {recordedAt}</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Humidity</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "--" : humidity}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <DropletsIcon />
              DHT11
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Target range: 40% - 60%
          </div>
          <div className="text-muted-foreground">
            {historyCount} readings in selected range
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Sensor Status</CardDescription>
          <CardTitle className="text-2xl font-semibold capitalize tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "Loading" : reading?.status ?? "Offline"}
          </CardTitle>
          <CardAction>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? <WifiIcon /> : <WifiOffIcon />}
              {isOnline ? "Online" : "Stale"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Backend marks stale packets offline
          </div>
          <div className="text-muted-foreground">Auto refresh every 5 seconds</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Bulb Output</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {bulbEnabled ? "On" : "Off"}
          </CardTitle>
          <CardAction>
            <Badge variant={bulbEnabled ? "default" : "outline"}>
              <LightbulbIcon />
              Bulb
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Physical output controlled by backend
          </div>
          <div className="text-muted-foreground">ESP32 polls /bulb</div>
        </CardFooter>
      </Card>
    </div>
  )
}
