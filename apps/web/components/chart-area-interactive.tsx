"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { Reading, ReadingsHistoryRange } from "@/features/readings/api"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type SensorChartProps = {
  readings: Reading[]
  range: ReadingsHistoryRange
  onRangeChange: (range: ReadingsHistoryRange) => void
}

const chartConfig = {
  temperature: {
    label: "Temperature",
    color: "var(--chart-2)",
  },
  humidity: {
    label: "Humidity",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  readings,
  range,
  onRangeChange,
}: SensorChartProps) {
  const filteredData = readings.map((reading) => ({
    recordedAt: reading.createdAt,
    temperature: Number(reading.temperature.toFixed(1)),
    humidity: Number(reading.humidity.toFixed(0)),
  }))
  const rangeLabel = {
    day: "last day",
    week: "last week",
    month: "last month",
  }[range]

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Previous Sensor Data</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Temperature and humidity from recent ESP32 packets
          </span>
          <span className="@[540px]/card:hidden">Readings from the {rangeLabel}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => {
              if (value) {
                onRangeChange(value as ReadingsHistoryRange)
              }
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="day">Last Day</ToggleGroupItem>
            <ToggleGroupItem value="week">Last Week</ToggleGroupItem>
            <ToggleGroupItem value="month">Last Month</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={range}
            onValueChange={(value) => onRangeChange(value as ReadingsHistoryRange)}
          >
            <SelectTrigger
              className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select reading range"
            >
              <SelectValue placeholder="Last Day" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="day" className="rounded-lg">
                Last Day
              </SelectItem>
              <SelectItem value="week" className="rounded-lg">
                Last Week
              </SelectItem>
              <SelectItem value="month" className="rounded-lg">
                Last Month
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[300px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillTemperature" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-temperature)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-temperature)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-humidity)"
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-humidity)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="recordedAt"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)

                  if (range === "day") {
                    return date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }

                  return date.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={32}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleString()
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="humidity"
                type="natural"
                fill="url(#fillHumidity)"
                stroke="var(--color-humidity)"
                strokeWidth={2}
              />
              <Area
                dataKey="temperature"
                type="natural"
                fill="url(#fillTemperature)"
                stroke="var(--color-temperature)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Waiting for previous readings.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
