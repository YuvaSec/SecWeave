import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Prose } from "@/components/ui/prose";

export default function PrivacyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="serif text-2xl">Privacy</CardTitle>
      </CardHeader>
      <CardContent>
        <Prose>
          <p>
            We do not store tool inputs in Step 1. Privacy details will expand as
            tools ship.
          </p>
        </Prose>
      </CardContent>
    </Card>
  );
}
