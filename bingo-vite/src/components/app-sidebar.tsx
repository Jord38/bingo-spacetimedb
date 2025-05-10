import { Grid3X3, Settings } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./ui/sidebar"

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" className="border-r border-border/40">
            <SidebarHeader className="border-b border-border/40">
                <div className="px-2 py-3">
                    <h1 className="text-xl font-bold text-green-500">Jib's Bingo</h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Bingo Card">
                            <Grid3X3 className="text-green-500" />
                            <span>Bingo Card</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="border-t border-border/40">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Settings">
                            <Settings className="text-green-500" />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
