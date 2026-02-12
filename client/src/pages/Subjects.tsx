import { useState, useRef } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useContinents, useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight, ArrowLeft, ExternalLink, History, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
              {log.ipAddress && <span className="font-mono">{log.ipAddress}</span>}
            </div>
          </div>
        </div>
      ))}
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
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col items-stretch justify-start">
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
                <Badge variant={subject.isActive ? "default" : "destructive"} className={subject.isActive ? "bg-emerald-600 text-white" : ""}>
                  {subject.isActive ? "Aktivny" : "Archivovany"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="detail" className="flex-1">
          <TabsList data-testid="tabs-subject-detail">
            <TabsTrigger value="detail" data-testid="tab-subject-info">
              <User className="w-3.5 h-3.5 mr-1" />
              Detail
            </TabsTrigger>
            <TabsTrigger value="historia" data-testid="tab-subject-historia">
              <History className="w-3.5 h-3.5 mr-1" />
              Historia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="mt-3">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Typ entity</span>
                  <p className="text-sm">{subject.type === 'person' ? 'Fyzicka osoba' : 'Pravnicka osoba'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Spravujuca firma</span>
                  <p className="text-sm">{managingCompany?.name || `Firma #${subject.myCompanyId}`}</p>
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
                              {entry.isActive && <Badge variant="secondary">Aktivny</Badge>}
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
  const { data: allStates } = useStates();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const [selectedType, setSelectedType] = useState("");
  const [selectedState, setSelectedState] = useState(appUser?.activeStateId?.toString() || "");
  const [baseValue, setBaseValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; uid: string; id: number } | null>(null);

  const selectedClientType = clientTypes?.find(ct => ct.code === selectedType);
  const baseParamLabel = selectedClientType?.baseParameter === "ico" ? "ICO" : "Rodne cislo (RC)";

  async function handleCheck() {
    if (!baseValue.trim()) return;
    setChecking(true);
    setDuplicateInfo(null);
    try {
      const body = selectedClientType?.baseParameter === "ico"
        ? { ico: baseValue.trim() }
        : { birthNumber: baseValue.trim() };
      const res = await apiRequest("POST", "/api/subjects/check-duplicate", body);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateInfo({ name: data.subject.name, uid: data.subject.uid, id: data.subject.id });
      } else {
        onProceed({
          clientTypeCode: selectedType,
          stateId: Number(selectedState),
          baseValue: baseValue.trim(),
        });
        setSelectedType("");
        setBaseValue("");
        setDuplicateInfo(null);
      }
    } catch {
      setDuplicateInfo(null);
    } finally {
      setChecking(false);
    }
  }

  const canProceed = selectedType && selectedState && baseValue.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) { setDuplicateInfo(null); setBaseValue(""); setSelectedType(""); }
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

          <div>
            <Label className="text-xs">Stat</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger data-testid="select-reg-state">
                <SelectValue placeholder="Vyberte stat" />
              </SelectTrigger>
              <SelectContent>
                {allStates?.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} (+{s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType && (
            <div>
              <Label className="text-xs">{baseParamLabel}</Label>
              <Input
                placeholder={selectedClientType?.baseParameter === "ico" ? "napr. 12345678" : "napr. 900101/1234"}
                value={baseValue}
                onChange={(e) => { setBaseValue(e.target.value); setDuplicateInfo(null); }}
                data-testid="input-base-parameter"
              />
            </div>
          )}

          {duplicateInfo && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-sm font-semibold text-destructive">Klient uz existuje</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {duplicateInfo.name} <span className="font-mono text-xs">[ {duplicateInfo.uid} ]</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onViewSubject(duplicateInfo.id);
                }}
                data-testid="button-go-to-client"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Prejst na kartu klienta
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-init-reg">
              Zrusit
            </Button>
            <Button
              onClick={handleCheck}
              disabled={!canProceed || checking || !!duplicateInfo}
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

function FullPageEditor({
  initialData,
  onCancel,
}: {
  initialData: { clientTypeCode: string; stateId: number; baseValue: string };
  onCancel: () => void;
}) {
  const { mutate, isPending } = useCreateSubject();
  const { data: allContinents } = useContinents();
  const { data: companies } = useMyCompanies();
  const { data: allStates, isLoading: statesLoading } = useStates();
  const { data: clientTypes, isLoading: typesLoading } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const timerRef = useRef<number>(performance.now());

  const clientType = clientTypes?.find(ct => ct.code === initialData.clientTypeCode);
  const isPerson = clientType?.baseParameter === "rc";
  const state = allStates?.find(s => s.id === initialData.stateId);

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
    },
  });

  const formResetDone = useRef(false);
  if (!formResetDone.current && clientType && state) {
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
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    mutate({ ...data, processingTimeSec }, {
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
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ entity</FormLabel>
                    <Input value={field.value === "person" ? "Fyzicka osoba" : "Pravnicka osoba"} disabled data-testid="input-subject-type-locked" />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="myCompanyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spravujuca firma</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl><SelectTrigger data-testid="select-managing-company"><SelectValue placeholder="Vyberte firmu" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {companies?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {isPerson ? (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meno</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-firstname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priezvisko</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-lastname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              ) : (
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazov spolocnosti</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-companyname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

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
                    <FormLabel>Telefon</FormLabel>
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
                    <FormLabel>Stat</FormLabel>
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

              {isPerson && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Rodne cislo</Label>
                    <Input value={initialData.baseValue} disabled className="mt-1" data-testid="input-birth-number-locked" />
                  </div>
                  <FormField control={form.control} name="idCardNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cislo OP</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-id-card" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {!isPerson && (
                <div>
                  <Label className="text-xs text-muted-foreground">ICO</Label>
                  <Input value={initialData.baseValue} disabled className="mt-1" data-testid="input-ico-locked" />
                </div>
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

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [editData, setEditData] = useState<{ clientTypeCode: string; stateId: number; baseValue: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<Subject | null>(null);
  const { data: subjects, isLoading } = useSubjects({ search: search || undefined });
  const { data: companies } = useMyCompanies();

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
          <h2 className="text-2xl font-bold" data-testid="text-subjects-title">Register subjektov</h2>
          <p className="text-sm text-muted-foreground mt-1">Sprava entit a integritnych zaznamov.</p>
        </div>
        <Button onClick={() => setIsInitModalOpen(true)} data-testid="button-add-subject">
          <Plus className="w-4 h-4 mr-2" />
          Novy subjekt
        </Button>
      </div>

      <div className="flex gap-4 items-center">
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UID</TableHead>
                <TableHead>Meno entity</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Spravujuca firma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
              )}
              {!isLoading && (!subjects || subjects.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground" data-testid="text-empty-subjects">Ziadne subjekty nenajdene</TableCell></TableRow>
              )}
              {subjects?.map((subject) => (
                <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`}>
                  <TableCell className="font-mono text-xs">{subject.uid}</TableCell>
                  <TableCell className="font-medium">
                    {subject.type === 'person'
                      ? `${subject.lastName}, ${subject.firstName}`
                      : subject.companyName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {subject.type === 'person' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      <span>{subject.type === 'person' ? 'Osoba' : 'Firma'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {companies?.find(c => c.id === subject.myCompanyId)?.name || `Firma #${subject.myCompanyId}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.isActive ? "default" : "destructive"} className={subject.isActive ? "bg-emerald-600 text-white" : ""}>
                      {subject.isActive ? 'Aktivny' : 'Archivovany'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setViewTarget(subject)} data-testid={`button-view-subject-${subject.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
      {viewTarget && <SubjectDetailDialog subject={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}
