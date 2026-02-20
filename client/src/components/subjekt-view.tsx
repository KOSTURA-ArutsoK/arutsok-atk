import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, ClientDataTab, ClientDataCategory, ClientMarketingConsent, ClientType } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, type StaticField } from "@/lib/staticFieldDefs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive, FileText, Eye, EyeOff, ChevronRight, Check, X, Plus } from "lucide-react";
import { formatDateSlovak } from "@/lib/utils";

const TAB_ICONS: Record<string, typeof UserCheck> = {
  UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive,
  FileText, Shield: Scale, Heart: Users,
};

function getTabIcon(iconName: string) {
  return TAB_ICONS[iconName] || FileText;
}

const FIELD_TO_CATEGORY: Record<string, string> = {
  titul_pred: "povinne", meno: "povinne", priezvisko: "povinne", titul_za: "povinne",
  rodne_cislo: "povinne", datum_narodenia: "povinne", vek: "povinne", pohlavie: "povinne",
  miesto_narodenia: "povinne", statna_prislusnost: "povinne", rodne_priezvisko: "dobrovolne",
  typ_dokladu: "dokumentacne", typ_dokladu_iny: "dokumentacne", cislo_dokladu: "dokumentacne",
  platnost_dokladu: "dokumentacne", vydal_organ: "dokumentacne", kod_vydavajuceho_organu: "dokumentacne",
  telefon: "komunikacne", email: "komunikacne",
  tp_ulica: "povinne", tp_supisne: "povinne", tp_orientacne: "povinne",
  tp_mesto: "povinne", tp_psc: "povinne", tp_stat: "povinne",
  korespond_rovnaka: "povinne", ka_ulica: "povinne", ka_supisne: "povinne",
  ka_orientacne: "povinne", ka_mesto: "povinne", ka_psc: "povinne", ka_stat: "povinne",
  kontaktna_rovnaka: "povinne", koa_ulica: "povinne", koa_supisne: "povinne",
  koa_orientacne: "povinne", koa_mesto: "povinne", koa_psc: "povinne", koa_stat: "povinne",
  nazov_organizacie: "povinne", ico: "povinne", sk_nace: "povinne",
  sidlo_ulica: "povinne", sidlo_supisne: "povinne", sidlo_orientacne: "povinne",
  sidlo_mesto: "povinne", sidlo_psc: "povinne", sidlo_stat: "povinne",
  vykon_rovnaky: "povinne", vykon_ulica: "povinne", vykon_supisne: "povinne",
  vykon_orientacne: "povinne", vykon_mesto: "povinne", vykon_psc: "povinne", vykon_stat: "povinne",
  dic: "zakonne", ic_dph: "zakonne",
  pep: "aml", pep_funkcia: "aml", pep_vztah: "aml",
  iban: "zmluvne", bic: "zmluvne", cislo_uctu: "zmluvne",
};

const CONSENT_TYPES = [
  { code: "marketing_email", label: "Email marketing" },
  { code: "marketing_sms", label: "SMS marketing" },
  { code: "marketing_phone", label: "Telefonický marketing" },
  { code: "data_processing", label: "Spracovanie osobných údajov" },
  { code: "third_party", label: "Poskytnutie údajov tretím stranám" },
  { code: "profiling", label: "Profilovanie" },
];

interface SubjektViewProps {
  subject: Subject;
  showPdfSidebar?: boolean;
}

export function SubjektView({ subject, showPdfSidebar = false }: SubjektViewProps) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const [pdfSidebarOpen, setPdfSidebarOpen] = useState(false);
  const [summaryFields, setSummaryFields] = useState<Record<string, boolean>>(() => {
    const prefs = (subject as any).uiPreferences;
    return prefs?.summary_fields || {};
  });

  const { data: tabs, isLoading: tabsLoading } = useQuery<ClientDataTab[]>({
    queryKey: ["/api/client-data-tabs"],
  });

  const { data: categories, isLoading: catsLoading } = useQuery<ClientDataCategory[]>({
    queryKey: ["/api/client-data-categories"],
  });

  const { data: consents } = useQuery<ClientMarketingConsent[]>({
    queryKey: ["/api/subjects", subject.id, "marketing-consents"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/marketing-consents`).then(r => r.json()),
  });

  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const upsertConsent = useMutation({
    mutationFn: async (data: { consentType: string; isGranted: boolean; companyId: number }) => {
      return apiRequest("POST", `/api/subjects/${subject.id}/marketing-consents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "marketing-consents"] });
      toast({ title: "Súhlas aktualizovaný" });
    },
  });

  const updateUiPrefs = useMutation({
    mutationFn: async (prefs: Record<string, any>) => {
      return apiRequest("PATCH", `/api/subjects/${subject.id}/ui-preferences`, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
  });

  const isPerson = subject.type === "person";
  const isSzco = subject.type === "szco";
  const clientTypeId = isSzco ? 3 : isPerson ? 1 : 4;
  const typeFields = getFieldsForClientTypeId(clientTypeId) || [];

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  function getFieldValue(fieldKey: string): string {
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if (details[fieldKey] !== undefined) return String(details[fieldKey] || "");
    return "";
  }

  const fieldsByCategory = useMemo(() => {
    const map: Record<string, StaticField[]> = {};
    for (const field of typeFields) {
      const catCode = field.categoryCode || FIELD_TO_CATEGORY[field.fieldKey] || "doplnkove";
      if (!map[catCode]) map[catCode] = [];
      map[catCode].push(field);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return map;
  }, [typeFields]);

  const categoriesByTab = useMemo(() => {
    if (!categories || !tabs) return {};
    const map: Record<number, ClientDataCategory[]> = {};
    for (const tab of tabs) {
      map[tab.id] = categories
        .filter(c => c.tabId === tab.id && c.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return map;
  }, [categories, tabs]);

  function toggleSummaryField(fieldKey: string) {
    const next = { ...summaryFields, [fieldKey]: !summaryFields[fieldKey] };
    setSummaryFields(next);
    updateUiPrefs.mutate({ summary_fields: next });
  }

  if (tabsLoading || catsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedTabs = [...(tabs || [])].filter(t => t.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const activeCompanyId = appUser?.activeCompanyId;

  return (
    <div className="flex gap-4">
      <div className={pdfSidebarOpen ? "flex-1 min-w-0" : "w-full"}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {isPerson ? "FO" : isSzco ? "SZČO" : "PO"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{subject.uid}</span>
          </div>
          {showPdfSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPdfSidebarOpen(!pdfSidebarOpen)}
              data-testid="button-toggle-pdf-sidebar"
            >
              {pdfSidebarOpen ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              PDF export
            </Button>
          )}
        </div>

        <Tabs defaultValue={sortedTabs[0]?.code || "identita"} data-testid="tabs-subjekt-view">
          <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tablist-subjekt-view">
            {sortedTabs.map(tab => {
              const Icon = getTabIcon(tab.icon || "FileText");
              const tabCats = categoriesByTab[tab.id] || [];
              const totalFields = tabCats.reduce((sum, cat) => sum + (fieldsByCategory[cat.code]?.length || 0), 0);
              return (
                <TabsTrigger key={tab.code} value={tab.code} className="text-xs px-2 py-1.5" data-testid={`tab-${tab.code}`}>
                  <Icon className="w-3.5 h-3.5 mr-1" />
                  {tab.name}
                  {totalFields > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{totalFields}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {sortedTabs.map(tab => {
            const tabCats = categoriesByTab[tab.id] || [];
            return (
              <TabsContent key={tab.code} value={tab.code} className="mt-3" data-testid={`tabcontent-${tab.code}`}>
                {tab.code === "profil" && (
                  <MarketingConsentsSection
                    subjectId={subject.id}
                    consents={consents || []}
                    companies={companies || []}
                    activeCompanyId={activeCompanyId ?? undefined}
                    onToggle={(consentType, isGranted, companyId) => {
                      upsertConsent.mutate({ consentType, isGranted, companyId });
                    }}
                    isPending={upsertConsent.isPending}
                  />
                )}

                {tabCats.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground" data-testid={`empty-tab-${tab.code}`}>
                    Žiadne kategórie v tejto záložke
                  </div>
                ) : (
                  <Accordion
                    type="multiple"
                    defaultValue={tabCats.filter(c => (fieldsByCategory[c.code]?.length || 0) > 0).map(c => c.code)}
                    className="space-y-2"
                  >
                    {tabCats.map(cat => {
                      const catFields = fieldsByCategory[cat.code] || [];
                      const filledCount = catFields.filter(f => !!getFieldValue(f.fieldKey)).length;
                      return (
                        <AccordionItem key={cat.code} value={cat.code} className="border rounded-md px-3" data-testid={`category-${cat.code}`}>
                          <AccordionTrigger className="py-2.5 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                              <span className="text-sm font-medium">{cat.name}</span>
                              {catFields.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {filledCount}/{catFields.length}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {cat.description && (
                              <p className="text-xs text-muted-foreground mb-2">{cat.description}</p>
                            )}
                            {catFields.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">
                                Žiadne polia v tejto kategórii
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {catFields.map(field => {
                                  const value = getFieldValue(field.fieldKey);
                                  const isSummary = summaryFields[field.fieldKey];
                                  return (
                                    <div
                                      key={field.id}
                                      className={`h-10 flex items-center gap-2 px-3 rounded-md border ${
                                        isSummary ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
                                      }`}
                                      data-testid={`field-${field.fieldKey}`}
                                    >
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {field.shortLabel || field.label}:
                                      </span>
                                      <span className="text-sm font-medium truncate max-w-[200px]">
                                        {field.fieldType === "switch"
                                          ? value === "true" ? "Áno" : value === "false" ? "Nie" : "-"
                                          : field.fieldType === "date" && value
                                            ? formatDateSlovak(value)
                                            : value || "-"}
                                      </span>
                                      {pdfSidebarOpen && (
                                        <button
                                          onClick={() => toggleSummaryField(field.fieldKey)}
                                          className="ml-1 opacity-60 hover:opacity-100"
                                          data-testid={`toggle-summary-${field.fieldKey}`}
                                        >
                                          {isSummary ? (
                                            <Eye className="w-3 h-3 text-primary" />
                                          ) : (
                                            <EyeOff className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {pdfSidebarOpen && (
        <div className="w-64 border-l border-border pl-4 space-y-3" data-testid="pdf-summary-sidebar">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">PDF Export polia</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Polia označené ikonou oka sa exportujú do &quot;Záznam zo sprostredkovania&quot;
          </p>
          <Separator />
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {typeFields
              .filter(f => summaryFields[f.fieldKey])
              .map(f => (
                <div key={f.id} className="flex items-center justify-between py-1 px-2 rounded bg-primary/5 border border-primary/20">
                  <span className="text-xs truncate">{f.shortLabel || f.label}</span>
                  <button onClick={() => toggleSummaryField(f.fieldKey)} className="text-destructive hover:opacity-80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            {Object.values(summaryFields).filter(Boolean).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Žiadne polia vybrané pre export
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Celkom: {Object.values(summaryFields).filter(Boolean).length} polí
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingConsentsSection({
  subjectId,
  consents,
  companies,
  activeCompanyId,
  onToggle,
  isPending,
}: {
  subjectId: number;
  consents: ClientMarketingConsent[];
  companies: any[];
  activeCompanyId?: number;
  onToggle: (consentType: string, isGranted: boolean, companyId: number) => void;
  isPending: boolean;
}) {
  const currentCompany = companies?.find((c: any) => c.id === activeCompanyId);

  if (!activeCompanyId || !currentCompany) {
    return (
      <Card className="mb-4" data-testid="marketing-consents-no-company">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">Marketingové súhlasy - vyberte aktívnu firmu pre zobrazenie</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4" data-testid="marketing-consents-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Marketingové súhlasy</span>
          <Badge variant="outline" className="text-[10px]">{currentCompany.name}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Typ súhlasu</TableHead>
              <TableHead className="text-xs w-20 text-center">Stav</TableHead>
              <TableHead className="text-xs w-28">Dátum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONSENT_TYPES.map(ct => {
              const consent = consents.find(
                c => c.consentType === ct.code && c.companyId === activeCompanyId
              );
              const isGranted = consent?.isGranted ?? false;
              return (
                <TableRow key={ct.code} data-testid={`consent-row-${ct.code}`}>
                  <TableCell className="text-xs py-2">{ct.label}</TableCell>
                  <TableCell className="text-center py-2">
                    <Switch
                      checked={isGranted}
                      disabled={isPending}
                      onCheckedChange={(checked) => onToggle(ct.code, checked, activeCompanyId)}
                      data-testid={`consent-switch-${ct.code}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs py-2 text-muted-foreground">
                    {consent?.grantedAt
                      ? formatDateSlovak(String(consent.grantedAt))
                      : consent?.revokedAt
                        ? formatDateSlovak(String(consent.revokedAt))
                        : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
