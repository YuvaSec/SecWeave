import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { getToolsByCategory } from "@/lib/toolsRegistry";

export const metadata: Metadata = {
  title: "SecWeave Tools",
  description: "Config-driven directory of security utilities.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const categories = getToolsByCategory();

  return (
    <html lang="en">
      <body>
        <AppShell categories={categories}>{children}</AppShell>
      </body>
    </html>
  );
}
