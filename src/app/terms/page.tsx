import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Prose } from "@/components/ui/prose";

export default function TermsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="serif text-2xl">Terms</CardTitle>
      </CardHeader>
      <CardContent>
        <Prose>
          <p>
            This directory is provided as-is for early access. Terms will be
            updated as features launch.
          </p>
        </Prose>
      </CardContent>
    </Card>
  );
}
