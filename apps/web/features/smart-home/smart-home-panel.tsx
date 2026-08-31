"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useQueueSmartHomeCommand } from "./mutations"
import { useSmartHomeStatusQuery } from "./queries"
import type { ControlMode } from "./api"
import { Droplets, Fan, Lightbulb, LockKeyhole, Radio, Shield, Wifi } from "lucide-react"

const modes: ControlMode[] = ["AUTO", "ON", "OFF"]

export function SmartHomePanel() {
  const status = useSmartHomeStatusQuery()
  const command = useQueueSmartHomeCommand()
  const home = status.data?.data
  const send = (value: string) => command.mutate(value)

  return (
    <section className="space-y-4 px-4 lg:px-6" aria-labelledby="smart-home-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Live controls</p>
          <h2 id="smart-home-heading" className="text-xl font-semibold">Smart home</h2>
          <p className="text-sm text-muted-foreground">Commands are queued and applied when the ESP32 next checks in.</p>
        </div>
        <Badge variant={status.data?.online ? "default" : "destructive"}>
          {status.data?.online ? "ESP32 online" : "ESP32 offline"}
        </Badge>
      </div>

      {status.error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Unable to reach the smart-home API.</p> : null}
      {command.error ? <p className="text-sm text-destructive">The command could not be queued.</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={<Fan />} title="Climate" value={home ? `${home.temperature.toFixed(1)}°C · ${home.humidity.toFixed(0)}%` : "Waiting for telemetry"} detail={home ? `Fan ${home.fanOn ? "on" : "off"} · ${home.fanMode}` : "—"}>
          <ModeButtons current={home?.fanMode} disabled={command.isPending} onMode={(mode) => send(`SET_FAN_MODE:${mode.toLowerCase()}`)} />
        </StatusCard>
        <StatusCard icon={<Droplets />} title="Water tank" value={home ? `${home.tankPercent}% full` : "Waiting for telemetry"} detail={home ? `${home.tankDistanceCm.toFixed(1)} cm · Pump ${home.pumpOn ? "on" : "off"}` : "—"}>
          <ModeButtons current={home?.pumpMode} disabled={command.isPending} onMode={(mode) => send(`SET_PUMP_MODE:${mode.toLowerCase()}`)} />
        </StatusCard>
        <StatusCard icon={<Lightbulb />} title="Outside light" value={home ? (home.outsideLightOn ? "Light on" : "Light off") : "Waiting for telemetry"} detail={home?.outsideLightMode ?? "—"}>
          <ModeButtons current={home?.outsideLightMode} disabled={command.isPending} onMode={(mode) => send(`SET_OUTSIDE_LIGHT_MODE:${mode.toLowerCase()}`)} />
        </StatusCard>
        <StatusCard icon={<Lightbulb />} title="Inside light" value={home ? (home.insideLightOn ? "Light on" : "Light off") : "Waiting for telemetry"} detail={home?.insideLightMode ?? "—"}>
          <ModeButtons current={home?.insideLightMode} disabled={command.isPending} onMode={(mode) => send(`SET_INSIDE_LIGHT_MODE:${mode.toLowerCase()}`)} />
        </StatusCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={<LockKeyhole />} title="Gate" value={home?.gateOpen ? "Open" : "Closed"} detail="PIN, RFID, or remote access">
          <div className="flex gap-2"><Button size="sm" disabled={command.isPending} onClick={() => send("OPEN_GATE")}>Open gate</Button><Button size="sm" variant="outline" disabled={command.isPending} onClick={() => send("CLOSE_GATE")}>Close</Button></div>
        </StatusCard>
        <StatusCard icon={<Shield />} title="Security" value={home?.securityArmed ? "Armed" : "Disarmed"} detail={home?.motion ? "Motion detected" : "No motion"}>
          <div className="flex gap-2"><Button size="sm" disabled={command.isPending} onClick={() => send("SET_SECURITY:armed")}>Arm</Button><Button size="sm" variant="outline" disabled={command.isPending} onClick={() => send("SET_SECURITY:off")}>Disarm</Button></div>
        </StatusCard>
        <StatusCard icon={<Radio />} title="Device link" value={status.data?.online ? "Connected" : "Offline"} detail={home ? `Wi-Fi ${home.wifiRssi} dBm · ${new Date(home.updatedAt).toLocaleTimeString()}` : "No telemetry received"}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className="size-4" /> Local automation continues offline</div>
        </StatusCard>
      </div>
    </section>
  )
}

function ModeButtons({ current, disabled, onMode }: { current?: ControlMode; disabled: boolean; onMode: (mode: ControlMode) => void }) {
  return <div className="flex gap-1">{modes.map((mode) => <Button key={mode} size="sm" variant={current === mode ? "default" : "outline"} disabled={disabled} onClick={() => onMode(mode)}>{mode === "AUTO" ? "Auto" : mode === "ON" ? "On" : "Off"}</Button>)}</div>
}

function StatusCard({ icon, title, value, detail, children }: { icon: React.ReactNode; title: string; value: string; detail: string; children: React.ReactNode }) {
  return <Card><CardHeader className="gap-2"><CardDescription className="flex items-center gap-2">{icon}<span>{title}</span></CardDescription><CardTitle className="text-xl">{value}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>
}
