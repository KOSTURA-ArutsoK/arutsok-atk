import { Database } from "lucide-react";
import KniznicaParametrov from "@/pages/KniznicaParametrov";

export default function SektorySubjektov() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sektory Subjektov</h1>
      </div>
      <KniznicaParametrov />
    </div>
  );
}
