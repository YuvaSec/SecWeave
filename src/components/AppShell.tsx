"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { ToolDefinition } from "@/lib/toolsRegistry";

const categoryEntries = (categories: Record<string, ToolDefinition[]>) =>
  Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));

type AppShellProps = {
  categories: Record<string, ToolDefinition[]>;
  children: ReactNode;
};

export default function AppShell({ categories, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-fog text-ink">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-mist bg-white/95 px-6 pb-8 pt-6 shadow-lg transition-transform duration-200 md:static md:translate-x-0 md:shadow-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Tool navigation"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tide"
            >
              SecWeave Tools
            </Link>
            <button
              type="button"
              className="md:hidden"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
          <nav className="mt-6 space-y-6">
            {categoryEntries(categories).map(([category, tools]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {category}
                </p>
                <ul className="mt-2 space-y-1">
                  {tools.map((tool) => (
                    <li key={tool.slug}>
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-fog focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tide"
                        onClick={() => setSidebarOpen(false)}
                      >
                        {tool.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Close sidebar overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-mist bg-white/95">
            <div className="flex items-center gap-4 px-6 py-4">
              <button
                type="button"
                className="rounded-md border border-mist px-3 py-2 text-sm font-medium text-slate-700 md:hidden"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                Menu
              </button>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Tool Directory
                </p>
                <p className="text-lg font-semibold">
                  Fast checks for security workflows
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-8">{children}</main>

          <footer className="border-t border-mist bg-white/90 px-6 py-6">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>SecWeave © 2024</span>
              <div className="flex items-center gap-4">
                <Link href="/about">About</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
