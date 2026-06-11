"use client"

import * as React from "react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { LabShell } from "@/components/lab-shell"
import { SectionCards } from "@/components/section-cards"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ReadingsHistoryRange } from "@/features/readings/api"
import { useBulbStateQuery } from "@/features/bulb/queries"
import {
  useLatestReadingQuery,
  useReadingsHistoryQuery,
} from "@/features/readings/queries"
import { LightbulbIcon, ThermometerIcon } from "lucide-react"

export default function Page() {
  const [historyRange, setHistoryRange] =
    React.useState<ReadingsHistoryRange>("day")
  const latestQuery = useLatestReadingQuery()
  const historyQuery = useReadingsHistoryQuery(historyRange)
  const bulbQuery = useBulbStateQuery()
  const latestReading = latestQuery.data?.success ? latestQuery.data.data : null
  const history = historyQuery.data?.data ?? []
  const reading = latestReading ?? history[history.length - 1] ?? null
  const isOnline = reading?.status === "online"
  const hasError = latestQuery.error || historyQuery.error

  return (
    <LabShell>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Course Lab Dashboard
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                ESP32 Monitoring Workspace
              </h1>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? "Sensor online" : "Sensor offline (stale)"}
            </Badge>
          </div>
          {hasError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Unable to reach the readings API.
            </div>
          ) : null}
        </div>

        <SectionCards
          reading={reading}
          historyCount={history.length}
          isLoading={latestQuery.isLoading || historyQuery.isLoading}
          bulbEnabled={bulbQuery.data?.data.enabled ?? false}
        />

        <div className="px-4 lg:px-6">
          <ChartAreaInteractive
            readings={history}
            range={historyRange}
            onRangeChange={setHistoryRange}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
          <LabCard
            href="/labs/1"
            icon={<ThermometerIcon className="size-4" />}
            label="Lab Exercise 1"
            title="Temperature & Humidity"
            value="DHT11 readings, physical LCD output, and history chart"
          />
          <LabCard
            href="/labs/2"
            icon={<LightbulbIcon className="size-4" />}
            label="Lab Exercise 2"
            title="Bulb Output"
            value={`Physical bulb is ${bulbQuery.data?.data.enabled ? "on" : "off"}`}
          />
        </div>
      </div>
    </LabShell>
  )
}

function LabCard({
  href,
  icon,
  label,
  title,
  value,
}: {
  href: string
  icon: React.ReactNode
  label: string
  title: string
  value: string
}) {
  return (
    <Card className="transition hover:bg-muted/40">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-base">
          <a href={href}>{title}</a>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{value}</CardContent>
    </Card>
  )
}
