"use client"

import * as React from "react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { LabShell } from "@/components/lab-shell"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ReadingsHistoryRange } from "@/features/readings/api"
import {
  useLatestReadingQuery,
  useReadingsHistoryQuery,
} from "@/features/readings/queries"
import { DropletsIcon, MonitorIcon, ThermometerIcon } from "lucide-react"

export default function LabOnePage() {
  const [historyRange, setHistoryRange] =
    React.useState<ReadingsHistoryRange>("day")
  const latestQuery = useLatestReadingQuery()
  const historyQuery = useReadingsHistoryQuery(historyRange)
  const reading = latestQuery.data?.success ? latestQuery.data.data : null
  const history = historyQuery.data?.data ?? []
  const isOnline = reading?.status === "online"

  return (
    <LabShell>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Lab Exercise 1
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Temperature & Humidity
              </h1>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? "Sensor online" : "Sensor offline (stale)"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
          <MetricCard
            icon={<ThermometerIcon className="size-4" />}
            label="Temperature"
            value={reading ? `${reading.temperature.toFixed(1)} C` : "--"}
            detail="DHT11 sensor reading"
          />
          <MetricCard
            icon={<DropletsIcon className="size-4" />}
            label="Humidity"
            value={reading ? `${reading.humidity.toFixed(0)}%` : "--"}
            detail="DHT11 sensor reading"
          />
          <MetricCard
            icon={<MonitorIcon className="size-4" />}
            label="Physical LCD"
            value={reading ? "Updated" : "Waiting"}
            detail="ESP32 displays the latest packet"
          />
        </div>

        <div className="px-4 lg:px-6">
          <ChartAreaInteractive
            readings={history}
            range={historyRange}
            onRangeChange={setHistoryRange}
          />
        </div>
      </div>
    </LabShell>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}
