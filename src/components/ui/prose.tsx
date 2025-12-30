import type React from "react";
import { cn } from "@/lib/cn";

export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-4 text-[15px] leading-7 text-fg/90",
        "[&_h2]:serif [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:tracking-tight",
        "[&_h3]:serif [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-normal",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-fg/85",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-fg/85",
        "[&_a]:underline [&_a]:decoration-black/20 hover:[&_a]:decoration-black/45",
        className,
      )}
    >
      {children}
    </div>
  );
}
