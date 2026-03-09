import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Target, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BusinessOpportunity {
  id: number;
  title: string;
  content: string;
  divisionId: number | null;
  companyId: number;
  sortOrder: number;
}

export default function ObchodnePrilezitosti() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const selectedId = params.get("id") ? parseInt(params.get("id")!) : null;

  const { data: opportunities, isLoading } = useQuery<BusinessOpportunity[]>({
    queryKey: ["/api/business-opportunities"],
  });

  const selectedOp = selectedId ? opportunities?.find(op => op.id === selectedId) : null;

  if (selectedOp) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/obchodne-prilezitosti")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Target className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{selectedOp.title}</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-prilezitost-detail">
              {selectedOp.content}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Obchodne prilezitosti</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !opportunities || opportunities.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm text-center" data-testid="text-no-content">
              Momentalne nemame ziadnu ponuku prace. Sledujte tuto sekciu, ponuky sa mozu priebezne menit.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((op) => (
            <Card
              key={op.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setLocation(`/obchodne-prilezitosti?id=${op.id}`)}
              data-testid={`card-opportunity-${op.id}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base" data-testid={`text-op-title-${op.id}`}>{op.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4" data-testid={`text-op-preview-${op.id}`}>
                  {op.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
