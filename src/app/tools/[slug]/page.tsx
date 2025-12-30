import TracerouteOnlineClient from "@/components/tools/TracerouteOnlineClient";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    FieldHint,
    FieldLabel,
    SelectField,
    TextAreaField,
    TextField,
} from "@/components/ui/fields";
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
                    <FieldLabel>{input.label}</FieldLabel>
                    <TextAreaField
                        id={inputId}
                        name={input.name}
                        placeholder={input.placeholder}
                        required={input.required}
                    />
                    {input.description && <FieldHint>{input.description}</FieldHint>}
                </div>
            );
        }

        if (input.type === "select") {
            return (
                <div key={inputId} className="space-y-2">
                    <FieldLabel>{input.label}</FieldLabel>
                    <SelectField id={inputId} name={input.name} required={input.required}>
                        {input.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </SelectField>
                    {input.description && <FieldHint>{input.description}</FieldHint>}
                </div>
            );
        }

        return (
            <div key={inputId} className="space-y-2">
                <FieldLabel>{input.label}</FieldLabel>
                <TextField
                    id={inputId}
                    name={input.name}
                    type="text"
                    placeholder={input.placeholder}
                    required={input.required}
                />
                {input.description && <FieldHint>{input.description}</FieldHint>}
            </div>
        );
    });

export default async function ToolPage({ params }: ToolPageProps) {
    // // ✅ Next.js 15+/16: params are async
    const { slug } = await params;

    // // ✅ Find the tool definition from your registry
    const tool = getToolBySlug(slug);
    if (!tool) notFound();

    // // ✅ Build "Related tools" list (used in both layouts)
    const relatedTools = tool.relatedToolSlugs
        .map((toolSlug) => getToolBySlug(toolSlug))
        .filter((relatedTool): relatedTool is ToolDefinition => Boolean(relatedTool));

    // // ✅ SPECIAL CASE: traceroute-online uses a custom UI (map + hops table)
    if (tool.slug === "traceroute-online") {
        return (
            <div className="space-y-8">
                <Card>
                    <CardHeader className="space-y-3">
                        <Badge>{tool.category}</Badge>
                        <div>
                            <CardTitle className="serif text-2xl">{tool.title}</CardTitle>
                            <CardDescription>{tool.description}</CardDescription>
                        </div>
                    </CardHeader>

                    {/* // ✅ Drop-in client component that includes:
              // - input
              // - "Tracing..." state
              // - map + polyline
              // - hops table */}
                    <CardContent>
                        <TracerouteOnlineClient />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Related tools</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {relatedTools.map((related) => (
                            <Link
                                key={related.slug}
                                href={`/tools/${related.slug}`}
                                className="block rounded-xl border border-border px-4 py-3 text-sm text-muted transition hover:bg-panel2 hover:text-fg"
                            >
                                <p className="text-xs uppercase tracking-[0.3em] text-faint">
                                    {related.category}
                                </p>
                                <p className="mt-1 font-medium text-fg">{related.title}</p>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // // ✅ DEFAULT LAYOUT: all other tools keep your current generic UI
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader className="space-y-3">
                    <Badge>{tool.category}</Badge>
                    <div>
                        <CardTitle className="serif text-2xl">{tool.title}</CardTitle>
                        <CardDescription>{tool.description}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4">
                        {renderInput(tool)}
                        <Button type="button">Run check</Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                        <CardDescription>
                            Results will appear here once the tool is connected.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border border-dashed border-border bg-panel2 px-6 py-10 text-sm text-muted">
                            No data yet.
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Related tools</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {relatedTools.map((related) => (
                            <Link
                                key={related.slug}
                                href={`/tools/${related.slug}`}
                                className="block rounded-xl border border-border px-4 py-3 text-sm text-muted transition hover:bg-panel2 hover:text-fg"
                            >
                                <p className="text-xs uppercase tracking-[0.3em] text-faint">
                                    {related.category}
                                </p>
                                <p className="mt-1 font-medium text-fg">{related.title}</p>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export const generateStaticParams = async () =>
    getAllTools().map((tool) => ({ slug: tool.slug }));
