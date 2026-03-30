import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function Novinky() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper
          className="w-6 h-6 stroke-blue-700 fill-amber-400"
          strokeWidth={2}
          data-testid="icon-novinky"
        />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Novinky</h1>
      </div>
      <Card className="border-2">
        <CardHeader>
          <CardTitle data-testid="text-novinky-heading">Novinky od partnerov (cenníky, oznamy)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-justify" data-testid="text-novinky-placeholder">
            Tu budú zobrazené aktualitky a oznámenia od vašich partnerov, vrátane zmien v cenníkoch, nových produktov a dôležitých oznamov.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
