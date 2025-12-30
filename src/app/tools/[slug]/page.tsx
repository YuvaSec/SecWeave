import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllTools,
  getToolBySlug,
  type ToolDefinition,
} from "@/lib/toolsRegistry";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

const renderInput = (tool: ToolDefinition) =>
  tool.inputs.map((input) => {
    const inputId = `${tool.slug}-${input.name}`;

    if (input.type === "textarea") {
      return (
        <div key={inputId} className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor={inputId}
          >
            {input.label}
          </label>
          <textarea
            id={inputId}
            name={input.name}
            rows={4}
            placeholder={input.placeholder}
            required={input.required}
            className="w-full rounded-lg border border-mist px-3 py-2 text-sm"
          />
          {input.description && (
            <p className="text-xs text-slate-500">{input.description}</p>
          )}
        </div>
      );
    }

    if (input.type === "select") {
      return (
        <div key={inputId} className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor={inputId}
          >
            {input.label}
          </label>
          <select
            id={inputId}
            name={input.name}
            required={input.required}
            className="w-full rounded-lg border border-mist px-3 py-2 text-sm"
          >
            {input.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {input.description && (
            <p className="text-xs text-slate-500">{input.description}</p>
          )}
        </div>
      );
    }

    return (
      <div key={inputId} className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
          {input.label}
        </label>
        <input
          id={inputId}
          name={input.name}
          type="text"
          placeholder={input.placeholder}
          required={input.required}
          className="w-full rounded-lg border border-mist px-3 py-2 text-sm"
        />
        {input.description && (
          <p className="text-xs text-slate-500">{input.description}</p>
        )}
      </div>
    );
  });

export default async function ToolPage({ params }: ToolPageProps) {
  // In Next.js 15+/16, route params are async and must be awaited before access.
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const relatedTools = tool.relatedToolSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((relatedTool): relatedTool is ToolDefinition =>
      Boolean(relatedTool),
    );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-mist bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {tool.category}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{tool.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{tool.description}</p>
        <form className="mt-6 space-y-4">
          {renderInput(tool)}
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Run check
          </button>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-mist bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Results</h2>
          <div className="mt-4 rounded-xl border border-dashed border-mist bg-fog px-6 py-10 text-sm text-slate-500">
            Results will appear here once the tool is connected.
          </div>
        </div>

        <div className="rounded-2xl border border-mist bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Related tools</h2>
          <div className="mt-4 space-y-3">
            {relatedTools.map((related) => (
              <Link
                key={related.slug}
                href={`/tools/${related.slug}`}
                className="block rounded-lg border border-mist px-4 py-3 text-sm hover:border-tide"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {related.category}
                </p>
                <p className="mt-1 font-semibold">{related.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const generateStaticParams = async () =>
  getAllTools().map((tool) => ({ slug: tool.slug }));
