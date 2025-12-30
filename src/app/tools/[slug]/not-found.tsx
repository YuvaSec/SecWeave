import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Prose } from "@/components/ui/prose";

export default function ToolNotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="serif text-2xl">Tool not found</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Prose>
          <p>We could not find that tool. Try returning to the directory.</p>
        </Prose>
        <Button href="/" variant="ghost">
          Back to tools
        </Button>
      </CardContent>
    </Card>
  );
}
