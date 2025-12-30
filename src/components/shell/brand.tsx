import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="serif text-xl font-semibold tracking-tight text-fg">SecWeave</span>
      <span className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-xs text-muted">
        tools
      </span>
    </Link>
  );
}
