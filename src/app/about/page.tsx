import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Prose } from "@/components/ui/prose";

export default function AboutPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="serif text-2xl">About SecWeave</CardTitle>
      </CardHeader>
      <CardContent>
        <Prose>
          <p>
            SecWeave is building a fast, config-driven directory of security tools
            for network analysis workflows.
          </p>
        </Prose>
      </CardContent>
    </Card>
  );
}
