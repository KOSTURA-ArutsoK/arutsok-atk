import { useQuery } from "@tanstack/react-query";
import { Database, ArrowRight, Layers, Link2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KniznicaParametrov from "@/pages/KniznicaParametrov";

interface MappingRow {
  id: number;
  sector_id: number;
  section_id: number;
  target_category_code: string;
  target_section_id: number | null;
  module_source: string;
  sector_name: string;
  section_name: string;
  target_section_name: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  identita: "Identita",
  legislativa: "Legislatíva",
  rodina: "Rodina a vzťahy",
  financie: "Financie a majetok",
  profil: "Profil a marketing",
  digitalna: "Digitálna stopa",
  servis: "Servis a archív",
  relacie: "Relácie",
  reality: "Financie a majetok",
  zdravotny: "Profil a marketing",
  investicny: "Profil a marketing",
};

const CATEGORY_COLORS: Record<string, string> = {
  identita: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  legislativa: "bg-red-500/10 border-red-500/20 text-red-400",
  rodina: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  financie: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  reality: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  profil: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  zdravotny: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  investicny: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  digitalna: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
  servis: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  relacie: "bg-violet-500/10 border-violet-500/20 text-violet-400",
};

export default function SektorySubjektov() {
  const { data: mappings } = useQuery<MappingRow[]>({
    queryKey: ["/api/sector-category-mappings"],
  });

  const groupedBySector: Record<string, MappingRow[]> = {};
  if (mappings) {
    for (const m of mappings) {
      const key = m.sector_name || `Sektor #${m.sector_id}`;
      if (!groupedBySector[key]) groupedBySector[key] = [];
      groupedBySector[key].push(m);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sektory Subjektov</h1>
        <sup className="text-[9px] text-blue-400 font-medium ml-1">(B)</sup>
      </div>

      {mappings && mappings.length > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5" data-testid="unified-mapping-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              Prepojenie architektúry A ↔ B ↔ C
              <Badge variant="outline" className="text-[8px] border-emerald-400/30 text-emerald-400 ml-auto">
                {mappings.length} mapovaní
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {Object.entries(groupedBySector).map(([sectorName, sectorMappings]) => (
                <div key={sectorName} className="flex items-start gap-2 p-2 rounded-md border border-border/40 bg-card/50">
                  <div className="flex items-center gap-1.5 shrink-0 min-w-[140px]">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{sectorName}</span>
                    <sup className="text-[8px] text-blue-400 font-medium">(A)</sup>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {sectorMappings.map((m) => {
                      const colors = CATEGORY_COLORS[m.target_category_code] || CATEGORY_COLORS.servis;
                      return (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className={`text-[9px] ${colors}`}
                          data-testid={`mapping-badge-${m.id}`}
                        >
                          {m.section_name}
                          <ArrowRight className="w-2.5 h-2.5 mx-0.5" />
                          {CATEGORY_LABELS[m.target_category_code] || m.target_category_code}
                          {m.target_section_name && (
                            <span className="ml-0.5 opacity-70">({m.target_section_name})</span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-[10px] text-muted-foreground">
                Parametre vytvorené v Sektoroch Zmlúv (A) sa automaticky mapujú do kategórií profilu subjektu (C) cez šablóny (B)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <KniznicaParametrov />
    </div>
  );
}
