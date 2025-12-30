"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function MobileNav({
  triggerLabel = "Menu",
  children,
}: {
  triggerLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-fg hover:bg-panel2"
      >
        {triggerLabel}
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh w-[85%] max-w-sm border-r border-border bg-bg p-5 transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="text-sm font-medium text-fg">Browse tools</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-fg hover:bg-panel2"
          >
            Close
          </button>
        </div>

        <div className="h-[calc(100dvh-80px)] overflow-auto pr-2">{children}</div>
      </aside>
    </>
  );
}
