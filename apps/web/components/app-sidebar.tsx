"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  CommandIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ThermometerIcon,
} from "lucide-react"
import Link from "next/link"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "Lab Exercise 1",
      url: "/labs/1",
      icon: (
        <ThermometerIcon
        />
      ),
    },
    {
      title: "Lab Exercise 2",
      url: "/labs/2",
      icon: (
        <LightbulbIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">ESP32 Monitor</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1.5 text-xs text-sidebar-foreground/70">
          Max Kashela Kabechani
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
