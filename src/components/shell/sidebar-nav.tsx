"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { getAllTools, type ToolDefinition } from "@/lib/toolsRegistry";

function groupByCategory(tools: ToolDefinition[]) {
  const map = new Map<string, ToolDefinition[]>();
  for (const tool of tools) {
    const list = map.get(tool.category) ?? [];
    list.push(tool);
    map.set(tool.category, list);
  }

  const categories = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([category, list]) =>
        [category, list.sort((x, y) => x.title.localeCompare(y.title))] as const,
    );

  return categories;
}

export function SidebarNav() {
  const pathname = usePathname();
  const tools = getAllTools();
  const groups = groupByCategory(tools);

  return (
    <nav className="space-y-6">
      {groups.map(([category, list]) => (
        <div key={category}>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-faint">
            {category}
          </div>

          <div className="space-y-1">
            {list.map((tool) => {
              const href = `/tools/${tool.slug}`;
              const active = pathname === href;

              return (
                <Link
                  key={tool.slug}
                  href={href}
                  className={cn(
                    "block rounded-lg px-2 py-1.5 text-sm transition",
                    active
                      ? "bg-panel2 text-fg"
                      : "text-muted hover:bg-panel2 hover:text-fg",
                  )}
                >
                  {tool.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
