import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function Novinky() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Novinky</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-novinky-heading">Novinky od partnerov (cenniky, oznamy)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-novinky-placeholder">
            Tu budu zobrazene aktualitky a oznamenia od vasich partnerov, vratane zmien v cennikoch, novych produktov a dolezitych oznamov.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
