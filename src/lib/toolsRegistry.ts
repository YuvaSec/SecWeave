export type ToolInputType = "text" | "textarea" | "select";

export type ToolInputOption = {
  label: string;
  value: string;
};

export type ToolInput = {
  name: string;
  label: string;
  type: ToolInputType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: ToolInputOption[];
};

export type ToolDefinition = {
  slug: string;
  title: string;
  description: string;
  category: string;
  inputs: ToolInput[];
  relatedToolSlugs: string[];
};

const toolsRegistry: ToolDefinition[] = [
  {
    slug: "mx-checker",
    title: "MX Checker",
    description: "Inspect MX records to verify inbound mail routing.",
    category: "Email Security",
    inputs: [
      {
        name: "domain",
        label: "Domain",
        type: "text",
        placeholder: "example.com",
        required: true,
      },
    ],
    relatedToolSlugs: ["spf-checker", "jwt-decoder"],
  },
  {
    slug: "spf-checker",
    title: "SPF Checker",
    description: "Validate SPF syntax and locate sending sources.",
    category: "Email Security",
    inputs: [
      {
        name: "domain",
        label: "Domain",
        type: "text",
        placeholder: "example.com",
        required: true,
      },
    ],
    relatedToolSlugs: ["mx-checker", "jwt-decoder"],
  },
  {
    slug: "jwt-decoder",
    title: "JWT Decoder",
    description: "Decode JWT headers and payloads for inspection.",
    category: "Application Security",
    inputs: [
      {
        name: "token",
        label: "JWT",
        type: "textarea",
        placeholder: "Paste token",
        required: true,
      },
    ],
    relatedToolSlugs: ["mx-checker", "spf-checker"],
  },
  {
    slug: "traceroute-online", // // ✅ must match the URL: /tools/traceroute-online
    title: "Traceroute Online",
    description: "Trace the network route to a domain/IP and visualize hops on a map.",
    category: "Network Security", // // ✅ new category (or use an existing one if your sidebar is hardcoded)
    inputs: [], // // ✅ empty because TracerouteOnlineClient has its own input UI
    relatedToolSlugs: ["mx-checker", "spf-checker", "jwt-decoder"], // // optional
  },
];

export const getAllTools = (): ToolDefinition[] => toolsRegistry;

export const getToolBySlug = (slug: string): ToolDefinition | undefined =>
  toolsRegistry.find((tool) => tool.slug === slug);

export const getToolsByCategory = (): Record<string, ToolDefinition[]> => {
  return toolsRegistry.reduce<Record<string, ToolDefinition[]>>((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {});
};
