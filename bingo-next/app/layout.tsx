import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { MainAppLayout } from "@/components/main-app-layout";
import { SpacetimeDBProvider } from "@/contexts/SpacetimeDBContext";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Jib's Bingo V2",
    description: "Next Generation Ultra Killer Bingo Game",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
            <AppProviders>
                <SpacetimeDBProvider>
                    <MainAppLayout>{children}</MainAppLayout>
                </SpacetimeDBProvider>
            </AppProviders>
        </body>
        </html>
    );
}
