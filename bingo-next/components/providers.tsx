'use client';

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";

type Props = {
  children: React.ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <SessionProvider>
      <ThemeProvider defaultTheme="dark">
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
} 