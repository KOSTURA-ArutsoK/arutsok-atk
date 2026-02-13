import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export default function ExternePristupy() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ExternalLink className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Externe pristupy</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Externe pristupy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-externe-placeholder">
            Tu budu spravovane externe pristupy a prepojenia na systemy tretich stran.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
