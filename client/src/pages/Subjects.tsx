import { useState, useRef, useEffect, useCallback } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight, ArrowLeft, ExternalLink, History, Clock, Wallet, Loader2, CheckCircle2, Pencil, Lock, Users, X, Info, Link2, Unlink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogScrollContent,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/schema";
import type { Subject, ClientType, AuditLog } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, getPanelsForClientTypeId, getFieldsForType, getSectionsForType, getPanelsForType, type StaticField, type StaticSection, type StaticPanel } from "@/lib/staticFieldDefs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { HelpCircle, FileText, ShieldCheck, ListPlus, FileQuestion } from "lucide-react";
import { HelpIcon } from "@/components/help-icon";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PRIORITY_COUNTRIES, ALL_COUNTRIES, getDefaultCountryForState } from "@/lib/countries";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const createSchema = insertSubjectSchema.extend({
  stateId: z.coerce.number().min(1, "Povinne"),
  myCompanyId: z.coerce.number().min(1, "Povinne"),
});

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Vytvorenie",
  UPDATE: "Uprava",
  DELETE: "Vymazanie",
  ARCHIVE: "Archivacia",
  RESTORE: "Obnovenie",
  CLICK: "Kliknutie",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  ARCHIVE: "outline",
  RESTORE: "default",
  CLICK: "outline",
};

function SubjectHistoryTab({ subjectId }: { subjectId: number }) {
  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", "entity", subjectId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entityId=${subjectId}&module=subjekty&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const formatDate = formatDateTimeSlovak;

  function formatProcessingTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const logs = data?.logs || [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nacitavam historiu...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-entity-history">Ziadne zaznamy pre tento subjekt</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-3 py-2 px-3 rounded-md border border-border" data-testid={`entity-log-${log.id}`}>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={ACTION_VARIANTS[log.action] || "outline"} className="text-[10px]">
                {ACTION_LABELS[log.action] || log.action}
              </Badge>
              <span className="text-xs text-muted-foreground">{log.username || "-"}</span>
              <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                T_idle: {formatProcessingTime(log.processingTimeSec ?? 0)}
              </span>
              <span className="font-mono" style={{ display: log.ipAddress ? 'inline' : 'none' }}>{log.ipAddress}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectFinanceTab({ subject }: { subject: Subject }) {
  const { toast } = useToast();
  const [kikId, setKikId] = useState(subject.kikId || "");
  const [iban, setIban] = useState(subject.iban || "");
  const [swift, setSwift] = useState(subject.swift || "");
  const [commissionLevel, setCommissionLevel] = useState(subject.commissionLevel?.toString() || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/subjects/${subject.id}/finance`, {
        kikId: kikId || null,
        iban: iban || null,
        swift: swift || null,
        commissionLevel: commissionLevel ? Number(commissionLevel) : null,
      });
    },
    onSuccess: () => {
      toast({ title: "Financne udaje ulozene" });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladani", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">KIK ID</Label>
          <Input value={kikId} onChange={(e) => setKikId(e.target.value)} placeholder="napr. KIK-001234" data-testid="input-kik-id" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Uroven provizii</Label>
          <Input type="number" value={commissionLevel} onChange={(e) => setCommissionLevel(e.target.value)} placeholder="1-10" data-testid="input-commission-level" className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">IBAN</Label>
          <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SK00 0000 0000 0000 0000 0000" data-testid="input-iban" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">SWIFT/BIC</Label>
          <Input value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="napr. TATRSKBX" data-testid="input-swift" className="mt-1" />
        </div>
      </div>
      <Separator />
      <div className="flex justify-end">
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-finance">
          {updateMutation.isPending ? "Ukladam..." : "Ulozit financne udaje"}
        </Button>
      </div>
    </div>
  );
}

const FOLDER_CATEGORY_LABELS: Record<string, string> = {
  povinne: "POVINNE UDAJE",
  doplnkove: "DOPLNKOVE UDAJE",
  volitelne: "VOLITELNE / DOBROVOLNE UDAJE",
};

const FOLDER_CATEGORY_ICONS: Record<string, any> = {
  povinne: ShieldCheck,
  doplnkove: ListPlus,
  volitelne: Eye,
};

const FOLDER_CATEGORY_ORDER = ["povinne", "doplnkove", "volitelne"];

function SubjectDataTab({ subject }: { subject: Subject }) {
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: companies } = useMyCompanies();
  const managingCompany = companies?.find(c => c.id === subject.myCompanyId);

  const isPerson = subject.type === 'person';
  const isSzco = subject.type === 'szco';

  const clientType = clientTypes?.find(ct => {
    if (subject.type === 'szco' && ct.code === 'SZCO') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    return false;
  });

  const clientTypeId = isSzco ? 3 : isPerson ? 1 : 4;
  const typeFields = getFieldsForClientTypeId(clientTypeId);
  const foTypeFields = getFieldsForClientTypeId(1);
  const typeSections = getSectionsForClientTypeId(clientTypeId);

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  function getFieldValue(fieldKey: string): string {
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if ((details as any)[fieldKey] !== undefined) return String((details as any)[fieldKey] || "");
    return "";
  }

  function groupFieldsByCategory() {
    const groups: Record<string, { section: any; fields: StaticField[] }[]> = {
      povinne: [],
      doplnkove: [],
      volitelne: [],
    };

    if (!typeSections || !typeFields) return groups;

    const sectionsSorted = [...typeSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const section of sectionsSorted) {
      const category = (section as any).folderCategory || "volitelne";
      const sectionFields = typeFields
        .filter(f => (f.sectionId || 0) === section.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      if (sectionFields.length > 0) {
        if (!groups[category]) groups[category] = [];
        groups[category].push({ section, fields: sectionFields });
      }
    }

    const unsectionedFields = typeFields.filter(f => (!f.sectionId || f.sectionId === 0));
    if (unsectionedFields.length > 0) {
      groups.volitelne.push({ section: { id: 0, name: "Ostatne" }, fields: unsectionedFields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) });
    }

    return groups;
  }

  const fieldGroups = groupFieldsByCategory();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 p-3 rounded-md bg-muted/30 border border-border">
        <div className="flex-1 min-w-[calc(50%-0.5rem)]">
          <span className="text-xs text-muted-foreground">Typ</span>
          <p className="text-sm font-medium">{isPerson ? 'FO' : isSzco ? 'SZCO' : 'PO'} - {clientType?.name || subject.type}</p>
        </div>
        <div className="flex-1 min-w-[calc(50%-0.5rem)]">
          <span className="text-xs text-muted-foreground">Spravujuca firma</span>
          <p className="text-sm font-medium">{managingCompany?.name || '-'}</p>
        </div>
        {isPerson || isSzco ? (
          <>
            <div className="flex-1 min-w-[calc(50%-0.5rem)]">
              <span className="text-xs text-muted-foreground">Meno</span>
              <p className="text-sm">{subject.firstName || '-'}</p>
            </div>
            <div className="flex-1 min-w-[calc(50%-0.5rem)]">
              <span className="text-xs text-muted-foreground">Priezvisko</span>
              <p className="text-sm">{subject.lastName || '-'}</p>
            </div>
          </>
        ) : (
          <div className="flex-1 min-w-[calc(50%-0.5rem)]">
            <span className="text-xs text-muted-foreground">Nazov spolocnosti</span>
            <p className="text-sm">{subject.companyName || '-'}</p>
          </div>
        )}
        <div className="flex-1 min-w-[calc(50%-0.5rem)]">
          <span className="text-xs text-muted-foreground">Email</span>
          <p className="text-sm">{subject.email || '-'}</p>
        </div>
        <div className="flex-1 min-w-[calc(50%-0.5rem)]">
          <span className="text-xs text-muted-foreground">Telefon</span>
          <p className="text-sm">{subject.phone || '-'}</p>
        </div>
      </div>

      {isSzco && (subject as any).linkedFo && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs">
            Osobne udaje prevzate z FO: <span className="font-medium">{(subject as any).linkedFo.firstName} {(subject as any).linkedFo.lastName}</span> ({(subject as any).linkedFo.uid})
          </p>
        </div>
      )}

      <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
        {FOLDER_CATEGORY_ORDER.map(category => {
          const Icon = FOLDER_CATEGORY_ICONS[category];
          const sectionGroups = fieldGroups[category] || [];
          return (
            <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`accordion-${category}`}>
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {sectionGroups.reduce((acc, g) => acc + g.fields.length, 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {sectionGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Ziadne polia v tejto sekcii</p>
                ) : (
                  <div className="space-y-4">
                    {sectionGroups.map(({ section, fields }) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: sectionGroups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {fields.map(field => {
                            const value = getFieldValue(field.fieldKey);
                            return (
                              <div key={field.id} className="space-y-0.5 flex-1 min-w-[calc(50%-0.75rem)]" data-testid={`field-display-${field.fieldKey}`}>
                                <span className="text-xs text-muted-foreground">{field.label || field.fieldKey}</span>
                                <p className="text-sm">{value || <span className="text-muted-foreground/50">-</span>}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {(subject.type === 'person' || subject.type === 'szco') && (
        <DocumentHistorySection subjectId={subject.id} />
      )}
    </div>
  );
}

function DocumentHistorySection({ subjectId }: { subjectId: number }) {
  const [showHistory, setShowHistory] = useState(false);
  const { data: history, isLoading } = useQuery<any[]>({
    queryKey: [`/api/subjects/${subjectId}/document-history`],
    enabled: showHistory,
  });

  return (
    <div className="border rounded-md" data-testid="document-history-section">
      <button
        type="button"
        className="flex items-center gap-2 w-full p-3 text-left hover-elevate rounded-md"
        onClick={() => setShowHistory(v => !v)}
        data-testid="button-toggle-document-history"
      >
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">Historia dokladov</span>
        <Badge variant="secondary" className="text-[10px]">{showHistory && history ? history.length : '...'}</Badge>
      </button>

      {showHistory && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center gap-2 justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs text-muted-foreground">Nacitavam...</span>
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-document-history">
              Ziadna historia zmien dokladov
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry: any, idx: number) => {
                const validUntil = entry.validUntil ? new Date(entry.validUntil) : null;
                const now = new Date();
                let validityStatus = "";
                let validityColor = "";
                if (validUntil) {
                  if (validUntil < now) {
                    validityStatus = "Neplatny";
                    validityColor = "text-red-500";
                  } else {
                    const threeMonths = new Date();
                    threeMonths.setMonth(threeMonths.getMonth() + 3);
                    if (validUntil < threeMonths) {
                      validityStatus = "Konciaci";
                      validityColor = "text-orange-500";
                    }
                  }
                }
                return (
                  <div key={entry.id} className="flex flex-wrap gap-x-4 gap-y-1 p-2 rounded-md bg-muted/30 border border-border text-xs" data-testid={`document-history-entry-${idx}`}>
                    <div>
                      <span className="text-muted-foreground">Typ: </span>
                      <span className="font-medium">{entry.documentType || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cislo: </span>
                      <span className="font-medium">{entry.documentNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platnost do: </span>
                      <span className={cn("font-medium", validityColor)}>
                        {entry.validUntil ? formatDateSlovak(entry.validUntil) : '-'}
                      </span>
                      {validityStatus && (
                        <span className={cn("ml-1 text-[10px] font-semibold", validityColor)}>({validityStatus})</span>
                      )}
                    </div>
                    {entry.issuedBy && (
                      <div>
                        <span className="text-muted-foreground">Vydal: </span>
                        <span className="font-medium">{entry.issuedBy}</span>
                      </div>
                    )}
                    {entry.issuingAuthorityCode && (
                      <div>
                        <span className="text-muted-foreground">Kod organu: </span>
                        <span className="font-medium">{entry.issuingAuthorityCode}</span>
                      </div>
                    )}
                    <div className="w-full">
                      <span className="text-muted-foreground">Archivovane: </span>
                      <span>{entry.archivedAt ? formatDateTimeSlovak(entry.archivedAt) : '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EnrichedEntityLink = {
  id: number;
  sourceId: number;
  targetId: number;
  dateFrom: string;
  dateTo: string | null;
  createdAt: string;
  source: { id: number; uid: string; type: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null } | null;
  target: { id: number; uid: string; type: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null } | null;
};

function getSubjectLabel(s: { type: string; firstName: string | null; lastName: string | null; companyName: string | null } | null) {
  if (!s) return "Neznamy subjekt";
  if (s.type === 'person' || s.type === 'szco') return `${s.lastName || ''}, ${s.firstName || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '') || 'Bez mena';
  return s.companyName || 'Bez nazvu';
}

function EntityLinksTab({ subject }: { subject: Subject }) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: links, isLoading } = useQuery<EnrichedEntityLink[]>({
    queryKey: ['/api/entity-links', subject.id],
  });

  const closeMutation = useMutation({
    mutationFn: async (linkId: number) => {
      await apiRequest("PATCH", `/api/entity-links/${linkId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entity-links', subject.id] });
      toast({ title: "Prepojenie ukoncene" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa ukoncit prepojenie", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (targetId: number) => {
      await apiRequest("POST", "/api/entity-links", { sourceId: subject.id, targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entity-links', subject.id] });
      setShowAddDialog(false);
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Prepojenie vytvorene" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvorit prepojenie", variant: "destructive" });
    },
  });

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/subjects/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults((data || []).filter((s: any) => s.id !== subject.id));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [subject.id]);

  const activeLinks = (links || []).filter(l => !l.dateTo);
  const historicLinks = (links || []).filter(l => l.dateTo);

  const getOtherSubject = (link: EnrichedEntityLink) => {
    return link.sourceId === subject.id ? link.target : link.source;
  };

  const formatDate = (d: string | null) => d ? formatDateSlovak(d) : null;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-6">Nacitavam prepojenia...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Vztahy a prepojenia</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} data-testid="button-add-entity-link">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Pridat prepojenie
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default">Aktualne</Badge>
          <span className="text-xs text-muted-foreground">({activeLinks.length})</span>
        </div>
        {activeLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center" data-testid="text-no-active-links">Ziadne aktivne prepojenia</p>
        ) : (
          <div className="space-y-2">
            {activeLinks.map(link => {
              const other = getOtherSubject(link);
              return (
                <Card key={link.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {other?.type === 'person' || other?.type === 'szco'
                          ? <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          : <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-link-name-${link.id}`}>{getSubjectLabel(other)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{other?.uid}</span>
                            <span>od {formatDate(link.dateFrom)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => closeMutation.mutate(link.id)}
                        disabled={closeMutation.isPending}
                        data-testid={`button-close-link-${link.id}`}
                      >
                        <Unlink className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {historicLinks.length > 0 && (
        <div>
          <Separator className="my-3" />
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">Historia</Badge>
            <span className="text-xs text-muted-foreground">({historicLinks.length})</span>
          </div>
          <div className="space-y-2">
            {historicLinks.map(link => {
              const other = getOtherSubject(link);
              return (
                <Card key={link.id}>
                  <CardContent className="p-3 opacity-60">
                    <div className="flex items-center gap-2 min-w-0">
                      {other?.type === 'person' || other?.type === 'szco'
                        ? <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        : <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-link-history-name-${link.id}`}>{getSubjectLabel(other)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{other?.uid}</span>
                          <span>{formatDate(link.dateFrom)} - {formatDate(link.dateTo)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Pridat prepojenie</DialogTitle>
            <DialogDescription>Vyhladajte subjekt pre vytvorenie prepojenia</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Input
              placeholder="Hladat podla mena, UID, emailu..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="input-search-entity-link"
            />
            {searching && <p className="text-xs text-muted-foreground">Hladam...</p>}
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => createMutation.mutate(s.id)}
                    data-testid={`button-select-link-target-${s.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {s.type === 'person' || s.type === 'szco'
                        ? <User className="w-4 h-4 text-muted-foreground" />
                        : <Building2 className="w-4 h-4 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.type === 'company' ? (s.companyName || 'Bez nazvu') : `${s.lastName || ''}, ${s.firstName || ''}`}
                        </p>
                        <span className="text-xs text-muted-foreground font-mono">{s.uid}</span>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Ziadne vysledky</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubjectDetailDialog({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { data: careerHistory, isLoading } = useSubjectCareerHistory(subject.id);
  const { data: companies } = useMyCompanies();
  const managingCompany = companies?.find(c => c.id === subject.myCompanyId);

  const formatDate = (d: string | null) => d ? formatDateSlovak(d) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="xl" className="items-stretch justify-start">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              {subject.type === 'person' ? <User className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-subject-detail-name">
                {subject.type === 'person'
                  ? `${subject.lastName}, ${subject.firstName}`
                  : subject.companyName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{subject.uid}</span>
                {(() => {
                  const status = getSubjectStatus(subject);
                  return (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${status.bgColor} ${status.borderColor} ${status.textColor}`}
                      data-testid={`status-dialog-subject-${subject.id}`}
                    >
                      {status.label}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogScrollContent>
        <Tabs defaultValue="udaje" className="flex-1">
          <TabsList data-testid="tabs-subject-detail">
            <TabsTrigger value="udaje" data-testid="tab-subject-udaje">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Udaje klienta
            </TabsTrigger>
            <TabsTrigger value="detail" data-testid="tab-subject-info">
              <User className="w-3.5 h-3.5 mr-1" />
              Detail
            </TabsTrigger>
            <TabsTrigger value="historia" data-testid="tab-subject-historia">
              <History className="w-3.5 h-3.5 mr-1" />
              Historia
            </TabsTrigger>
            <TabsTrigger value="financie" data-testid="tab-subject-financie">
              <Wallet className="w-3.5 h-3.5 mr-1" />
              Financie
            </TabsTrigger>
            <TabsTrigger value="vztahy" data-testid="tab-subject-vztahy">
              <Link2 className="w-3.5 h-3.5 mr-1" />
              Vztahy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="udaje" className="mt-3">
            <SubjectDataTab subject={subject} />
          </TabsContent>

          <TabsContent value="detail" className="mt-3">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Typ entity</span>
                  <p className="text-sm">{subject.type === 'person' ? 'Fyzicka osoba' : subject.type === 'szco' ? 'SZCO' : 'Pravnicka osoba'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Spravujuca firma</span>
                  <p className="text-sm">{(subject as any).companyName || managingCompany?.name || '-'}</p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Historia kariery v systeme</h3>
                </div>

                {isLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nacitavam historiu...</p>
                ) : !careerHistory || careerHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-career-history">
                    Ziadna historia vazby v systeme
                  </p>
                ) : (
                  <div className="relative space-y-0">
                    <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />
                    {careerHistory.map((entry, idx) => (
                      <div key={idx} className="relative pl-10 py-3" data-testid={`career-entry-${idx}`}>
                        <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 ${
                          entry.isActive 
                            ? 'bg-primary border-primary' 
                            : 'bg-muted border-muted-foreground/40'
                        }`} />
                        <div className="flex items-start gap-2 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{entry.entityName}</span>
                              <Badge variant={entry.type === 'internal' ? 'default' : 'outline'}>
                                {entry.type === 'internal' ? 'Interny' : 'Externy'}
                              </Badge>
                              <Badge variant="secondary" style={{ display: entry.isActive ? 'inline-flex' : 'none' }}>Aktivny</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.role}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(entry.validFrom) || "-"}</span>
                              <ArrowRight className="w-3 h-3" />
                              <span>{entry.isActive && !entry.validTo ? "Sucasnost" : (formatDate(entry.validTo) || "-")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historia" className="mt-3">
            <SubjectHistoryTab subjectId={subject.id} />
          </TabsContent>

          <TabsContent value="financie" className="mt-3">
            <SubjectFinanceTab subject={subject} />
          </TabsContent>

          <TabsContent value="vztahy" className="mt-3">
            <EntityLinksTab subject={subject} />
          </TabsContent>
        </Tabs>
        </DialogScrollContent>
      </DialogContent>
    </Dialog>
  );
}

function InitialRegistrationModal({
  open,
  onOpenChange,
  onProceed,
  onViewSubject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: (data: { clientTypeCode: string; stateId: number; baseValue: string }) => void;
  onViewSubject: (id: number) => void;
}) {
  const { data: appUser } = useAppUser();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const [selectedType, setSelectedType] = useState("");
  const [baseValue, setBaseValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; uid: string; id: number; matchedField?: string } | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);
  const proceedBtnRef = useRef<HTMLButtonElement>(null);

  const selectedClientType = clientTypes?.find(ct => ct.code === selectedType);
  const baseParamLabel = selectedClientType?.baseParameter === "ico" ? "ICO" : "Rodne cislo (RC)";

  const performDuplicateCheck = useCallback(async (value: string, _paramType: string | undefined) => {
    if (!value.trim()) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      return;
    }
    setChecking(true);
    try {
      const trimmed = value.trim();
      const body = { birthNumber: trimmed, ico: trimmed };
      const res = await apiRequest("POST", "/api/subjects/check-duplicate", body);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateInfo({ name: data.subject.name, uid: data.subject.uid, id: data.subject.id, matchedField: data.subject.matchedField });
      } else {
        setDuplicateInfo(null);
      }
      setDuplicateChecked(true);
      if (!data.isDuplicate) {
        setTimeout(() => proceedBtnRef.current?.focus(), 50);
      }
    } catch {
      setDuplicateInfo(null);
      setDuplicateChecked(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!baseValue.trim() || !selectedType) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDuplicateChecked(false);
    debounceRef.current = setTimeout(() => {
      performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [baseValue, selectedType, selectedClientType?.baseParameter, performDuplicateCheck]);

  function handleProceed() {
    if (duplicateInfo) return;
    onProceed({
      clientTypeCode: selectedType,
      stateId: appUser?.activeStateId || 0,
      baseValue: baseValue.trim(),
    });
    setSelectedType("");
    setBaseValue("");
    setDuplicateInfo(null);
    setDuplicateChecked(false);
  }

  const canProceed = selectedType && appUser?.activeStateId && baseValue.trim() && duplicateChecked && !duplicateInfo;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) { setDuplicateInfo(null); setDuplicateChecked(false); setBaseValue(""); setSelectedType(""); }
      onOpenChange(o);
    }}>
      <DialogContent size="sm" className="flex flex-col items-stretch justify-start">
        <DialogHeader>
          <DialogTitle>Registracia noveho klienta</DialogTitle>
          <DialogDescription>
            Vyberte typ klienta, stat a zadajte zakladny identifikator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Typ klienta</Label>
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setDuplicateInfo(null); setTimeout(() => baseInputRef.current?.focus(), 50); }}>
              <SelectTrigger data-testid="select-client-type">
                <SelectValue placeholder="Vyberte typ" />
              </SelectTrigger>
              <SelectContent>
                {clientTypes?.filter(ct => ct.isActive).map(ct => (
                  <SelectItem key={ct.code} value={ct.code}>{ct.name} ({ct.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ display: selectedType ? 'block' : 'none' }}>
            <Label className="text-xs">{baseParamLabel}</Label>
            <div className="relative">
              <Input
                ref={baseInputRef}
                placeholder={selectedClientType?.baseParameter === "ico" ? "napr. 12345678" : "napr. 900101/1234"}
                value={baseValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setBaseValue(val);
                  const digitsOnly = val.replace(/[^0-9]/g, "");
                  if (selectedClientType?.baseParameter === "rc" && digitsOnly.length >= 10) {
                    setTimeout(() => proceedBtnRef.current?.focus(), 550);
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canProceed && !checking) handleProceed(); }}
                data-testid="input-base-parameter"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: checking ? 'block' : 'none' }}>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (!checking && duplicateChecked && !duplicateInfo && baseValue.trim()) ? 'block' : 'none' }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>

          <div style={{ display: duplicateInfo ? 'block' : 'none' }}>
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-sm font-semibold text-destructive">Klient uz existuje</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {duplicateInfo?.name} <span className="font-mono text-xs">[ {duplicateInfo?.uid} ]</span>
                <span style={{ display: duplicateInfo?.matchedField ? 'inline' : 'none' }} className="text-xs ml-1">(zhoda: {duplicateInfo?.matchedField})</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (duplicateInfo) {
                    onOpenChange(false);
                    onViewSubject(duplicateInfo.id);
                  }
                }}
                data-testid="button-go-to-client"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Prejst na kartu klienta
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-init-reg">
              Zrusit
            </Button>
            <Button
              ref={proceedBtnRef}
              onClick={handleProceed}
              disabled={!canProceed || checking}
              data-testid="button-continue-reg"
            >
              {checking ? "Overujem..." : "Pokracovat"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DynamicFieldInput({ field, dynamicValues, setDynamicValues, hasError, disabled }: {
  field: StaticField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const errorBorder = hasError ? "border-red-500 ring-1 ring-red-500" : "";
  return (
    <div className="space-y-1">
      <Label className={`text-xs truncate block ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
        {field.shortLabel ? (
          <>
            <span className="hidden lg:inline">{field.label || field.fieldKey}</span>
            <span className="inline lg:hidden">{field.shortLabel}</span>
          </>
        ) : (
          <span>{field.label || field.fieldKey}</span>
        )}
        {field.isRequired ? " *" : ""}
      </Label>
      {field.fieldType === "long_text" ? (
        <Textarea
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          rows={2}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "combobox" || field.fieldType === "jedna_moznost" ? (
        <Select
          value={dynamicValues[field.fieldKey] || ""}
          onValueChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
          disabled={disabled}
        >
          <SelectTrigger className={cn(errorBorder, disabled && "bg-muted/50 cursor-default opacity-100")} data-testid={`select-dynamic-${field.fieldKey}`}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.fieldType === "viac_moznosti" ? (
        <MultiSelectCheckboxes
          paramId={field.fieldKey}
          options={field.options || []}
          value={dynamicValues[field.fieldKey] || ""}
          onChange={(val) => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
        />
      ) : field.fieldType === "switch" ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(checked) }))}
            data-testid={`switch-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "checkbox" ? (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(!!checked) }))}
            data-testid={`checkbox-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "date" ? (
        (() => {
          const dateVal = dynamicValues[field.fieldKey] || "";
          let validityClass = "";
          let validityLabel = "";
          if (field.fieldKey === "platnost_dokladu" && dateVal) {
            const expiry = new Date(dateVal);
            const now = new Date();
            const threeMonths = new Date();
            threeMonths.setMonth(threeMonths.getMonth() + 3);
            if (expiry < now) {
              validityClass = "border-red-500 bg-red-500/10 ring-1 ring-red-500";
              validityLabel = "Neplatný";
            } else if (expiry < threeMonths) {
              validityClass = "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500";
              validityLabel = "Končiaci";
            }
          }
          return (
            <div className="relative">
              <Input
                type="date"
                value={dateVal}
                onChange={e => { if (disabled) return; setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value })); }}
                readOnly={disabled}
                tabIndex={disabled ? -1 : undefined}
                className={cn(errorBorder || validityClass, disabled && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
                data-testid={`input-dynamic-${field.fieldKey}`}
              />
              {validityLabel && (
                <span className={cn(
                  "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none",
                  validityLabel === "Neplatný" ? "text-red-500" : "text-orange-500"
                )} data-testid={`validity-status-${field.fieldKey}`}>
                  {validityLabel}
                </span>
              )}
            </div>
          );
        })()
      ) : field.fieldType === "number" && field.fieldKey === "vek" ? (
        <div
          className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground antialiased cursor-default select-none"
          data-testid={`input-dynamic-${field.fieldKey}`}
        >
          {dynamicValues[field.fieldKey] ? `${dynamicValues[field.fieldKey]} rokov` : ""}
        </div>
      ) : field.fieldType === "number" ? (
        <Input
          type="number"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "email" ? (
        <Input
          type="email"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "phone" ? (
        <Input
          type="tel"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "iban" ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value.toUpperCase() }))}
          placeholder="SK00 0000 0000 0000 0000 0000"
          className={`font-mono ${errorBorder}`}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      )}
    </div>
  );
}

function FullPageEditor({
  initialData,
  onCancel,
}: {
  initialData: { clientTypeCode: string; stateId: number; baseValue: string };
  onCancel: () => void;
}) {
  const { mutate, isPending } = useCreateSubject();
  const { toast } = useToast();
  const { data: companies } = useMyCompanies();
  const { data: allStates, isLoading: statesLoading } = useStates();
  const { data: clientTypes, isLoading: typesLoading } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: appUser } = useAppUser();
  const timerRef = useRef<number>(performance.now());

  const clientType = clientTypes?.find(ct => ct.code === initialData.clientTypeCode);
  const isPerson = clientType?.baseParameter === "rc";
  const state = allStates?.find(s => s.id === initialData.stateId);

  const isSzcoType = clientType?.code === 'SZCO';
  const [szcoPersonalData, setSzcoPersonalData] = useState({ firstName: "", lastName: "", birthNumber: "" });

  const [dynamicValues, setDynamicValuesRaw] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const setDynamicValues: typeof setDynamicValuesRaw = (updater) => {
    setDynamicValuesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const changedKeys = Object.keys(next).filter(k => next[k] !== prev[k]);
      if (changedKeys.length > 0 && validationErrors.size > 0) {
        setValidationErrors(prev => {
          const updated = new Set(prev);
          changedKeys.forEach(k => updated.delete(k));
          return updated.size === prev.size ? prev : updated;
        });
      }
      return next;
    });
  };

  const parseRodneCislo = (rc: string): { pohlavie?: string; datumNarodenia?: string } => {
    const clean = rc.replace(/[\s\/]/g, "");
    if (clean.length < 6 || !/^\d+$/.test(clean)) return {};
    const yy = parseInt(clean.substring(0, 2), 10);
    let mm = parseInt(clean.substring(2, 4), 10);
    const dd = parseInt(clean.substring(4, 6), 10);
    const pohlavie = mm > 50 ? "žena" : "muž";
    if (mm > 50) mm -= 50;
    if (mm > 20) mm -= 20;
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { pohlavie };
    const dateStr = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return { pohlavie };
    return { pohlavie, datumNarodenia: dateStr };
  };

  useEffect(() => {
    if (isPerson && state?.name && !dynamicValues["statna_prislusnost"]) {
      const defaultCountry = getDefaultCountryForState(state.name);
      setDynamicValues(prev => prev["statna_prislusnost"] ? prev : { ...prev, statna_prislusnost: defaultCountry });
    }
  }, [isPerson, state?.name]);

  useEffect(() => {
    if (!isPerson) return;
    const rc = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
    if (!rc) return;
    const parsed = parseRodneCislo(rc);
    if (parsed.pohlavie || parsed.datumNarodenia) {
      setDynamicValues(prev => {
        const updates: Record<string, string> = {};
        if (parsed.pohlavie && prev["pohlavie"] !== parsed.pohlavie) updates["pohlavie"] = parsed.pohlavie;
        if (parsed.datumNarodenia && prev["datum_narodenia"] !== parsed.datumNarodenia) updates["datum_narodenia"] = parsed.datumNarodenia;
        if (parsed.datumNarodenia) {
          const birth = new Date(parsed.datumNarodenia);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const mDiff = today.getMonth() - birth.getMonth();
          if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
          const ageStr = String(age >= 0 ? age : 0);
          if (prev["vek"] !== ageStr) updates["vek"] = ageStr;
        }
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [isPerson, dynamicValues["rodne_cislo"], initialData.baseValue]);

  const editorClientTypeId = clientType?.code === 'SZCO' ? 3 : clientType?.code === 'PO' ? 4 : 1;
  const typeFields = getFieldsForClientTypeId(editorClientTypeId);
  const typeSections = getSectionsForClientTypeId(editorClientTypeId);

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const activeCompanyName = companies?.find(c => c.id === appUser?.activeCompanyId)?.name || "";

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser?.activeCompanyId || 0,
    },
  });

  const formResetDone = useRef(false);
  if (!formResetDone.current && clientType && state && appUser?.activeCompanyId) {
    formResetDone.current = true;
    form.reset({
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser.activeCompanyId,
    });
  }

  if (statesLoading || typesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam udaje...</p>
      </div>
    );
  }

  function onSubmit(data: z.infer<typeof createSchema>) {
    const requiredFields = (typeFields || []).filter(f => f.isRequired && isFieldVisible(f));
    const missingFields = requiredFields.filter(f => !dynamicValues[f.fieldKey]?.trim());

    if (isPerson) {
      const addressRequired: { key: string; label: string }[] = [
        { key: "tp_ulica", label: "Ulica (trvalý pobyt)" },
        { key: "tp_orientacne", label: "Orientačné číslo (trvalý pobyt)" },
        { key: "tp_psc", label: "PSČ (trvalý pobyt)" },
        { key: "tp_mesto", label: "Mesto (trvalý pobyt)" },
      ];
      for (const ar of addressRequired) {
        if (!dynamicValues[ar.key]?.trim()) {
          missingFields.push({ fieldKey: ar.key, label: ar.label } as any);
        }
      }
    }

    if (missingFields.length > 0) {
      setValidationErrors(new Set(missingFields.map(f => f.fieldKey)));
      toast({ title: "Chýbajúce povinné polia", description: missingFields.map(f => f.label || f.fieldKey).join(", "), variant: "destructive" });
      return;
    }
    setValidationErrors(new Set());

    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const existingDetails = (typeof data.details === "object" && data.details) ? data.details : {};
    const mergedDetails = Object.keys(dynamicValues).length > 0
      ? { ...(existingDetails as Record<string, any>), dynamicFields: dynamicValues }
      : existingDetails;
    const submitData: any = { ...data, details: mergedDetails, processingTimeSec };
    if (isPerson && dynamicValues.meno) submitData.firstName = dynamicValues.meno;
    if (isPerson && dynamicValues.priezvisko) submitData.lastName = dynamicValues.priezvisko;
    if (isSzcoType) {
      if (!szcoPersonalData.firstName || !szcoPersonalData.lastName) {
        toast({ title: "Chybajuce osobne udaje", description: "Vyplnte meno a priezvisko pre SZCO.", variant: "destructive" });
        return;
      }
      submitData.firstName = szcoPersonalData.firstName;
      submitData.lastName = szcoPersonalData.lastName;
      if (szcoPersonalData.birthNumber) submitData.birthNumber = szcoPersonalData.birthNumber;
      submitData.type = "szco";
    }
    mutate(submitData, {
      onSuccess: () => { onCancel(); },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat
        </Button>
        <div>
          <h2 className="text-xl font-bold">Novy klient - {clientType?.name || initialData.clientTypeCode}</h2>
          <p className="text-xs text-muted-foreground">
            {isPerson ? `RC: ${initialData.baseValue}` : `ICO: ${initialData.baseValue}`}
            {state ? ` | Stat: ${state.name}` : ""}
          </p>
        </div>
      </div>

      {isSzcoType && (
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Osobne udaje SZCO</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Meno *</Label>
                <Input
                  value={szcoPersonalData.firstName}
                  onChange={e => setSzcoPersonalData(prev => ({ ...prev, firstName: e.target.value }))}
                  data-testid="input-szco-firstname"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priezvisko *</Label>
                <Input
                  value={szcoPersonalData.lastName}
                  onChange={e => setSzcoPersonalData(prev => ({ ...prev, lastName: e.target.value }))}
                  data-testid="input-szco-lastname"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rodne cislo</Label>
              <Input
                value={szcoPersonalData.birthNumber}
                onChange={e => setSzcoPersonalData(prev => ({ ...prev, birthNumber: e.target.value }))}
                placeholder="XXXXXX/XXXX"
                data-testid="input-szco-rc"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {isPerson ? (() => {
                const FO_POVINNE_ROWS: { keys: string[] }[] = [
                  { keys: ["titul_pred", "meno", "priezvisko", "titul_za"] },
                  { keys: ["rodne_priezvisko", "datum_narodenia", "vek", "pohlavie"] },
                  { keys: ["miesto_narodenia", "statna_prislusnost"] },
                  { keys: ["typ_dokladu", "cislo_dokladu", "platnost_dokladu", "vydal_organ"] },
                ];

                const ADDRESS_PANEL_FIELDS = {
                  tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
                  ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
                  koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
                };
                const ADDRESS_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];
                const allAddressKeys = new Set([
                  ...Object.values(ADDRESS_PANEL_FIELDS).flatMap(p => p.keys),
                  ...ADDRESS_SWITCH_KEYS,
                ]);

                const allRowKeys = new Set(FO_POVINNE_ROWS.flatMap(r => r.keys).concat(Array.from(allAddressKeys)).concat(["telefon", "rodne_cislo"]));

                const povinneSection = typeSections?.find(s => (s as any).folderCategory === "povinne");
                const povinneFields = (typeFields || [])
                  .filter(f => povinneSection && (f.sectionId || 0) === povinneSection.id)
                  .filter(f => isFieldVisible(f));
                const povinneRemainder = povinneFields.filter(f => !allRowKeys.has(f.fieldKey)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

                const nonPovinneGroups: { section: any; fields: StaticField[] }[] = [];
                const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                for (const section of sectionsSorted) {
                  const category = (section as any).folderCategory || "volitelne";
                  if (category === "povinne") continue;
                  const sectionFields = (typeFields || [])
                    .filter(f => (f.sectionId || 0) === section.id)
                    .filter(f => isFieldVisible(f))
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                  if (sectionFields.length > 0) {
                    nonPovinneGroups.push({ section, fields: sectionFields });
                  }
                }

                return (
                  <>
                    <Accordion type="multiple" defaultValue={["povinne", "doplnkove", "volitelne"]} className="space-y-2">
                      <AccordionItem value="povinne" className="border rounded-md px-3" data-testid="editor-accordion-povinne">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS["povinne"]}</span>
                            <Badge variant="secondary" className="text-[10px]">{povinneFields.length + 3}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="row-system-fields">
                            <div className="space-y-1">
                              <Label className="text-xs">Identifikátor (Rodné číslo)</Label>
                              <Input value={initialData.baseValue} disabled className="font-mono" data-testid="input-identifikator" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Kód klienta</Label>
                              <Input value="Automaticky generovaný" disabled className="font-mono text-xs" data-testid="input-kod-klienta" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Typ klienta</Label>
                              <Input value={clientType?.name || "Fyzická osoba"} disabled data-testid="input-typ-klienta" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3" data-testid="row-ziskatel">
                            <div className="space-y-1">
                              <Label className="text-xs">Získateľ</Label>
                              <Input
                                value={appUser ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username : ""}
                                disabled
                                data-testid="input-ziskatel"
                              />
                            </div>
                          </div>

                          <Card data-testid="panel-osobne-udaje">
                            <CardContent className="p-4 space-y-3">
                              <p className="text-sm font-semibold">Osobné údaje</p>
                              {(() => {
                                const nameRowKeys = FO_POVINNE_ROWS[0].keys;
                                const nameRowFields = nameRowKeys.map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
                                return (
                                  <div className="flex flex-nowrap items-end gap-3" data-testid="row-povinne-3">
                                    {nameRowFields.map(({ key, field }) => {
                                      const wp = field?.widthPercent || 25;
                                      const hasErr = validationErrors.has(key);
                                      const isReq = field?.isRequired;
                                      return (
                                        <div key={key} className="space-y-1" style={{ flex: `0 1 ${wp}%`, minWidth: 0 }}>
                                          <Label className={`text-xs truncate block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>
                                            {field?.shortLabel ? (
                                              <>
                                                <span className="hidden lg:inline">{field.label || key}</span>
                                                <span className="inline lg:hidden">{field.shortLabel}</span>
                                              </>
                                            ) : (
                                              <span>{field?.label || key}</span>
                                            )}
                                            {isReq ? " *" : ""}
                                          </Label>
                                          <Input
                                            placeholder=""
                                            value={dynamicValues[key] || ""}
                                            onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                            className={hasErr ? "border-red-500 ring-1 ring-red-500" : ""}
                                            data-testid={`input-${key}`}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              {FO_POVINNE_ROWS.slice(1).map((row, rowIdx) => {
                                const rowEntries = row.keys
                                  .map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
                                const hasAny = rowEntries.some(e => e.field) || rowEntries.some(e => e.key === "statna_prislusnost");
                                if (!hasAny || rowEntries.length === 0) return null;
                                return (
                                  <div key={rowIdx + 1} className="flex flex-nowrap items-end gap-3" data-testid={`row-povinne-${rowIdx + 4}`}>
                                    {rowEntries.map(({ key, field }) => {
                                      const wp = field?.widthPercent || 25;
                                      if (key === "statna_prislusnost") {
                                        const label = field?.label || "Štátna príslušnosť";
                                        const shortLbl = field?.shortLabel;
                                        const isReq = field?.isRequired;
                                        const hasErr = validationErrors.has(key);
                                        const prioritySet = new Set(PRIORITY_COUNTRIES);
                                        const restCountries = ALL_COUNTRIES.filter(c => !prioritySet.has(c));
                                        return (
                                          <div key={key} style={{ flex: `0 1 ${wp}%`, minWidth: 0 }}>
                                            <div className="space-y-1">
                                              <Label className={`text-xs truncate block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>
                                                {shortLbl ? (
                                                  <>
                                                    <span className="hidden lg:inline">{label}</span>
                                                    <span className="inline lg:hidden">{shortLbl}</span>
                                                  </>
                                                ) : label}
                                                {isReq ? " *" : ""}
                                              </Label>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", hasErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[key] && "text-muted-foreground")} data-testid="select-statna-prislusnost">
                                                    {dynamicValues[key] || ""}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                  <Command>
                                                    <CommandInput placeholder="Hľadať krajinu..." />
                                                    <CommandList>
                                                      <CommandEmpty>Krajina nenájdená.</CommandEmpty>
                                                      <CommandGroup heading="Prioritné">
                                                        {PRIORITY_COUNTRIES.map(c => (
                                                          <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                            <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                            {c}
                                                          </CommandItem>
                                                        ))}
                                                      </CommandGroup>
                                                      <CommandGroup heading="Všetky krajiny">
                                                        {restCountries.map(c => (
                                                          <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                            <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                            {c}
                                                          </CommandItem>
                                                        ))}
                                                      </CommandGroup>
                                                    </CommandList>
                                                  </Command>
                                                </PopoverContent>
                                              </Popover>
                                            </div>
                                          </div>
                                        );
                                      }
                                      const rcSource = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim() || "";
                                      const rcParsedResult = rcSource ? parseRodneCislo(rcSource) : {};
                                      const isRcAuto = (key === "pohlavie" && !!rcParsedResult.pohlavie) || (key === "datum_narodenia" && !!rcParsedResult.datumNarodenia) || (key === "vek" && !!rcParsedResult.datumNarodenia);
                                      return field ? (
                                      <div key={key} style={{ flex: `0 1 ${wp}%`, minWidth: 0 }}>
                                        <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} disabled={isRcAuto} />
                                      </div>
                                    ) : (
                                      <div key={key} style={{ flex: `0 1 ${wp}%`, minWidth: 0 }}>
                                        <div className="space-y-1">
                                          <Label className={`text-xs truncate block text-muted-foreground ${validationErrors.has(key) ? "text-red-500" : ""}`}>{key}</Label>
                                          <Input placeholder="" value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`input-${key}`} />
                                        </div>
                                      </div>
                                    )})}
                                  </div>
                                );
                              })}
                            </CardContent>
                          </Card>

                          {(() => {
                            const korRespondRovnaka = dynamicValues["korespond_rovnaka"] === "true";
                            const kontaktnaRovnaka = dynamicValues["kontaktna_rovnaka"] === "true";

                            const ADDR_FALLBACK_LABELS: Record<string, string> = {
                              ulica: "Ulica", supisne: "Súpisné číslo", orientacne: "Orientačné číslo",
                              psc: "PSČ", mesto: "Mesto", stat: "Štát",
                            };

                            const isAddrFieldHidden = (_key: string) => false;

                            const renderAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                              const findField = (key: string) => povinneFields.find(f => f.fieldKey === key);
                              const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                              const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: isAddrFieldHidden(k) }));
                              const visibleFields = fields.filter(f => !f.hidden);
                              const isRequired = (key: string) => panelDef.requiredKeys.includes(key);

                              if (visibleFields.length === 0) return null;

                              const ADDR_SHORT_LABELS: Record<string, string> = {
                                ulica: "Ulica", supisne: "Súpisné č.", orientacne: "Orient. č.",
                                psc: "PSČ", mesto: "Obec / Mesto", stat: "Štát",
                              };

                              const renderAddrField = (key: string, field: StaticField | undefined, suffix: string, widthPct?: number) => {
                                const label = ADDR_SHORT_LABELS[suffix] || ADDR_FALLBACK_LABELS[suffix] || suffix;
                                const req = isRequired(key);
                                const hasErr = validationErrors.has(key);
                                const wrapStyle = widthPct ? { flex: `0 1 ${widthPct}%`, minWidth: 0 } : {};
                                return (
                                  <div key={key} style={{ ...wrapStyle, pointerEvents: disabled ? "none" : "auto" }}>
                                    <div className="space-y-1">
                                      <Label className={`text-xs truncate block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>{label}{req ? " *" : ""}</Label>
                                      <Input
                                        disabled={disabled}
                                        value={dynamicValues[key] || ""}
                                        onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                        className={hasErr ? "border-red-500 ring-1 ring-red-500" : ""}
                                        data-testid={`input-addr-${key}`}
                                      />
                                    </div>
                                  </div>
                                );
                              };

                              const getF = (suffix: string) => visibleFields.find(f => f.suffix === suffix);
                              const fUlica = getF("ulica");
                              const fSupisne = getF("supisne");
                              const fOrientacne = getF("orientacne");
                              const fPsc = getF("psc");
                              const fMesto = getF("mesto");
                              const fStat = getF("stat");

                              return (
                                <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`panel-address-${prefix}`}>
                                  <CardContent className="p-4 space-y-3">
                                    <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                                    {fUlica && (
                                      <div data-testid={`addr-row-ulica-${prefix}`}>
                                        {renderAddrField(fUlica.key, fUlica.field, fUlica.suffix)}
                                      </div>
                                    )}
                                    {(fSupisne || fOrientacne) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-cisla-${prefix}`}>
                                        {fSupisne && renderAddrField(fSupisne.key, fSupisne.field, fSupisne.suffix, 50)}
                                        {fOrientacne && renderAddrField(fOrientacne.key, fOrientacne.field, fOrientacne.suffix, 50)}
                                      </div>
                                    )}
                                    {(fPsc || fMesto) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-psc-mesto-${prefix}`}>
                                        {fPsc && renderAddrField(fPsc.key, fPsc.field, fPsc.suffix, 30)}
                                        {fMesto && renderAddrField(fMesto.key, fMesto.field, fMesto.suffix, 70)}
                                      </div>
                                    )}
                                    {fStat && (
                                      <div data-testid={`addr-row-stat-${prefix}`}>
                                        {renderAddrField(fStat.key, fStat.field, fStat.suffix)}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            };

                            const showKa = !korRespondRovnaka;
                            const showKoa = !kontaktnaRovnaka;
                            const panelCount = 1 + (showKa ? 1 : 0) + (showKoa ? 1 : 0);
                            const gridClass = panelCount === 3
                              ? "grid-cols-1 md:grid-cols-3"
                              : panelCount === 2
                                ? "grid-cols-1 md:grid-cols-2"
                                : "grid-cols-1";

                            return (
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1" data-testid="row-address-switches">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={korRespondRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))}
                                      data-testid="switch-korespond-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>
                                      Prechodná = Trvalá
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={kontaktnaRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))}
                                      data-testid="switch-kontaktna-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>
                                      Kontaktná = Prechodná
                                    </Label>
                                  </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-3 items-start" data-testid="row-address-panels">
                                  <div className="w-full" style={{ flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("tp", ADDRESS_PANEL_FIELDS.tp, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("ka", ADDRESS_PANEL_FIELDS.ka, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKoa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("koa", ADDRESS_PANEL_FIELDS.koa, false)}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex flex-wrap gap-3" data-testid="row-telefon">
                            <div className="space-y-1 flex-1 min-w-[calc(50%-0.375rem)]">
                              <Label className="text-xs">Tel. číslo (primárne) *</Label>
                              <InternationalPhoneInput
                                value={dynamicValues["telefon"] || ""}
                                onChange={(val) => setDynamicValues(prev => ({ ...prev, telefon: val }))}
                                dialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
                                data-testid="input-telefon-primary"
                              />
                            </div>
                          </div>

                          <div style={{ display: povinneRemainder.length > 0 ? 'block' : 'none' }}>
                            <div className="flex flex-wrap gap-3" data-testid="row-povinne-remainder">
                              {povinneRemainder.map(field => (
                                <div key={field.id} className="flex-1 min-w-[calc(50%-0.375rem)]">
                                  <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {(["doplnkove", "volitelne"] as const).map(category => {
                        const Icon = FOLDER_CATEGORY_ICONS[category];
                        const groups = nonPovinneGroups.filter(g => (g.section as any).folderCategory === category);
                        const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                        if (totalFields === 0) return null;
                        return (
                          <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-4">
                                {groups.map(({ section, fields }) => (
                                  <div key={section.id} className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    <div className="flex flex-wrap gap-3">
                                      {fields.map((field: StaticField) => (
                                        <div key={field.id} className="flex-1 min-w-[calc(50%-0.375rem)]">
                                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                  </>
                );
              })() : (
                <>
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Názov spoločnosti</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-companyname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div>
                    <Label className="text-xs text-muted-foreground">IČO</Label>
                    <Input value={initialData.baseValue} disabled className="mt-1" data-testid="input-ico-locked" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" {...field} value={field.value || ""} data-testid="input-subject-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefón</FormLabel>
                        <FormControl><Input type="tel" {...field} value={field.value || ""} data-testid="input-subject-phone" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {typeFields && typeFields.length > 0 && (() => {
                    const editorFieldGroups: Record<string, { section: any; fields: StaticField[] }[]> = {
                      povinne: [], doplnkove: [], volitelne: [],
                    };
                    const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    for (const section of sectionsSorted) {
                      const category = (section as any).folderCategory || "volitelne";
                      const sectionFields = (typeFields || [])
                        .filter(f => (f.sectionId || 0) === section.id)
                        .filter(f => isFieldVisible(f))
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                      if (sectionFields.length > 0) {
                        if (!editorFieldGroups[category]) editorFieldGroups[category] = [];
                        editorFieldGroups[category].push({ section, fields: sectionFields });
                      }
                    }
                    return (
                      <div className="space-y-2 pt-2">
                        <Separator />
                        <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
                          {FOLDER_CATEGORY_ORDER.map(category => {
                            const Icon = FOLDER_CATEGORY_ICONS[category];
                            const groups = editorFieldGroups[category] || [];
                            const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                            if (totalFields === 0) return null;
                            return (
                              <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                                <AccordionTrigger className="py-3 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                    <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                  <div className="space-y-4">
                                    {groups.map(({ section, fields }) => (
                                      <div key={section.id} className="space-y-3">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          {fields.map((field: StaticField) => (
                                            <DynamicFieldInput key={field.id} field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Integritne upozornenie:</strong> Vytvorenie subjektu vygeneruje permanentny, nemenitelny
                  unikatny identifikator. Vsetky budu zmeny archivovane.
                </p>
              </div>

              <div className="flex justify-end gap-2 sticky bottom-0 bg-card pt-3 pb-1 border-t border-border">
                <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-subject">Zrusit</Button>
                <Button type="submit" disabled={isPending} data-testid="button-save-subject">
                  {isPending ? "Registrujem..." : "Registrovat subjekt"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

type SubjectStatusCategory = "other_company" | "deceased" | "no_contract" | "active" | "inactive";

const STATUS_CONFIG: Record<SubjectStatusCategory, { color: string; bgColor: string; borderColor: string; shadowColor: string; textColor: string; label: string }> = {
  other_company: { color: "bg-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-400", shadowColor: "shadow-gray-400/40", textColor: "text-gray-600 dark:text-gray-300", label: "Ina spolocnost" },
  deceased: { color: "bg-black dark:bg-gray-200", bgColor: "bg-black/10 dark:bg-gray-200/10", borderColor: "border-black dark:border-gray-200", shadowColor: "shadow-black/40 dark:shadow-gray-200/40", textColor: "text-black dark:text-gray-200", label: "Zosnuly" },
  no_contract: { color: "bg-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500", shadowColor: "shadow-blue-500/40", textColor: "text-blue-700 dark:text-blue-300", label: "Bez zmluvy" },
  active: { color: "bg-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500", shadowColor: "shadow-emerald-500/40", textColor: "text-emerald-700 dark:text-emerald-300", label: "Aktivny" },
  inactive: { color: "bg-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500", shadowColor: "shadow-red-500/40", textColor: "text-red-700 dark:text-red-300", label: "Neaktivny" },
};

function getSubjectStatusCategory(subject: any, activeCompanyId?: number): SubjectStatusCategory {
  if ((subject as any).isDeceased) return "deceased";
  if (!subject.isActive) return "inactive";
  if (activeCompanyId && subject.myCompanyId !== activeCompanyId) return "other_company";
  if ((subject.contractCount ?? 0) === 0) return "no_contract";
  return "active";
}

function getSubjectStatus(subject: any, activeCompanyId?: number): { color: string; bgColor: string; borderColor: string; textColor: string; label: string; category: SubjectStatusCategory } {
  const category = getSubjectStatusCategory(subject, activeCompanyId);
  const config = STATUS_CONFIG[category];
  return { color: config.color, bgColor: config.bgColor, borderColor: config.borderColor, textColor: config.textColor, label: config.label, category };
}

function SubjectEditModal({ subject, onClose }: { subject: Subject & { isOwner?: boolean }; onClose: () => void }) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const { data: allStates } = useStates();
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef<number>(performance.now());

  const isPerson = subject.type === 'person';
  const isSzco = subject.type === 'szco';
  const linkedFo = (subject as any).linkedFo;
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || {};

  const clientType = clientTypes?.find(ct => {
    if (isSzco && ct.code === 'SZCO') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    return false;
  });

  const modalClientTypeId = isSzco ? 3 : subject.type === 'company' ? 4 : 1;
  const typeFields = getFieldsForClientTypeId(modalClientTypeId);
  const typeSections = getSectionsForClientTypeId(modalClientTypeId);

  const CORE_FIELD_MAP: Record<string, string> = {
    email: "email",
    telefon: "phone",
    cislo_dokladu: "idCardNumber",
    meno: "firstName",
    priezvisko: "lastName",
  };

  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (dynamicFields && typeof dynamicFields === 'object') {
      Object.entries(dynamicFields).forEach(([key, val]) => {
        initial[key] = String(val || "");
      });
    }
    const configuredKeys = new Set<string>();
    if (typeFields) typeFields.forEach(f => configuredKeys.add(f.fieldKey));
    Object.entries(CORE_FIELD_MAP).forEach(([fieldKey, subjectKey]) => {
      if (!initial[fieldKey]) {
        const val = (subject as any)[subjectKey];
        if (val) initial[fieldKey] = String(val);
      }
    });
    return initial;
  });

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const [formData, setFormData] = useState({
    firstName: subject.firstName || "",
    lastName: subject.lastName || "",
    companyName: subject.companyName || "",
    email: subject.email || "",
    phone: subject.phone || "",
    idCardNumber: subject.idCardNumber || "",
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
      const existingDetails = { ...(subject.details as any || {}) };
      const cleanDynamic = { ...dynamicValues };
      const configuredFieldKeys = new Set((typeFields || []).map(f => f.fieldKey));
      const coreFieldValues: Record<string, string | null> = {};
      Object.entries(CORE_FIELD_MAP).forEach(([fieldKey, subjectKey]) => {
        if (configuredFieldKeys.has(fieldKey)) {
          coreFieldValues[subjectKey] = cleanDynamic[fieldKey] || null;
          delete cleanDynamic[fieldKey];
        }
      });
      existingDetails.dynamicFields = cleanDynamic;
      const payload: any = {
        firstName: coreFieldValues.firstName ?? formData.firstName ?? subject.firstName ?? null,
        lastName: coreFieldValues.lastName ?? formData.lastName ?? subject.lastName ?? null,
        companyName: formData.companyName || subject.companyName || null,
        email: coreFieldValues.email ?? subject.email ?? null,
        phone: coreFieldValues.phone ?? subject.phone ?? null,
        idCardNumber: coreFieldValues.idCardNumber ?? subject.idCardNumber ?? null,
        details: existingDetails,
        processingTimeSec,
        changeReason: "Manualna editacia cez Register subjektov",
      };
      await apiRequest("PUT", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Udaje subjektu aktualizovane" });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Chyba pri ukladani", description: error.message, variant: "destructive" });
    },
  });

  function handleSaveClick() {
    setConfirmOpen(true);
  }

  function handleConfirmSave() {
    setConfirmOpen(false);
    updateMutation.mutate();
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent size="xl" className="items-stretch justify-start">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Pencil className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <DialogTitle data-testid="text-edit-subject-title">
                  Editacia subjektu
                </DialogTitle>
                <DialogDescription>
                  <span className="font-mono text-xs">{subject.uid}</span>
                  <span className="mx-2">|</span>
                  {isPerson ? `${subject.lastName}, ${subject.firstName}` : subject.companyName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogScrollContent className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">NEEDITOVATELNE POLIA</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">UID</Label>
                  <Input value={subject.uid} disabled className="mt-1 font-mono text-xs" data-testid="input-edit-uid-locked" />
                </div>
                {isPerson ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Rodne cislo (RC)</Label>
                    <Input value={subject.birthNumber || ""} disabled className="mt-1" data-testid="input-edit-rc-locked" />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">ICO</Label>
                    <Input value={details.ico || ""} disabled className="mt-1" data-testid="input-edit-ico-locked" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {isAdmin ? "Identifikatory moze zmenit iba admin cez specialny postup." : "Identifikatory (RC/ICO) a UID su uzamknute. Kontaktujte admina pre zmenu."}
              </p>
            </div>

            {isSzco && linkedFo && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Osobne udaje prevzate z FO</p>
                  <p className="text-xs text-muted-foreground">{linkedFo.firstName} {linkedFo.lastName} ({linkedFo.uid})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Meno, priezvisko a rodne cislo su prevzate z prepojenej Fyzickej osoby a nie je mozne ich tu menit.</p>
                </div>
              </div>
            )}

            <Separator />

            <div style={{ display: !isPerson ? 'block' : 'none' }}>
              <Label className="text-xs">Nazov spolocnosti</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                className="mt-1"
                data-testid="input-edit-companyname"
              />
            </div>

            {typeFields && typeFields.length > 0 && (() => {
              const editFieldGroups: Record<string, { section: any; fields: StaticField[] }[]> = {
                povinne: [], doplnkove: [], volitelne: [],
              };
              const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              for (const section of sectionsSorted) {
                const category = (section as any).folderCategory || "volitelne";
                const sectionFields = typeFields
                  .filter(f => (f.sectionId || 0) === section.id)
                  .filter(f => isFieldVisible(f))
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                if (sectionFields.length > 0) {
                  if (!editFieldGroups[category]) editFieldGroups[category] = [];
                  editFieldGroups[category].push({ section, fields: sectionFields });
                }
              }
              const unsectioned = typeFields.filter(f => !f.sectionId || f.sectionId === 0).filter(f => isFieldVisible(f));
              if (unsectioned.length > 0) {
                editFieldGroups.volitelne.push({ section: { id: 0, name: "Ostatne" }, fields: unsectioned.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) });
              }

              const EDIT_ADDRESS_PANEL_FIELDS = {
                tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
                ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
                koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
              };
              const EDIT_ADDR_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];
              const editAllAddressKeys = new Set(
                Object.values(EDIT_ADDRESS_PANEL_FIELDS).flatMap(p => p.keys).concat(EDIT_ADDR_SWITCH_KEYS)
              );

              const EDIT_ADDR_FALLBACK_LABELS: Record<string, string> = {
                ulica: "Ulica", supisne: "Súpisné číslo", orientacne: "Orientačné číslo",
                psc: "PSČ", mesto: "Mesto", stat: "Štát",
              };

              const editKorRespondRovnaka = dynamicValues["korespond_rovnaka"] === "true";
              const editKontaktnaRovnaka = dynamicValues["kontaktna_rovnaka"] === "true";

              const allPovinneFields = (editFieldGroups.povinne || []).flatMap(g => g.fields);

              const isEditAddrFieldHidden = (_key: string) => false;

              const renderEditAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof EDIT_ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                const findField = (key: string) => allPovinneFields.find(f => f.fieldKey === key);
                const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: isEditAddrFieldHidden(k) }));
                const visibleFields = fields.filter(f => !f.hidden);
                const isReq = (key: string) => panelDef.requiredKeys.includes(key);

                if (visibleFields.length === 0) return null;

                const renderAddrField = (key: string, field: StaticField | undefined, suffix: string) => {
                  if (field) {
                    const augField = isReq(key) && !field.isRequired ? { ...field, isRequired: true } as StaticField : field;
                    return (
                      <div key={key} style={{ pointerEvents: disabled ? "none" : "auto" }}>
                        <DynamicFieldInput field={augField} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} />
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1" key={key}>
                      <Label className="text-xs text-muted-foreground">{EDIT_ADDR_FALLBACK_LABELS[suffix] || suffix}{isReq(key) ? " *" : ""}</Label>
                      <Input disabled={disabled} value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} data-testid={`input-edit-addr-${key}`} />
                    </div>
                  );
                };

                const row1 = visibleFields.filter(f => f.suffix === "ulica");
                const row2 = visibleFields.filter(f => f.suffix === "supisne" || f.suffix === "orientacne");
                const row3 = visibleFields.filter(f => f.suffix === "psc" || f.suffix === "mesto");
                const row4 = visibleFields.filter(f => f.suffix === "stat");

                return (
                  <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`edit-panel-address-${prefix}`}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                      {row1.length > 0 && <div className="grid grid-cols-1 gap-2">{row1.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row2.length > 0 && <div className={`grid grid-cols-1 ${row2.length > 1 ? "sm:grid-cols-2" : ""} gap-2`}>{row2.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row3.length > 0 && <div className={`grid grid-cols-1 ${row3.length > 1 ? "sm:grid-cols-2" : ""} gap-2`}>{row3.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row4.length > 0 && <div className="grid grid-cols-1 gap-2">{row4.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                    </CardContent>
                  </Card>
                );
              };

              return (
                <div className="space-y-2 pt-2">
                  <Separator />
                  <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
                    {FOLDER_CATEGORY_ORDER.map(category => {
                      const Icon = FOLDER_CATEGORY_ICONS[category];
                      const groups = editFieldGroups[category] || [];
                      const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                      const hasAddressPanels = isPerson && category === "povinne";
                      const visibleAddrFieldCount = hasAddressPanels
                        ? Object.values(EDIT_ADDRESS_PANEL_FIELDS).flatMap(p => p.keys).filter(k => !isEditAddrFieldHidden(k)).length
                        : 0;
                      if (totalFields === 0 && visibleAddrFieldCount === 0) return null;
                      return (
                        <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`edit-accordion-${category}`}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                              <Badge variant="secondary" className="text-[10px]">{totalFields + visibleAddrFieldCount}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              {groups.map(({ section, fields }) => {
                                const filteredFields = hasAddressPanels
                                  ? fields.filter(f => !editAllAddressKeys.has(f.fieldKey))
                                  : fields;
                                if (filteredFields.length === 0) return null;

                                const rows = new Map<number, StaticField[]>();
                                filteredFields.forEach((f: StaticField) => {
                                  const rn = (f as any).rowNumber ?? 0;
                                  if (!rows.has(rn)) rows.set(rn, []);
                                  rows.get(rn)!.push(f);
                                });
                                const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);

                                return (
                                  <div key={section.id} className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    <div className="space-y-3">
                                      {sortedRowKeys.map(rowNum => {
                                        const rowFields = rows.get(rowNum)!;
                                        const hasCustomWidths = rowFields.some(f => ((f as any).widthPercent ?? 100) !== 100);
                                        if (hasCustomWidths) {
                                          return (
                                            <div key={rowNum} className="flex gap-3 flex-wrap">
                                              {rowFields.map((field: StaticField) => (
                                                <div key={field.id} style={{ width: `calc(${(field as any).widthPercent ?? 50}% - 0.375rem)`, minWidth: '120px' }}>
                                                  <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} />
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        }
                                        return (
                                          <div key={rowNum} className="flex flex-wrap gap-3">
                                            {rowFields.map((field: StaticField) => (
                                              <div key={field.id} className="flex-1 min-w-[calc(50%-0.375rem)]">
                                                <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} />
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                if (!hasAddressPanels) return null;
                                const editShowKa = !editKorRespondRovnaka;
                                const editShowKoa = !editKontaktnaRovnaka;
                                const editPanelCount = 1 + (editShowKa ? 1 : 0) + (editShowKoa ? 1 : 0);
                                return (
                                  <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1" data-testid="edit-row-address-switches">
                                      <div className="flex items-center gap-2">
                                        <Switch checked={editKorRespondRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))} data-testid="edit-switch-korespond-rovnaka" />
                                        <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>Prechodná = Trvalá</Label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch checked={editKontaktnaRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))} data-testid="edit-switch-kontaktna-rovnaka" />
                                        <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>Kontaktná = Prechodná</Label>
                                      </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 items-start" data-testid="edit-row-address-panels">
                                      <div className="w-full" style={{ flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("tp", EDIT_ADDRESS_PANEL_FIELDS.tp, false)}
                                      </div>
                                      <div className="w-full" style={{ display: editShowKa ? undefined : "none", flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("ka", EDIT_ADDRESS_PANEL_FIELDS.ka, false)}
                                      </div>
                                      <div className="w-full" style={{ display: editShowKoa ? undefined : "none", flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("koa", EDIT_ADDRESS_PANEL_FIELDS.koa, false)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              );
            })()}

          </DialogScrollContent>
          <div className="flex justify-end gap-2 p-6 pt-3 border-t border-border">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit-subject">
              Zrusit
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={updateMutation.isPending}
              className="bg-amber-600 text-white border-amber-700"
              data-testid="button-save-edit-subject"
            >
              {updateMutation.isPending ? "Ukladam..." : "Ulozit zmeny"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj chcete prepisat udaje tohto subjektu?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmeny budu zaznamenane v historii subjektu. Povodne udaje budu archivovane pre spatne dohladanie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm-edit">Nie</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-amber-600 text-white border-amber-700"
              data-testid="button-confirm-edit"
            >
              Ano, prepisat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BulkAssignDialog({ selectedIds, onClose, groups }: { selectedIds: Set<number>; onClose: () => void; groups: any[] }) {
  const [selectedGroup, setSelectedGroup] = useState("");
  const { toast } = useToast();
  
  const assignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/client-groups/${selectedGroup}/bulk-assign`, {
        subjectIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      toast({ title: "Klienti priradeni do skupiny" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Chyba pri priradovani", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Priradit do skupiny</DialogTitle>
          <DialogDescription>
            Vyberte skupinu pre {selectedIds.size} vybranych klientov.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger data-testid="select-bulk-group">
              <SelectValue placeholder="Vyberte skupinu" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-bulk">Zrusit</Button>
            <Button 
              onClick={() => assignMutation.mutate()} 
              disabled={!selectedGroup || assignMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {assignMutation.isPending ? "Priradujem..." : "Priradit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FILTER_ORDER: SubjectStatusCategory[] = ["other_company", "deceased", "no_contract", "active", "inactive"];

const SUBJECTS_COLUMNS: ColumnDef[] = [
  { key: "uid", label: "UID" },
  { key: "status", label: "Status" },
  { key: "firstName", label: "Cele meno / Nazov" },
  { key: "type", label: "Typ subjektu" },
  { key: "managingCompany", label: "Spravujuca firma" },
];

const SUBJECTS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "uid", label: "UID", type: "text" },
  { key: "firstName", label: "Cele meno / Nazov", type: "text" },
  { key: "type", label: "Typ subjektu", type: "text" },
];

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [editData, setEditData] = useState<{ clientTypeCode: string; stateId: number; baseValue: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<Subject | null>(null);
  const [editTarget, setEditTarget] = useState<(Subject & { isOwner?: boolean }) | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<SubjectStatusCategory>>(new Set());
  const { data: appUser } = useAppUser();
  const activeCompanyId = appUser?.activeCompanyId ?? undefined;

  const { data: subjects, isLoading } = useSubjects({
    search: search || undefined,
    statusFilters: activeFilters.size > 0 ? Array.from(activeFilters) : undefined,
    activeCompanyId,
  });
  const tableFilter = useSmartFilter(subjects || [], SUBJECTS_FILTER_COLUMNS, "subjects");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: clientGroups } = useQuery<any[]>({ queryKey: ["/api/client-groups"] });
  const columnVisibility = useColumnVisibility("subjects", SUBJECTS_COLUMNS);

  function toggleFilter(category: SubjectStatusCategory) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  if (editData) {
    return (
      <FullPageEditor
        initialData={editData}
        onCancel={() => setEditData(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-bold" data-testid="text-subjects-title">Register subjektov</h2>
            <HelpIcon text="Zoznam vsetkych klientov a subjektov v systeme. Klientov mozete pridavat, upravovat a archivovat." side="right" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Sprava entit a integritnych zaznamov.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={() => setIsInitModalOpen(true)} data-testid="button-add-subject">
            <Plus className="w-4 h-4 mr-2" />
            Novy subjekt
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0" data-testid="panel-status-filters">
          {FILTER_ORDER.map(category => {
            const config = STATUS_CONFIG[category];
            const isActive = activeFilters.has(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleFilter(category)}
                aria-pressed={isActive}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-md border-2 text-xs font-medium transition-all duration-200 cursor-pointer select-none
                  ${isActive
                    ? `${config.borderColor} ${config.bgColor} ${config.shadowColor} shadow-md`
                    : "border-border/40 bg-muted/30 opacity-60 hover:opacity-80"
                  }
                `}
                data-testid={`button-filter-${category}`}
                data-active={isActive}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.color}`} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hladat podla mena alebo UID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-subjects"
          />
        </div>
      </div>

      <div style={{ display: selectedIds.size > 0 ? 'block' : 'none' }}>
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-md">
          <span className="text-sm font-medium">{selectedIds.size} vybranych</span>
          <Button size="sm" onClick={() => setBulkAssignOpen(true)} data-testid="button-bulk-assign">
            Priradit do skupiny
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
            Zrusit vyber
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <Table stickyHeader>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" 
                    checked={(subjects?.length ?? 0) > 0 && selectedIds.size === (subjects?.length ?? 0)}
                    onChange={(e) => {
                      if (e.target.checked && subjects) {
                        setSelectedIds(new Set(subjects.map(s => s.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    data-testid="checkbox-select-all"
                    className="accent-primary"
                  />
                </TableHead>
                {columnVisibility.isVisible("uid") && <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>}
                {columnVisibility.isVisible("status") && <TableHead style={{ maxWidth: '150px' }}>Status</TableHead>}
                {columnVisibility.isVisible("firstName") && <TableHead sortKey="firstName" sortDirection={sortKey === "firstName" ? sortDirection : null} onSort={requestSort}>Cele meno / Nazov</TableHead>}
                {columnVisibility.isVisible("type") && <TableHead sortKey="type" sortDirection={sortKey === "type" ? sortDirection : null} onSort={requestSort}>Typ subjektu</TableHead>}
                {columnVisibility.isVisible("managingCompany") && <TableHead>Spravujuca firma</TableHead>}
                <TableHead className="w-[100px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow style={{ display: isLoading ? 'table-row' : 'none' }}><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
              <TableRow style={{ display: !isLoading && (!subjects || subjects.length === 0) ? 'table-row' : 'none' }}><TableCell colSpan={7} className="text-center py-12 text-muted-foreground" data-testid="text-empty-subjects">Ziadne subjekty nenajdene</TableCell></TableRow>
              {sortedData.map((subject) => {
                const details = (subject.details || {}) as Record<string, any>;
                const titulPred = details.titul_pred || details.titleBefore || '';
                const titulZa = details.titul_za || details.titleAfter || '';
                const subjectTypeCode = (() => {
                  if (subject.type === 'person') return 'FO';
                  if (subject.type === 'szco') return 'SZCO';
                  if (subject.type === 'company') return 'PO';
                  return subject.type;
                })();
                const clientTypeMatch = clientTypes?.find(ct => ct.code === subjectTypeCode);
                const fullName = (() => {
                  if (subject.type === 'person') {
                    const parts = [titulPred, subject.firstName, subject.lastName, titulZa].filter(Boolean);
                    return parts.join(' ') || '-';
                  }
                  if (subject.type === 'szco') {
                    return subject.companyName || [titulPred, subject.firstName, subject.lastName, titulZa].filter(Boolean).join(' ') || '-';
                  }
                  return subject.companyName || '-';
                })();
                const managingCompanyName = (subject as any).companyName || companies?.find(c => c.id === subject.myCompanyId)?.name || '-';

                return (
                  <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`} className="align-middle" onRowClick={() => setViewTarget(subject)}>
                    <TableCell className="align-middle">
                      <input type="checkbox" 
                        checked={selectedIds.has(subject.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(subject.id); else next.delete(subject.id);
                          setSelectedIds(next);
                        }}
                        data-testid={`checkbox-subject-${subject.id}`}
                        className="accent-primary"
                      />
                    </TableCell>
                    {columnVisibility.isVisible("uid") && <TableCell className="font-mono text-xs align-middle">{subject.uid}</TableCell>}
                    {columnVisibility.isVisible("status") && <TableCell className="align-middle !overflow-visible" style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word', textOverflow: 'clip' }}>
                      {(() => {
                        const status = getSubjectStatus(subject, activeCompanyId);
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-snug ${status.bgColor} ${status.borderColor} ${status.textColor}`}
                            style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                            data-testid={`status-subject-${subject.id}`}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </TableCell>}
                    {columnVisibility.isVisible("firstName") && <TableCell className="font-medium align-middle" data-testid={`text-fullname-${subject.id}`}>
                      {fullName}
                    </TableCell>}
                    {columnVisibility.isVisible("type") && <TableCell className="align-middle">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        {subject.type === 'person' ? <User className="w-3 h-3 flex-shrink-0" /> : <Building2 className="w-3 h-3 flex-shrink-0" />}
                        <span>{clientTypeMatch?.code || subjectTypeCode}</span>
                      </div>
                    </TableCell>}
                    {columnVisibility.isVisible("managingCompany") && <TableCell className="text-muted-foreground text-sm align-middle" data-testid={`text-company-${subject.id}`}>
                      {managingCompanyName}
                    </TableCell>}
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewTarget(subject)} data-testid={`button-view-subject-${subject.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <div style={{ visibility: ((subject as any).isOwner || appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident' || !!(appUser as any)?.permissionGroupId) ? 'visible' : 'hidden' }}>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditTarget(subject as any)}
                            data-testid={`button-edit-subject-${subject.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <InitialRegistrationModal
        open={isInitModalOpen}
        onOpenChange={setIsInitModalOpen}
        onProceed={(data) => {
          setIsInitModalOpen(false);
          setTimeout(() => setEditData(data), 150);
        }}
        onViewSubject={(id) => {
          const found = subjects?.find(s => s.id === id);
          if (found) setViewTarget(found);
        }}
      />
      {bulkAssignOpen && <BulkAssignDialog 
        selectedIds={selectedIds}
        onClose={() => { setBulkAssignOpen(false); setSelectedIds(new Set()); }}
        groups={clientGroups || []}
      />}
      {viewTarget && <SubjectDetailDialog subject={viewTarget} onClose={() => setViewTarget(null)} />}
      {editTarget && <SubjectEditModal subject={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
