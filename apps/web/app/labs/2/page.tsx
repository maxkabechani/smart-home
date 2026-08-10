"use client"

import { LabShell } from "@/components/lab-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useSetBulbStateMutation } from "@/features/bulb/mutations"
import { useBulbStateQuery } from "@/features/bulb/queries"
import { LightbulbIcon, ServerIcon } from "lucide-react"

export default function LabTwoPage() {
  const bulbQuery = useBulbStateQuery()
  const setBulbMutation = useSetBulbStateMutation()
  const isBulbOn = bulbQuery.data?.data.enabled ?? false
  const updatedAt = bulbQuery.data?.data.updatedAt
  const stateLabel = isBulbOn ? "Bulb on" : "Bulb off"

  return (
    <LabShell>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Lab Exercise 2
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Bulb Output
              </h1>
            </div>
            <Badge variant={isBulbOn ? "default" : "outline"}>
              {stateLabel}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
          <Card>
            <CardHeader>
              <CardDescription>Physical output</CardDescription>
              <CardTitle>ESP32 bulb state</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div
                className={[
                  "flex size-28 shrink-0 items-center justify-center rounded-full border",
                  isBulbOn
                    ? "border-amber-300 bg-amber-200 text-amber-950 shadow-[0_0_44px_rgba(251,191,36,0.55)]"
                    : "border-muted bg-muted text-muted-foreground",
                ].join(" ")}
              >
                <LightbulbIcon className="size-12" />
              </div>
              <div className="grid flex-1 gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={setBulbMutation.isPending || isBulbOn}
                    onClick={() => setBulbMutation.mutate(true)}
                  >
                    Switch On
                  </Button>
                  <Button
                    disabled={setBulbMutation.isPending || !isBulbOn}
                    onClick={() => setBulbMutation.mutate(false)}
                    variant="outline"
                  >
                    Switch Off
                  </Button>
                </div>
                <StatusLine
                  icon={<LightbulbIcon className="size-4" />}
                  label="Current state"
                  value={isBulbOn ? "on" : "off"}
                />
                <StatusLine
                  icon={<ServerIcon className="size-4" />}
                  label="Updated"
                  value={updatedAt ? new Date(updatedAt).toLocaleString() : "-"}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Lab control</CardDescription>
              <CardTitle>Direct switch control</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                The apps can directly switch the bulb through the backend.
              </p>
              <div className="rounded-md border px-3 py-2 font-mono text-foreground">
                POST /bulb {"{ enabled: true | false }"}
              </div>
              <p>State updates stream over /bulb/ws for fast UI refresh.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </LabShell>
  )
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium capitalize text-foreground">{value}</span>
    </div>
  )
}
