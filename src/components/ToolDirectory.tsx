"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ToolDefinition } from "@/lib/toolsRegistry";

type ToolDirectoryProps = {
  tools: ToolDefinition[];
};

export default function ToolDirectory({ tools }: ToolDirectoryProps) {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return tools;
    }
    return tools.filter((tool) => {
      return (
        tool.title.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized)
      );
    });
  }, [query, tools]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Explore security tools</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search across checks and utilities built for quick network analysis.
        </p>
        <label
          className="mt-4 block text-sm font-medium text-slate-700"
          htmlFor="tool-search"
        >
          Search tools
        </label>
        <input
          id="tool-search"
          type="search"
          placeholder="Search by name or description"
          className="mt-2 w-full rounded-lg border border-mist px-4 py-3 text-sm text-slate-800"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group rounded-xl border border-mist bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-tide"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {tool.category}
            </p>
            <h2 className="mt-2 text-lg font-semibold group-hover:text-tide">
              {tool.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{tool.description}</p>
          </Link>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white px-6 py-12 text-center text-sm text-slate-500">
          No tools match that search. Try a different term.
        </div>
      )}
    </section>
  );
}
