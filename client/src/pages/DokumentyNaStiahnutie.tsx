import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown } from "lucide-react";

export default function DokumentyNaStiahnutie() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileDown className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Dokumenty na stiahnutie</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dokumenty</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-dokumenty-placeholder">
            Tu budu dostupne dokumenty na stiahnutie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
