import { Grid3X3, Settings, ClipboardList } from "lucide-react"
import { 
    useSidebar,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./ui/sidebar"
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar() {
    const { state } = useSidebar();
    const pathname = usePathname();

    const isActive = (href: string) => pathname === href;

    return (
        <Sidebar collapsible="icon" className="border-r border-border/40">
            <SidebarHeader className="border-b border-border/40">
                <div className="px-2 py-3 flex items-center">
                    <h1 className="text-xl font-bold text-green-500">
                        <span>J</span>
                        <span className={state === 'collapsed' ? 'hidden' : 'inline'}>ib's Bingo</span>
                    </h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <Link href="/" passHref legacyBehavior>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Bingo Card" 
                                style={isActive("/") ? { fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
                            >
                                <Grid3X3 className="text-green-500" />
                                <span>Bingo Card</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </Link>
                    <Link href="/admin" passHref legacyBehavior>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Admin - Manage Fields" 
                                style={isActive("/admin") ? { fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
                            >
                                <ClipboardList className="text-blue-500" />
                                <span>Admin</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </Link>
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="border-t border-border/40">
                <SidebarMenu>
                    <Link href="/settings" passHref legacyBehavior>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Settings" 
                                style={isActive("/settings") ? { fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
                            >
                                <Settings className="text-gray-500" />
                                <span>Settings</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </Link>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
