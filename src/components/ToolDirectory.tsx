"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldLabel, TextField } from "@/components/ui/fields";
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
    <section className="space-y-8">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.4em] text-faint">
            Directory
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-fg md:text-xl">
            Explore security tools
          </h2>
          <CardDescription>
            Search across checks and utilities built for fast network analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <FieldLabel>Search tools</FieldLabel>
          <TextField
            type="search"
            placeholder="Search by name or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTools.map((tool) => (
          <Link key={tool.slug} href={`/tools/${tool.slug}`} className="group">
            <Card className="h-full transition hover:-translate-y-1 hover:shadow-soft">
              <CardContent className="space-y-3">
                <Badge>{tool.category}</Badge>
                <div>
                  <h2 className="text-base font-semibold text-fg group-hover:text-fg">
                    {tool.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{tool.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">
              No tools match that search. Try a different term.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
