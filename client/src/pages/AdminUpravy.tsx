import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldAlert, FileEdit, BookOpen, Search, Check, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contract, ParameterSynonym } from "@shared/schema";

const CONFIRM_THRESHOLD = 5;

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("sk-SK");
  } catch {
    return "—";
  }
}

function ContractsSection() {
  const [search, setSearch] = useState("");

  const { data: contractsRaw, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts"],
  });

  const contractsList: any[] = Array.isArray(contractsRaw) ? contractsRaw : (contractsRaw?.data || contractsRaw?.contracts || []);
  const filtered = contractsList.filter((c: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.contractNumber || "").toLowerCase().includes(q) ||
      (c.uid || "").toLowerCase().includes(q) ||
      (c.contractType || "").toLowerCase().includes(q) ||
      String(c.globalNumber || "").includes(q)
    );
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold" data-testid="text-contracts-section-title">
            Manuálne editovanie zmlúv
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať zmluvu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-60"
            data-testid="input-search-contracts"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-contracts">
            Žiadne zmluvy na zobrazenie.
          </p>
        ) : (
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UID</TableHead>
                  <TableHead>Číslo zmluvy</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Dátum podpisu</TableHead>
                  <TableHead>Expirácia</TableHead>
                  <TableHead>Suma</TableHead>
                  <TableHead className="text-right">Akcia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => (
                  <TableRow key={c.id} data-testid={`row-contract-${c.id}`}>
                    <TableCell className="font-mono text-xs">{c.uid || "—"}</TableCell>
                    <TableCell>{c.contractNumber || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.contractType || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.signedDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.expiryDate)}</TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.premiumAmount != null ? `${c.premiumAmount} €` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild data-testid={`button-edit-contract-${c.id}`}>
                        <Link href={`/contracts/${c.id}/edit`}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Upraviť
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SynonymsSection() {
  const { toast } = useToast();

  const { data: fieldCountsRaw, isLoading: loadingCounts } = useQuery<any>({
    queryKey: ["/api/parameter-synonyms/field-counts"],
  });

  const fieldCounts: any[] = Array.isArray(fieldCountsRaw) ? fieldCountsRaw : [];
  const [expandedParam, setExpandedParam] = useState<number | null>(null);

  const { data: synonyms, isLoading: loadingSynonyms } = useQuery<ParameterSynonym[]>({
    queryKey: ["/api/subject-parameters", expandedParam, "synonyms"],
    queryFn: () =>
      fetch(`/api/subject-parameters/${expandedParam}/synonyms`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: expandedParam !== null,
  });

  const confirmMutation = useMutation({
    mutationFn: async (synonymId: number) => {
      await apiRequest("POST", `/api/parameter-synonyms/${synonymId}/confirm`);
    },
    onSuccess: () => {
      toast({ title: "Synonymum potvrdené" });
      if (expandedParam !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters", expandedParam, "synonyms"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/parameter-synonyms/field-counts"] });
    },
    onError: () => {
      toast({ title: "Chyba pri potvrdzovaní", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold" data-testid="text-synonyms-section-title">
          Správa synonym
        </h2>
      </CardHeader>
      <CardContent className="pt-0">
        {loadingCounts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !fieldCounts || fieldCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-synonyms">
            Žiadne synonymá na zobrazenie.
          </p>
        ) : (
          <div className="space-y-2">
            {fieldCounts.map((fc: any) => (
              <div key={fc.parameterId} className="border border-border rounded-md" data-testid={`card-synonym-param-${fc.parameterId}`}>
                <button
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover-elevate rounded-md"
                  onClick={() => setExpandedParam(expandedParam === fc.parameterId ? null : fc.parameterId)}
                  data-testid={`button-expand-param-${fc.parameterId}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{fc.label || fc.fieldKey}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {fc.synonymCount} synonym{fc.synonymCount !== 1 ? "á" : "um"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={fc.confirmedCount >= fc.synonymCount && fc.synonymCount > 0 ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {fc.confirmedCount}/{fc.synonymCount} potvrdených
                    </Badge>
                  </div>
                </button>

                {expandedParam === fc.parameterId && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {loadingSynonyms ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : !synonyms || synonyms.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Žiadne synonymá.</p>
                    ) : (
                      synonyms.map((syn) => {
                        const progress = Math.min((syn.confirmationCount / CONFIRM_THRESHOLD) * 100, 100);
                        const isConfirmed = syn.status === "confirmed";
                        return (
                          <div
                            key={syn.id}
                            className="flex items-center gap-3 py-1.5"
                            data-testid={`row-synonym-${syn.id}`}
                          >
                            <span className="text-sm min-w-[120px] truncate font-mono">{syn.synonym}</span>
                            <Badge
                              variant={isConfirmed ? "default" : "outline"}
                              className={`text-[10px] ${isConfirmed ? "bg-emerald-700 dark:bg-emerald-600" : ""}`}
                              data-testid={`badge-status-${syn.id}`}
                            >
                              {isConfirmed ? "potvrdené" : "učenie"}
                            </Badge>
                            <div className="flex-1 max-w-[160px]">
                              <Progress value={progress} className="h-2" data-testid={`progress-synonym-${syn.id}`} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                              {syn.confirmationCount}/{CONFIRM_THRESHOLD}
                            </span>
                            {!isConfirmed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={confirmMutation.isPending}
                                onClick={() => confirmMutation.mutate(syn.id)}
                                data-testid={`button-confirm-synonym-${syn.id}`}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Potvrdiť
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminUpravy() {
  const { data: appUser, isLoading: loadingUser } = useAppUser();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin" || (appUser?.sentinelLevel ?? 0) >= 5;

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="text-access-denied">
        <ShieldAlert className="w-8 h-8 text-destructive mr-3" />
        <span className="text-lg font-semibold">Prístup zamietnutý</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold" data-testid="text-admin-upravy-title">
          Administrácia & Úpravy
        </h1>
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">D</Badge>
      </div>

      <Tabs defaultValue="contracts" className="w-full">
        <TabsList data-testid="tabs-admin-upravy">
          <TabsTrigger value="contracts" data-testid="tab-contracts">
            <FileEdit className="w-4 h-4 mr-1.5" />
            Zmluvy
          </TabsTrigger>
          <TabsTrigger value="synonyms" data-testid="tab-synonyms">
            <BookOpen className="w-4 h-4 mr-1.5" />
            Synonymá
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contracts" className="mt-4">
          <ContractsSection />
        </TabsContent>
        <TabsContent value="synonyms" className="mt-4">
          <SynonymsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
