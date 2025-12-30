import type React from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-panel2 px-2 py-0.5 text-xs text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
