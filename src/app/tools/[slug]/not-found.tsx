import Link from "next/link";

export default function ToolNotFound() {
  return (
    <section className="rounded-2xl border border-mist bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Tool not found</h1>
      <p className="mt-3 text-sm text-slate-600">
        We could not find that tool. Try returning to the directory.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center rounded-lg border border-mist px-4 py-2 text-sm font-semibold text-slate-700 hover:border-tide"
      >
        Back to tools
      </Link>
    </section>
  );
}
