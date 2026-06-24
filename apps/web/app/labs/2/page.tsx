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
import { IdCardIcon, LightbulbIcon, ServerIcon } from "lucide-react"

export default function LabTwoPage() {
  const bulbQuery = useBulbStateQuery()
  const setBulbMutation = useSetBulbStateMutation()
  const isBulbOn = bulbQuery.data?.data.enabled ?? false
  const isWaitingForRfid = bulbQuery.data?.data.pendingRfid ?? false
  const lastRfidUid = bulbQuery.data?.data.lastRfidUid
  const lastRfidStatus = bulbQuery.data?.data.lastRfidStatus
  const updatedAt = bulbQuery.data?.data.updatedAt
  const stateLabel = isBulbOn
    ? "Bulb on"
    : isWaitingForRfid
      ? "Waiting for RFID"
      : "Bulb off"

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
                    : isWaitingForRfid
                      ? "border-foreground bg-muted text-foreground"
                    : "border-muted bg-muted text-muted-foreground",
                ].join(" ")}
              >
                <LightbulbIcon className="size-12" />
              </div>
              <div className="grid flex-1 gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      setBulbMutation.isPending || isBulbOn || isWaitingForRfid
                    }
                    onClick={() => setBulbMutation.mutate(true)}
                  >
                    Request On
                  </Button>
                  <Button
                    disabled={
                      setBulbMutation.isPending ||
                      (!isBulbOn && !isWaitingForRfid)
                    }
                    onClick={() => setBulbMutation.mutate(false)}
                    variant="outline"
                  >
                    Switch Off
                  </Button>
                </div>
                <StatusLine
                  icon={<LightbulbIcon className="size-4" />}
                  label="Current state"
                  value={
                    isBulbOn ? "on" : isWaitingForRfid ? "waiting" : "off"
                  }
                />
                <StatusLine
                  icon={<IdCardIcon className="size-4" />}
                  label="RFID scan"
                  value={
                    lastRfidUid
                      ? `${lastRfidStatus ?? "seen"} ${lastRfidUid}`
                      : "none"
                  }
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
              <CardTitle>RFID-authorized switch</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                The apps request the bulb. The backend waits for an RFID scan
                before allowing the ESP32 to energize the output.
              </p>
              <div className="rounded-md border px-3 py-2 font-mono text-foreground">
                POST /bulb {"{ enabled: true }"} then POST /bulb/rfid-scan
              </div>
              <p>
                Off commands still work from the apps so the lab can be reset
                quickly.
              </p>
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
