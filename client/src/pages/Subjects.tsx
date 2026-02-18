import { useState, useRef, useEffect, useCallback } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useContinents, useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight, ArrowLeft, ExternalLink, History, Clock, Wallet, Loader2, CheckCircle2, Pencil, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
import type { Subject, ClientType, ClientTypeField, ClientTypeSection, AuditLog } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTableSort } from "@/hooks/use-table-sort";
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
  continentId: z.coerce.number().min(1, "Povinne"),
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

  function formatDate(d: string | Date | null) {
    if (!d) return "-";
    return new Date(d).toLocaleString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }

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
  volitelne: FileQuestion,
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

  const { data: typeFields } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientType?.id, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/fields`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  const { data: typeSections } = useQuery<(ClientTypeSection & { folderCategory?: string })[]>({
    queryKey: ["/api/client-types", clientType?.id, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/sections`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  function getFieldValue(fieldKey: string): string {
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if ((details as any)[fieldKey] !== undefined) return String((details as any)[fieldKey] || "");
    return "";
  }

  function groupFieldsByCategory() {
    const groups: Record<string, { section: any; fields: ClientTypeField[] }[]> = {
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

    const unsectionedFields = typeFields.filter(f => !f.sectionId || f.sectionId === 0);
    if (unsectionedFields.length > 0) {
      groups.volitelne.push({ section: { id: 0, name: "Ostatne" }, fields: unsectionedFields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) });
    }

    return groups;
  }

  const fieldGroups = groupFieldsByCategory();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/30 border border-border">
        <div>
          <span className="text-xs text-muted-foreground">Typ</span>
          <p className="text-sm font-medium">{isPerson ? 'FO' : isSzco ? 'SZCO' : 'PO'} - {clientType?.name || subject.type}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Spravujuca firma</span>
          <p className="text-sm font-medium">{managingCompany?.name || '-'}</p>
        </div>
        {isPerson || isSzco ? (
          <>
            <div>
              <span className="text-xs text-muted-foreground">Meno</span>
              <p className="text-sm">{subject.firstName || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Priezvisko</span>
              <p className="text-sm">{subject.lastName || '-'}</p>
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <span className="text-xs text-muted-foreground">Nazov spolocnosti</span>
            <p className="text-sm">{subject.companyName || '-'}</p>
          </div>
        )}
        <div>
          <span className="text-xs text-muted-foreground">Email</span>
          <p className="text-sm">{subject.email || '-'}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Telefon</span>
          <p className="text-sm">{subject.phone || '-'}</p>
        </div>
      </div>

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
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          {fields.map(field => {
                            const value = getFieldValue(field.fieldKey);
                            return (
                              <div key={field.id} className="space-y-0.5" data-testid={`field-display-${field.fieldKey}`}>
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
    </div>
  );
}

function SubjectDetailDialog({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { data: careerHistory, isLoading } = useSubjectCareerHistory(subject.id);
  const { data: companies } = useMyCompanies();
  const managingCompany = companies?.find(c => c.id === subject.myCompanyId);

  function formatDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("sk-SK");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] h-[85vh] overflow-y-auto flex flex-col items-stretch justify-start">
        <DialogHeader>
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
        </Tabs>
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
      <DialogContent className="sm:max-w-[500px] flex flex-col items-stretch justify-start">
        <DialogHeader>
          <DialogTitle>Registracia noveho klienta</DialogTitle>
          <DialogDescription>
            Vyberte typ klienta, stat a zadajte zakladny identifikator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Typ klienta</Label>
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setDuplicateInfo(null); }}>
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
                placeholder={selectedClientType?.baseParameter === "ico" ? "napr. 12345678" : "napr. 900101/1234"}
                value={baseValue}
                onChange={(e) => { setBaseValue(e.target.value); }}
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
  field: ClientTypeField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const errorBorder = hasError ? "border-red-500 ring-1 ring-red-500" : "";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className={`text-xs ${hasError ? "text-red-500" : ""}`}>{field.label || field.fieldKey}{field.isRequired ? " *" : ""}</Label>
      </div>
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
          <SelectTrigger className={cn(errorBorder, disabled && "opacity-70")} data-testid={`select-dynamic-${field.fieldKey}`}>
            <SelectValue placeholder="Vyberte..." />
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
        <Input
          type="date"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={cn(errorBorder, disabled && "opacity-70")}
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
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
  const { data: allContinents } = useContinents();
  const { data: companies } = useMyCompanies();
  const { data: allStates, isLoading: statesLoading } = useStates();
  const { data: clientTypes, isLoading: typesLoading } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: appUser } = useAppUser();
  const timerRef = useRef<number>(performance.now());

  const clientType = clientTypes?.find(ct => ct.code === initialData.clientTypeCode);
  const isPerson = clientType?.baseParameter === "rc";
  const state = allStates?.find(s => s.id === initialData.stateId);

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
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [isPerson, dynamicValues["rodne_cislo"], initialData.baseValue]);

  const { data: typeFields } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientType?.id, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/fields`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  const { data: typeSections } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientType?.id, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/sections`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  function isFieldVisible(field: ClientTypeField): boolean {
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
      type: isPerson ? "person" : "company",
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      continentId: state?.continentId || 0,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser?.activeCompanyId || 0,
    },
  });

  const formResetDone = useRef(false);
  if (!formResetDone.current && clientType && state && appUser?.activeCompanyId) {
    formResetDone.current = true;
    form.reset({
      type: isPerson ? "person" : "company",
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      continentId: state.continentId,
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

  const watchContinent = form.watch("continentId");
  const { data: filteredStates } = useStates(watchContinent);

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

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {isPerson ? (() => {
                const FO_POVINNE_ROWS: { keys: string[]; cols: string; customCols?: string }[] = [
                  { keys: ["titul_pred", "meno", "druhe_meno", "priezvisko", "titul_za"], cols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-[1fr_2fr_2fr_2fr_1fr]" },
                  { keys: ["rodne_priezvisko", "pohlavie", "datum_narodenia"], cols: "grid-cols-1 sm:grid-cols-3" },
                  { keys: ["miesto_narodenia", "vek"], cols: "grid-cols-1 sm:grid-cols-[2fr_1fr]" },
                  { keys: ["statna_prislusnost"], cols: "grid-cols-1 sm:grid-cols-2" },
                  { keys: ["typ_dokladu", "cislo_dokladu", "platnost_dokladu"], cols: "grid-cols-1 sm:grid-cols-3" },
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

                const nonPovinneGroups: { section: any; fields: ClientTypeField[] }[] = [];
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
                              {FO_POVINNE_ROWS.map((row, rowIdx) => {
                                const rowEntries = row.keys.map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
                                const hasAny = rowEntries.some(e => e.field) || row.keys.includes("statna_prislusnost");
                                if (!hasAny) return null;
                                const gridClass = row.cols;
                                return (
                                  <div key={rowIdx} className={`grid ${gridClass} gap-3`} data-testid={`row-povinne-${rowIdx + 3}`}>
                                    {rowEntries.map(({ key, field }) => {
                                      if (key === "statna_prislusnost") {
                                        const label = field?.label || "Štátna príslušnosť";
                                        const isReq = field?.isRequired;
                                        const hasErr = validationErrors.has(key);
                                        const prioritySet = new Set(PRIORITY_COUNTRIES);
                                        const restCountries = ALL_COUNTRIES.filter(c => !prioritySet.has(c));
                                        return (
                                          <div key={key} className="min-w-0">
                                            <div className="space-y-1">
                                              <Label className={`text-xs text-muted-foreground ${hasErr ? "text-red-500" : ""}`}>{label}{isReq ? " *" : ""}</Label>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", hasErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[key] && "text-muted-foreground")} data-testid="select-statna-prislusnost">
                                                    {dynamicValues[key] || "Vyberte krajinu..."}
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
                                      const rcParsedResult = initialData.baseValue?.trim() ? parseRodneCislo(initialData.baseValue.trim()) : {};
                                      const isRcAuto = (key === "pohlavie" && !!rcParsedResult.pohlavie) || (key === "datum_narodenia" && !!rcParsedResult.datumNarodenia);
                                      return field ? (
                                      <div key={key} className="min-w-0">
                                        <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} disabled={isRcAuto} />
                                      </div>
                                    ) : (
                                      <div key={key} className="min-w-0">
                                        <div className="space-y-1">
                                          <Label className={`text-xs text-muted-foreground ${validationErrors.has(key) ? "text-red-500" : ""}`}>{key === "druhe_meno" ? "Druhé meno/priezvisko" : key}</Label>
                                          <Input value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`input-${key}`} />
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

                            const renderAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                              const findField = (key: string) => povinneFields.find(f => f.fieldKey === key);
                              const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                              const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_") }));
                              const isRequired = (key: string) => panelDef.requiredKeys.includes(key);

                              const renderAddrField = (key: string, field: ClientTypeField | undefined, suffix: string) => {
                                if (field) {
                                  const augmentedField = isRequired(key) && !field.isRequired
                                    ? { ...field, isRequired: true } as ClientTypeField
                                    : field;
                                  return (
                                    <div key={key} style={{ pointerEvents: disabled ? "none" : "auto" }}>
                                      <DynamicFieldInput field={augmentedField} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(key)} />
                                    </div>
                                  );
                                }
                                return (
                                  <div className="space-y-1" key={key}>
                                    <Label className={`text-xs text-muted-foreground ${validationErrors.has(key) ? "text-red-500" : ""}`}>{ADDR_FALLBACK_LABELS[suffix] || suffix}{isRequired(key) ? " *" : ""}</Label>
                                    <Input disabled={disabled} value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`input-addr-${key}`} />
                                  </div>
                                );
                              };

                              return (
                                <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`panel-address-${prefix}`}>
                                  <CardContent className="p-4 space-y-3">
                                    <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {renderAddrField(fields[0].key, fields[0].field, fields[0].suffix)}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {renderAddrField(fields[1].key, fields[1].field, fields[1].suffix)}
                                      {renderAddrField(fields[2].key, fields[2].field, fields[2].suffix)}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {renderAddrField(fields[3].key, fields[3].field, fields[3].suffix)}
                                      {renderAddrField(fields[4].key, fields[4].field, fields[4].suffix)}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                      {renderAddrField(fields[5].key, fields[5].field, fields[5].suffix)}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            };

                            return (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start" data-testid="row-address-panels">
                                <div className="flex flex-col">
                                  {renderAddressPanel("tp", ADDRESS_PANEL_FIELDS.tp, false)}
                                  <div className="flex items-center gap-2 mt-2 px-1">
                                    <Switch
                                      checked={korRespondRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))}
                                      data-testid="switch-korespond-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>
                                      Adresa prechodného pobytu je totožná s adresou trvalého pobytu
                                    </Label>
                                  </div>
                                </div>

                                <div className="flex flex-col">
                                  {renderAddressPanel("ka", ADDRESS_PANEL_FIELDS.ka, korRespondRovnaka)}
                                  <div className="flex items-center gap-2 mt-2 px-1">
                                    <Switch
                                      checked={kontaktnaRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))}
                                      data-testid="switch-kontaktna-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>
                                      Kontaktná adresa je totožná s adresou prechodného pobytu
                                    </Label>
                                  </div>
                                </div>

                                <div className="flex flex-col">
                                  {renderAddressPanel("koa", ADDRESS_PANEL_FIELDS.koa, kontaktnaRovnaka || korRespondRovnaka)}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="row-telefon">
                            <div className="space-y-1">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="row-povinne-remainder">
                              {povinneRemainder.map(field => (
                                <DynamicFieldInput key={field.id} field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {fields.map((field: ClientTypeField) => (
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="continentId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kontinent</FormLabel>
                          <Select onValueChange={(val) => { field.onChange(val); form.setValue("stateId", 0); }} value={field.value?.toString()}>
                            <FormControl><SelectTrigger data-testid="select-continent"><SelectValue placeholder="Vyberte kontinent" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {allContinents?.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="stateId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Štát</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={!watchContinent}>
                            <FormControl><SelectTrigger data-testid="select-state"><SelectValue placeholder="Vyberte stat" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {filteredStates?.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="continentId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kontinent</FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); form.setValue("stateId", 0); }} value={field.value?.toString()}>
                          <FormControl><SelectTrigger data-testid="select-continent"><SelectValue placeholder="Vyberte kontinent" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {allContinents?.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="stateId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Štát</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={!watchContinent}>
                          <FormControl><SelectTrigger data-testid="select-state"><SelectValue placeholder="Vyberte stat" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {filteredStates?.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {typeFields && typeFields.length > 0 && (() => {
                    const editorFieldGroups: Record<string, { section: any; fields: ClientTypeField[] }[]> = {
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
                                          {fields.map((field: ClientTypeField) => (
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
  const { data: allContinents } = useContinents();
  const { data: allStates } = useStates();
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef<number>(performance.now());

  const isPerson = subject.type === 'person';
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || {};

  const clientType = clientTypes?.find(ct => {
    if (isPerson && ct.baseParameter === 'rc') return true;
    if (!isPerson && ct.baseParameter === 'ico') return true;
    return false;
  });

  const { data: typeFields } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientType?.id, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/fields`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  const { data: typeSections } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientType?.id, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType!.id}/sections`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientType?.id,
  });

  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (dynamicFields && typeof dynamicFields === 'object') {
      Object.entries(dynamicFields).forEach(([key, val]) => {
        initial[key] = String(val || "");
      });
    }
    return initial;
  });

  function isFieldVisible(field: ClientTypeField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const watchContinent = useState(subject.continentId || 0);
  const [selectedContinent, setSelectedContinent] = watchContinent;
  const { data: filteredStates } = useStates(selectedContinent || undefined);

  const [formData, setFormData] = useState({
    firstName: subject.firstName || "",
    lastName: subject.lastName || "",
    companyName: subject.companyName || "",
    email: subject.email || "",
    phone: subject.phone || "",
    idCardNumber: subject.idCardNumber || "",
    continentId: subject.continentId || 0,
    stateId: subject.stateId || 0,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
      const existingDetails = { ...(subject.details as any || {}) };
      if (Object.keys(dynamicValues).length > 0) {
        existingDetails.dynamicFields = dynamicValues;
      }
      const payload: any = {
        firstName: formData.firstName || null,
        lastName: formData.lastName || null,
        companyName: formData.companyName || null,
        email: formData.email || null,
        phone: formData.phone || null,
        idCardNumber: formData.idCardNumber || null,
        continentId: Number(formData.continentId),
        stateId: Number(formData.stateId),
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
        <DialogContent className="max-w-5xl w-[85vw] max-h-[85vh] overflow-y-auto flex flex-col items-stretch justify-start">
          <DialogHeader>
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

          <div className="space-y-4 mt-2">
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
                    <Input value={subject.birthNumber || "***"} disabled className="mt-1" data-testid="input-edit-rc-locked" />
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

            <Separator />

            {isPerson ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Meno</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="mt-1"
                    data-testid="input-edit-firstname"
                  />
                </div>
                <div>
                  <Label className="text-xs">Priezvisko</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="mt-1"
                    data-testid="input-edit-lastname"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Nazov spolocnosti</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  className="mt-1"
                  data-testid="input-edit-companyname"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                  data-testid="input-edit-email"
                />
              </div>
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                  data-testid="input-edit-phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Kontinent</Label>
                <Select
                  value={formData.continentId?.toString()}
                  onValueChange={(val) => {
                    setFormData(prev => ({ ...prev, continentId: Number(val), stateId: 0 }));
                    setSelectedContinent(Number(val));
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-edit-continent">
                    <SelectValue placeholder="Vyberte kontinent" />
                  </SelectTrigger>
                  <SelectContent>
                    {allContinents?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stat</Label>
                <Select
                  value={formData.stateId?.toString()}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, stateId: Number(val) }))}
                  disabled={!formData.continentId}
                >
                  <SelectTrigger className="mt-1" data-testid="select-edit-state">
                    <SelectValue placeholder="Vyberte stat" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStates?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div style={{ display: isPerson ? 'block' : 'none' }}>
              <Label className="text-xs">Cislo OP</Label>
              <Input
                value={formData.idCardNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, idCardNumber: e.target.value }))}
                className="mt-1"
                data-testid="input-edit-idcard"
              />
            </div>

            {typeFields && typeFields.length > 0 && (() => {
              const editFieldGroups: Record<string, { section: any; fields: ClientTypeField[] }[]> = {
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

              const renderEditAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof EDIT_ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                const findField = (key: string) => allPovinneFields.find(f => f.fieldKey === key);
                const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_") }));
                const isReq = (key: string) => panelDef.requiredKeys.includes(key);

                const renderAddrField = (key: string, field: ClientTypeField | undefined, suffix: string) => {
                  if (field) {
                    const augField = isReq(key) && !field.isRequired ? { ...field, isRequired: true } as ClientTypeField : field;
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

                return (
                  <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`edit-panel-address-${prefix}`}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                      <div className="grid grid-cols-1 gap-2">{renderAddrField(fields[0].key, fields[0].field, fields[0].suffix)}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{renderAddrField(fields[1].key, fields[1].field, fields[1].suffix)}{renderAddrField(fields[2].key, fields[2].field, fields[2].suffix)}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{renderAddrField(fields[3].key, fields[3].field, fields[3].suffix)}{renderAddrField(fields[4].key, fields[4].field, fields[4].suffix)}</div>
                      <div className="grid grid-cols-1 gap-2">{renderAddrField(fields[5].key, fields[5].field, fields[5].suffix)}</div>
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
                      if (totalFields === 0 && !hasAddressPanels) return null;
                      return (
                        <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`edit-accordion-${category}`}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                              <Badge variant="secondary" className="text-[10px]">{hasAddressPanels ? totalFields + 18 : totalFields}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              {groups.map(({ section, fields }) => {
                                const filteredFields = hasAddressPanels
                                  ? fields.filter(f => !editAllAddressKeys.has(f.fieldKey))
                                  : fields;
                                if (filteredFields.length === 0) return null;
                                return (
                                  <div key={section.id} className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {filteredFields.map((field: ClientTypeField) => (
                                        <DynamicFieldInput key={field.id} field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ display: hasAddressPanels ? 'block' : 'none' }}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start" data-testid="edit-row-address-panels">
                                  <div className="flex flex-col">
                                    {renderEditAddressPanel("tp", EDIT_ADDRESS_PANEL_FIELDS.tp, false)}
                                    <div className="flex items-center gap-2 mt-2 px-1">
                                      <Switch checked={editKorRespondRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))} data-testid="edit-switch-korespond-rovnaka" />
                                      <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>Adresa prechodného pobytu je totožná s adresou trvalého pobytu</Label>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    {renderEditAddressPanel("ka", EDIT_ADDRESS_PANEL_FIELDS.ka, editKorRespondRovnaka)}
                                    <div className="flex items-center gap-2 mt-2 px-1">
                                      <Switch checked={editKontaktnaRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))} data-testid="edit-switch-kontaktna-rovnaka" />
                                      <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>Kontaktná adresa je totožná s adresou prechodného pobytu</Label>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    {renderEditAddressPanel("koa", EDIT_ADDRESS_PANEL_FIELDS.koa, editKontaktnaRovnaka || editKorRespondRovnaka)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
      <DialogContent className="sm:max-w-[500px]">
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
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(subjects || []);
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: clientGroups } = useQuery<any[]>({ queryKey: ["/api/client-groups"] });

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
        <Button onClick={() => setIsInitModalOpen(true)} data-testid="button-add-subject">
          <Plus className="w-4 h-4 mr-2" />
          Novy subjekt
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap" data-testid="panel-status-filters">
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
        <div className="relative flex-1 max-w-md">
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
          <Table>
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
                <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>
                <TableHead style={{ maxWidth: '150px' }}>Status</TableHead>
                <TableHead sortKey="firstName" sortDirection={sortKey === "firstName" ? sortDirection : null} onSort={requestSort}>Cele meno / Nazov</TableHead>
                <TableHead sortKey="type" sortDirection={sortKey === "type" ? sortDirection : null} onSort={requestSort}>Typ subjektu</TableHead>
                <TableHead>Spravujuca firma</TableHead>
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
                  <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`} className="align-middle">
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
                    <TableCell className="font-mono text-xs align-middle">{subject.uid}</TableCell>
                    <TableCell className="align-middle !overflow-visible" style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word', textOverflow: 'clip' }}>
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
                    </TableCell>
                    <TableCell className="font-medium align-middle" data-testid={`text-fullname-${subject.id}`}>
                      {fullName}
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        {subject.type === 'person' ? <User className="w-3 h-3 flex-shrink-0" /> : <Building2 className="w-3 h-3 flex-shrink-0" />}
                        <span>{clientTypeMatch?.code || subjectTypeCode}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm align-middle" data-testid={`text-company-${subject.id}`}>
                      {managingCompanyName}
                    </TableCell>
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
        </CardContent>
      </Card>

      <InitialRegistrationModal
        open={isInitModalOpen}
        onOpenChange={setIsInitModalOpen}
        onProceed={(data) => {
          setIsInitModalOpen(false);
          setEditData(data);
        }}
        onViewSubject={(id) => {
          const found = subjects?.find(s => s.id === id);
          if (found) setViewTarget(found);
        }}
      />
      <div style={{ display: bulkAssignOpen ? 'contents' : 'none' }}>
        {bulkAssignOpen && <BulkAssignDialog 
          selectedIds={selectedIds}
          onClose={() => { setBulkAssignOpen(false); setSelectedIds(new Set()); }}
          groups={clientGroups || []}
        />}
      </div>
      <div style={{ display: viewTarget ? 'contents' : 'none' }}>
        {viewTarget && <SubjectDetailDialog subject={viewTarget} onClose={() => setViewTarget(null)} />}
      </div>
      <div style={{ display: editTarget ? 'contents' : 'none' }}>
        {editTarget && <SubjectEditModal subject={editTarget} onClose={() => setEditTarget(null)} />}
      </div>
    </div>
  );
}
