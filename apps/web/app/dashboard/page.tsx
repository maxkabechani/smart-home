"use client"

import { SmartHomeShell } from "@/components/smart-home-shell"
import { SmartHomePanel } from "@/features/smart-home/smart-home-panel"

export default function Page() {
  return (
    <SmartHomeShell>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Whole-home overview</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Smart Home Control Center
              </h1>
            </div>
          </div>
        </div>

        <SmartHomePanel />
      </div>
    </SmartHomeShell>
  )
}
