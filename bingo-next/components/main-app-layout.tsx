"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/chat";
import React from "react";

export function MainAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-2xl mb-4">Welcome to Jib's Bingo</h1>
                <p className="mb-6">Please sign in with Steam to continue.</p>
                <Button onClick={() => signIn("steam")} className="bg-blue-600 hover:bg-blue-500">
                    Sign in with Steam
                </Button>
            </div>
        );
    }

    // User is authenticated
    return (
        <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset>
                <div className="flex flex-col h-screen">
                    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 shrink-0">
                        <SidebarTrigger />
                        <div className="flex-1">
                            <h1 className="text-xl font-semibold">Super Epic Gamer Bingo</h1>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {/* @ts-ignore TODO: fix session.user type to include steamId */}
                                Signed in as: {session.user?.name || session.user?.steamId}
                            </span>
                            <Button onClick={() => signOut()} variant="outline" size="sm">
                                Sign Out
                            </Button>
                        </div>
                    </header>
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
                        {/* Page-specific content */}
                        <div className="col-span-1 lg:col-span-3 p-4 flex flex-col items-center overflow-auto">
                            {children}
                        </div>

                        {/* Chat Section */}
                        <div className="col-span-1 lg:col-span-1 border-l border-green-500/30 flex flex-col overflow-hidden">
                            <Chat />
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
} 