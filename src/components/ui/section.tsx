import type React from "react";
import { cn } from "@/lib/cn";

export function Section({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("py-14 md:py-20", className)}>{children}</section>;
}
