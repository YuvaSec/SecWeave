import ToolDirectory from "@/components/ToolDirectory";
import { getAllTools } from "@/lib/toolsRegistry";

export default function HomePage() {
  const tools = getAllTools();

  return <ToolDirectory tools={tools} />;
}
