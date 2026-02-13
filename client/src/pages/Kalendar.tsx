import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function Kalendar() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Kalendar</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Kalendar udalosti</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-kalendar-placeholder">
            Tu bude zobrazeny kalendar s dolezitymi udalostami, terminy a planovanie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
