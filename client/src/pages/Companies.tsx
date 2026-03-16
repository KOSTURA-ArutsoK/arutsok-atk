import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useMyCompanies, useCreateMyCompany, useUpdateMyCompany, useDeleteMyCompany } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useAppUser } from "@/hooks/use-app-user";
import { Plus, Building2, Pencil, Trash2, Eye, Upload, FileText, X, Download, Clock, MapPin, FileCheck, Image, Loader2, Search, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak } from "@/lib/utils";
import { useToast as useToastCompanyDiv } from "@/hooks/use-toast";
import type { CompanyLogoHistory, Division } from "@shared/schema";

import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMyCompanySchema } from "@shared/schema";
import type { MyCompany, InsertMyCompany } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";


const COMPANY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Názov" },
  { key: "ico", label: "IČO" },
  { key: "specialization", label: "Zameranie" },
  { key: "city", label: "Mesto" },
  { key: "state", label: "Stat" },
];

const COMPANY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Názov", type: "text" },
  { key: "ico", label: "IČO", type: "text" },
  { key: "specialization", label: "Zameranie", type: "text" },
  { key: "city", label: "Mesto", type: "text" },
];

const formSchema = insertMyCompanySchema.extend({
  name: z.string().min(1, "Názov je povinný"),
  ico: z.string().min(1, "IČO je povinné"),
  dic: z.string().min(1, "DIČ je povinné"),
  icDph: z.string().optional(),
  street: z.string().min(1, "Ulica je povinná"),
  streetNumber: z.string().min(1, "Popisné číslo je povinné"),
  orientNumber: z.string().min(1, "Orientačné číslo je povinné"),
  postalCode: z.string().min(1, "PSČ je povinné"),
  city: z.string().min(1, "Mesto je povinné"),
  stateId: z.number().optional(),
  description: z.string().min(1, "Charakteristika je povinná"),
  specialization: z.string().min(1, "Zameranie je povinné"),
  subjectType: z.string().optional(),
  code: z.string().min(1, "Kód je povinný").max(25, "Max 25 znakov"),
  foundedDate: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

type DocEntry = { name: string; url: string; uploadedAt: string };

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LogoUploadSection({ companyId, company }: { companyId: number | null; company: MyCompany | null }) {
  const [uploading, setUploading] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: history } = useQuery<CompanyLogoHistory[]>({
    queryKey: ["/api/my-companies", companyId, "logo-history"],
    queryFn: async () => {
      const res = await fetch(`/api/my-companies/${companyId}/logo-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const primaryLogo = (company?.logos as any[])?.find((l: any) => l.isPrimary) || null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/my-companies/${companyId}/files/logos`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      qc.invalidateQueries({ queryKey: ["/api/my-companies"] });
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId, "logo-history"] });
      toast({ title: "Logo nahrané", description: `${file.name} je teraz aktívne logo.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrať logo.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSetPrimary(logoUrl: string) {
    if (!companyId) return;
    setSettingPrimary(logoUrl);
    try {
      const res = await fetch(`/api/my-companies/${companyId}/logos/set-primary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["/api/my-companies"] });
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId, "logo-history"] });
      toast({ title: "Logo nastavené", description: "Vybrané logo je teraz primárne." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nastaviť logo.", variant: "destructive" });
    } finally {
      setSettingPrimary(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-medium">Logo spoločnosti</h4>
          <p className="text-xs text-muted-foreground">Každé nahrané logo sa uchová v histórii</p>
        </div>
        {companyId ? (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} data-testid="input-logo-upload" />
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="button-upload-logo">
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              Nahrať logo
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Najprv uložte spoločnosť</p>
        )}
      </div>

      {primaryLogo && (
        <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-primary/5">
          <div className="w-14 h-14 rounded-md border border-border overflow-hidden flex-shrink-0 bg-background flex items-center justify-center">
            <img src={primaryLogo.url} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{primaryLogo.name || "Aktívne logo"}</p>
            <p className="text-xs text-muted-foreground">Primárne logo</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={() => window.open(primaryLogo.url, "_blank")} data-testid="button-view-primary-logo">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )}

      {!primaryLogo && companyId && (
        <div className="p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground" data-testid="text-no-logo">
          Žiadne aktívne logo
        </div>
      )}

      {history && history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">História lôg</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-2.5 border border-border rounded-md" data-testid={`logo-history-row-${entry.id}`}>
                <div className="w-10 h-10 rounded-md border border-border overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {entry.logoUrl ? (
                    <img src={entry.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{entry.originalName || "Logo"}</p>
                  <p className="text-xs text-muted-foreground">Nahradené: {formatDateTimeSlovak(entry.replacedAt)}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(entry.logoUrl, "_blank")} data-testid={`button-view-old-logo-${entry.id}`}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleSetPrimary(entry.logoUrl)} disabled={!!settingPrimary} data-testid={`button-restore-logo-${entry.id}`}>
                  {settingPrimary === entry.logoUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : "Obnoviť"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileUploadSection({
  companyId,
  section,
  docs,
  label,
  sublabel,
  readOnly,
}: {
  companyId: number | null;
  section: "official" | "work";
  docs: DocEntry[];
  label: string;
  sublabel: string;
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/my-companies/${companyId}/files/${section}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Subor nahrany", description: `${file.name} bol uspesne nahrany.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrat subor.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileUrl: string, fileName: string) {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/my-companies/${companyId}/files/${section}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Subor vymazany", description: `${fileName} bol odstraneny.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa vymazat subor.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-medium">{label}</h4>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        {!readOnly && companyId && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              data-testid={`input-file-${section}`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              data-testid={`button-upload-${section}`}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahravam..." : "Nahrat subor"}
            </Button>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground" data-testid={`text-no-files-${section}`}>
          {companyId
            ? "Ziadne subory. Kliknite na 'Nahrat subor'."
            : "Najprv ulozte firmu, potom mozete nahravat subory."}
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border"
              data-testid={`file-entry-${section}-${idx}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{doc.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDateSlovak(doc.uploadedAt)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(doc.url, "_blank")}
                  data-testid={`button-download-${section}-${idx}`}
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(doc.url, doc.name)}
                    data-testid={`button-delete-file-${section}-${idx}`}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyFormDialog({
  open,
  onOpenChange,
  editingCompanyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompanyId: number | null;
}) {
  const createMutation = useCreateMyCompany();
  const updateMutation = useUpdateMyCompany();
  const { data: allStates } = useStates();
  const { data: allCompanies } = useMyCompanies();
  const { data: appUser } = useAppUser();
  const timerRef = useRef<number>(0);
  const [notesHtml, setNotesHtml] = useState("");
  const [platcaDph, setPlatcaDph] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryResult, setRegistryResult] = useState<any>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [showActivities, setShowActivities] = useState(true);

  const editingCompany = editingCompanyId
    ? allCompanies?.find(c => c.id === editingCompanyId) || null
    : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      specialization: "SFA",
      subjectType: "",
      code: "",
      ico: "",
      dic: "",
      icDph: "",
      street: "",
      streetNumber: "",
      orientNumber: "",
      postalCode: "",
      city: "",
      stateId: undefined,
      description: "",
      notes: "",
      foundedDate: null,
    },
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      setRegistryResult(null);
      setRegistryError(null);
      if (editingCompany) {
        const hasIcDph = !!(editingCompany.icDph && editingCompany.icDph.trim());
        setPlatcaDph(hasIcDph);
        form.reset({
          name: editingCompany.name,
          specialization: editingCompany.specialization,
          subjectType: (editingCompany as any).subjectType || "",
          code: editingCompany.code,
          ico: editingCompany.ico || "",
          dic: editingCompany.dic || "",
          icDph: editingCompany.icDph || "",
          street: editingCompany.street || "",
          streetNumber: editingCompany.streetNumber || "",
          orientNumber: editingCompany.orientNumber || "",
          postalCode: editingCompany.postalCode || "",
          city: editingCompany.city || "",
          stateId: editingCompany.stateId || appUser?.activeStateId || undefined,
          description: editingCompany.description || "",
          notes: editingCompany.notes || "",
          foundedDate: (editingCompany as any).foundedDate ? new Date((editingCompany as any).foundedDate).toISOString().split("T")[0] : null,
        });
        setNotesHtml(editingCompany.notes || "");
      } else {
        setPlatcaDph(false);
        form.reset({
          name: "",
          specialization: "SFA",
          code: "",
          ico: "",
          dic: "",
          icDph: "",
          street: "",
          streetNumber: "",
          orientNumber: "",
          postalCode: "",
          city: "",
          stateId: appUser?.activeStateId || undefined,
          description: "",
          notes: "",
          foundedDate: null,
        });
        setNotesHtml("");
      }
    }
  }, [open, editingCompany, form]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const watchedSubjectType = form.watch("subjectType");

  async function handleRegistryLookup() {
    const ico = form.getValues("ico");
    if (!ico || ico.trim().length < 6) {
      setRegistryError("Zadajte platné IČO (min. 6 znakov)");
      return;
    }
    setRegistryLoading(true);
    setRegistryResult(null);
    setRegistryError(null);
    try {
      const res = await fetch(`/api/lookup/ico/${encodeURIComponent(ico.trim())}?type=company`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.found) {
        setRegistryError(data.message || data.error || "Firma nenájdená v registri");
        return;
      }
      setRegistryResult(data);
      if (data.name) form.setValue("name", data.name);
      if (data.street) form.setValue("street", data.street);
      if (data.streetNumber) form.setValue("streetNumber", data.streetNumber);
      if (data.zip) form.setValue("postalCode", data.zip);
      if (data.city) form.setValue("city", data.city);
      if (data.dic) {
        form.setValue("dic", data.dic);
      }
      if (data.legalForm) form.setValue("description", data.legalForm);
    } catch {
      setRegistryError("Chyba pri komunikácii s registrom");
    } finally {
      setRegistryLoading(false);
    }
  }

  function onSubmit(data: FormData) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const biz = registryResult?.businessActivities || (editingCompany as any)?.businessActivities || [];
    const payload = { ...data, notes: notesHtml, processingTimeSec, businessActivities: biz, foundedDate: data.foundedDate ? new Date(data.foundedDate).toISOString() : null };

    if (editingCompany) {
      updateMutation.mutate(
        { id: editingCompany.id, data: { ...payload, changeReason: "User edit" } },
        { onSuccess: () => handleOpenChange(false) }
      );
    } else {
      createMutation.mutate(payload as InsertMyCompany, {
        onSuccess: () => handleOpenChange(false),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const officialDocs = (editingCompany?.officialDocs as DocEntry[]) || [];
  const workDocs = (editingCompany?.workDocs as DocEntry[]) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {editingCompany ? "Upraviť spoločnosť" : "Pridať novú spoločnosť"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
                <TabsTrigger value="basic" data-testid="tab-basic">Základné údaje</TabsTrigger>
                <TabsTrigger value="address" data-testid="tab-address">Adresa</TabsTrigger>
                <TabsTrigger value="divisions" data-testid="tab-divisions">Divízie</TabsTrigger>
                <TabsTrigger value="docs" data-testid="tab-docs">Dokumenty</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Poznámky</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Názov spoločnosti</FormLabel>
                    <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="specialization" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zameranie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-specialization">
                            <SelectValue placeholder="Vyberte zameranie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SFA">SFA (Finančné sprostredkovanie)</SelectItem>
                          <SelectItem value="Reality">Reality</SelectItem>
                          <SelectItem value="Prenajom">Prenájom</SelectItem>
                          <SelectItem value="Weapons">Predaj zbraní</SelectItem>
                          <SelectItem value="Obchod">Obchod</SelectItem>
                          <SelectItem value="Poistenie">Zdravotné poistenie</SelectItem>
                          <SelectItem value="Dochodok">Dôchodkové sporenie</SelectItem>
                          <SelectItem value="Ine">Iné</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kód firmy</FormLabel>
                      <FormControl><Input {...field} maxLength={25} className="font-mono uppercase" data-testid="input-company-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="subjectType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ subjektu</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-subject-type">
                          <SelectValue placeholder="Vyberte typ subjektu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fo">FO — Fyzická osoba</SelectItem>
                        <SelectItem value="szco">SZČO — Samostatne zárobkovo činná osoba</SelectItem>
                        <SelectItem value="po">PO — Súkromný sektor</SelectItem>
                        <SelectItem value="ns">NS — Tretí sektor (neziskovky)</SelectItem>
                        <SelectItem value="vs">VS — Verejný sektor (štát)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="ico" render={({ field }) => (
                    <FormItem>
                      <FormLabel>IČO *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-ico" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DIČ *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-dic" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="icDph" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Switch
                          checked={platcaDph}
                          onCheckedChange={(checked) => {
                            setPlatcaDph(checked);
                            if (!checked) form.setValue("icDph", "");
                          }}
                          data-testid="switch-platca-dph"
                        />
                        <span>{platcaDph ? "IČ DPH *" : "Platca DPH"}</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          disabled={!platcaDph}
                          className={!platcaDph ? "opacity-40" : ""}
                          data-testid="input-icdph"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {watchedSubjectType === "po" && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={registryLoading}
                      onClick={handleRegistryLookup}
                      data-testid="button-registry-lookup"
                    >
                      {registryLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      {registryLoading ? "Hľadám..." : "Hľadať v registri"}
                    </Button>
                    {registryResult?.source && (
                      <Badge variant="outline" className="text-xs" data-testid="badge-registry-source">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                        {registryResult.source}
                      </Badge>
                    )}
                  </div>
                )}

                {registryError && (
                  <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive" data-testid="text-registry-error">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {registryError}
                  </div>
                )}

                {(() => {
                  const activitiesSource: { text: string; since?: string }[] = registryResult?.businessActivities ?? (editingCompany as any)?.businessActivities ?? [];
                  return activitiesSource.length > 0 ? (
                    <div className="border border-border rounded-md" data-testid="section-business-activities">
                      <button
                        type="button"
                        className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                        onClick={() => setShowActivities(!showActivities)}
                        data-testid="button-toggle-activities"
                      >
                        <span>Predmety podnikania ({activitiesSource.length})</span>
                        {showActivities ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showActivities && (
                        <div className="border-t border-border p-3 space-y-1.5 max-h-48 overflow-y-auto">
                          {activitiesSource.map((act, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-2 text-sm" data-testid={`activity-row-${idx}`}>
                              <span className="text-muted-foreground flex-1">{act.text}</span>
                              {act.since && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">(od: {act.since})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {registryResult?.shareholders && registryResult.shareholders.length > 0 && (
                  <div className="border border-border rounded-md p-3 space-y-1.5" data-testid="section-shareholders">
                    <p className="text-sm font-medium">Spoločníci</p>
                    {registryResult.shareholders.map((sh: any, idx: number) => (
                      <div key={idx} className="text-sm text-muted-foreground" data-testid={`shareholder-row-${idx}`}>
                        <span className="font-medium text-foreground">{sh.name}</span>
                        {sh.contribution && <span className="ml-2">— {sh.contribution}</span>}
                        {sh.address && <span className="ml-2 text-xs">({sh.address})</span>}
                      </div>
                    ))}
                  </div>
                )}

                {registryResult?.shareCapital && (
                  <div className="flex items-center gap-2 p-3 rounded-md border border-border text-sm" data-testid="text-share-capital">
                    <span className="font-medium">Základné imanie:</span>
                    <span className="text-muted-foreground">{registryResult.shareCapital}</span>
                  </div>
                )}

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charakteristika (Čím sa firma zaoberá) *</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={4} data-testid="input-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="foundedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum založenia spoločnosti</FormLabel>
                    <FormControl><Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-founded-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="address" className="space-y-4 mt-4">
                <FormField control={form.control} name="street" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica *</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-street" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="streetNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popisné číslo *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-street-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="orientNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orientačné číslo *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-orient-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PSČ *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-postal-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mesto / Obec *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-city" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="divisions" className="mt-4">
                <CompanyDivisionsTab companyId={editingCompany?.id || null} />
              </TabsContent>

              <TabsContent value="docs" className="mt-4 space-y-6">
                <LogoUploadSection
                  companyId={editingCompany?.id || null}
                  company={editingCompany}
                />
                <Separator />
                <FileUploadSection
                  companyId={editingCompany?.id || null}
                  section="official"
                  docs={officialDocs}
                  label="Sekcia A: Oficiálne dokumenty"
                  sublabel="Zakladateľská listina, Výpis z OR, Živnostenský list"
                />
                <Separator />
                <FileUploadSection
                  companyId={editingCompany?.id || null}
                  section="work"
                  docs={workDocs}
                  label="Sekcia B: Pracovné dokumenty"
                  sublabel="Priebežná dokumentácia, prílohy k poznámkam"
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Poznámkový blok</label>
                  <RichTextEditor
                    content={notesHtml}
                    onChange={setNotesHtml}
                    placeholder="Zadajte poznámky k firme..."
                    data-testid="editor-notes"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
              {editingCompany && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Čas spracovania: {formatProcessingTime(editingCompany.processingTimeSec || 0)}</span>
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel">
                  Zrušiť
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-save">
                  {isPending ? "Ukladám..." : "Uložiť"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDetailDialog({
  company,
  onClose,
  getStateName,
}: {
  company: MyCompany;
  onClose: () => void;
  getStateName: (id: number | null) => string;
}) {
  const officialDocs = (company.officialDocs as DocEntry[]) || [];
  const workDocs = (company.workDocs as DocEntry[]) || [];

  const addressParts = [
    company.street,
    company.streetNumber ? `${company.streetNumber}` : null,
    company.orientNumber ? `/ ${company.orientNumber}` : null,
  ].filter(Boolean).join(" ");

  const cityLine = [
    company.postalCode,
    company.city,
  ].filter(Boolean).join(" ");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-detail-company-name">{company.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary">{company.specialization}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{company.code}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full mt-2">
          <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
            <TabsTrigger value="basic" data-testid="detail-tab-basic">Základné údaje</TabsTrigger>
            <TabsTrigger value="address" data-testid="detail-tab-address">Adresa</TabsTrigger>
            <TabsTrigger value="docs" data-testid="detail-tab-docs">Dokumenty</TabsTrigger>
            <TabsTrigger value="notes" data-testid="detail-tab-notes">Poznámky</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="IČO" value={company.ico} testId="text-detail-ico" />
              <InfoRow label="DIČ" value={company.dic} testId="text-detail-dic" />
              <InfoRow label="IČ DPH" value={company.icDph} testId="text-detail-icdph" />
              <InfoRow label="Zameranie" value={company.specialization} testId="text-detail-spec" />
              <InfoRow label="Kód firmy" value={company.code} mono testId="text-detail-code" />
              <InfoRow label="Typ subjektu" value={(company as any).subjectType ? (company as any).subjectType.toUpperCase() : "-"} testId="text-detail-subject-type" />
              <InfoRow label="Dátum založenia" value={(company as any).foundedDate ? formatDateSlovak((company as any).foundedDate) : "-"} testId="text-detail-founded-date" />
            </div>
            {company.description && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Čím sa firma zaoberá</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-detail-description">{company.description}</p>
                </div>
              </>
            )}
            {(company.businessActivities as any[])?.length > 0 && (
              <>
                <Separator />
                <div data-testid="detail-section-activities">
                  <span className="text-xs text-muted-foreground">Predmety podnikania</span>
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {(company.businessActivities as { text: string; since?: string }[]).map((act, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                        <span className="text-muted-foreground flex-1">{act.text}</span>
                        {act.since && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">(od: {act.since})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Clock className="w-3 h-3" />
              <span>Čas spracovania: {formatProcessingTime(company.processingTimeSec || 0)}</span>
              <span>|</span>
              <span>Vytvorene: {formatDateSlovak(company.createdAt)}</span>
              <span>|</span>
              <span>Aktualizovane: {formatDateSlovak(company.updatedAt)}</span>
            </div>
          </TabsContent>

          <TabsContent value="address" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-1">
                  <p data-testid="text-detail-address">{addressParts || "Nezadana adresa"}</p>
                  <p className="text-muted-foreground" data-testid="text-detail-city">{cityLine || "-"}</p>
                  <p data-testid="text-detail-state">{getStateName(company.stateId)}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia A: Oficialne dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{officialDocs.length}</Badge>
              </div>
              {officialDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Ziadne oficialne dokumenty</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {officialDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border" data-testid={`detail-file-official-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateSlovak(doc.uploadedAt)}</span>
                      <Button size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-detail-download-official-${idx}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia B: Pracovne dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{workDocs.length}</Badge>
              </div>
              {workDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Ziadne pracovne dokumenty</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {workDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border" data-testid={`detail-file-work-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateSlovak(doc.uploadedAt)}</span>
                      <Button size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-detail-download-work-${idx}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            {company.notes ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-md border border-border"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(company.notes) }}
                data-testid="text-detail-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-detail-notes">Ziadne poznamky</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LogoHistoryDialog({
  company,
  onClose,
}: {
  company: MyCompany | null;
  onClose: () => void;
}) {
  const { data: history } = useQuery<CompanyLogoHistory[]>({
    queryKey: ["/api/my-companies", company?.id, "logo-history"],
    queryFn: async () => {
      const res = await fetch(`/api/my-companies/${company!.id}/logo-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!company,
  });

  if (!company) return null;

  return (
    <Dialog open={!!company} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="text-logo-history-title">Historia log - {company.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-logo-history">Ziadna historia log</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 border border-border rounded-md" data-testid={`logo-history-entry-${entry.id}`}>
                <div className="w-12 h-12 rounded-md border border-border overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {entry.logoUrl ? (
                    <img src={entry.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.originalName || "Logo"}</p>
                  <p className="text-xs text-muted-foreground">
                    Nahradene: {formatDateTimeSlovak(entry.replacedAt)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(entry.logoUrl, "_blank")}
                  data-testid={`button-view-old-logo-${entry.id}`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, mono, testId }: { label: string; value: string | null | undefined; mono?: boolean; testId?: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm ${mono ? "font-mono" : ""}`} data-testid={testId}>{value || "-"}</p>
    </div>
  );
}

export default function Companies() {
  const { data: companies, isLoading } = useMyCompanies();
  const { data: allStates } = useStates();
  const deleteMutation = useDeleteMyCompany();
  const tableFilter = useSmartFilter(companies || [], COMPANY_FILTER_COLUMNS, "companies");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("companies", COMPANY_COLUMNS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyCompany | null>(null);
  const [viewTarget, setViewTarget] = useState<MyCompany | null>(null);
  const [logoHistoryTarget, setLogoHistoryTarget] = useState<MyCompany | null>(null);

  function openCreate() {
    setEditingCompanyId(null);
    setDialogOpen(true);
  }

  function openEdit(company: MyCompany) {
    setEditingCompanyId(company.id);
    setDialogOpen(true);
  }

  function getStateName(stateId: number | null) {
    if (!stateId || !allStates) return "-";
    return allStates.find(s => s.id === stateId)?.name || "-";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-companies-title">Zoznam spoločností</h2>
          <p className="text-sm text-muted-foreground mt-1">Správa vášho portfólia firiem.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={openCreate} data-testid="button-add-company">
            <Plus className="w-4 h-4 mr-2" />
            Pridať novú spoločnosť
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Názov</TableHead>}
                {columnVisibility.isVisible("ico") && <TableHead sortKey="ico" sortDirection={sortKey === "ico" ? sortDirection : null} onSort={requestSort}>IČO</TableHead>}
                {columnVisibility.isVisible("specialization") && <TableHead sortKey="specialization" sortDirection={sortKey === "specialization" ? sortDirection : null} onSort={requestSort}>Zameranie</TableHead>}
                {columnVisibility.isVisible("city") && <TableHead sortKey="city" sortDirection={sortKey === "city" ? sortDirection : null} onSort={requestSort}>Mesto</TableHead>}
                {columnVisibility.isVisible("state") && <TableHead>Stat</TableHead>}
                <TableHead className="w-[160px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!companies || companies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
                    Žiadne spoločnosti nenájdené. Kliknite na „Pridať novú spoločnosť".
                  </TableCell>
                </TableRow>
              )}
              {sortedData.map(company => (
                <TableRow key={company.id} data-testid={`row-company-${company.id}`} onRowClick={() => openEdit(company)}>
                  {columnVisibility.isVisible("name") && <TableCell className="font-medium">{company.name}</TableCell>}
                  {columnVisibility.isVisible("ico") && <TableCell className="font-mono text-xs">{company.ico || "-"}</TableCell>}
                  {columnVisibility.isVisible("specialization") && <TableCell>
                    <Badge variant="secondary">{company.specialization}</Badge>
                  </TableCell>}
                  {columnVisibility.isVisible("city") && <TableCell>{company.city || "-"}</TableCell>}
                  {columnVisibility.isVisible("state") && <TableCell>{getStateName(company.stateId)}</TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewTarget(company)} data-testid={`button-view-${company.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setLogoHistoryTarget(company)} data-testid={`button-logo-history-${company.id}`} title="Historia log">
                        <Image className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(company)} data-testid={`button-edit-${company.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(company)} data-testid={`button-delete-${company.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CompanyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingCompanyId={editingCompanyId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať spoločnosť?</AlertDialogTitle>
            <AlertDialogDescription>
              Spoločnosť „{deleteTarget?.name}" bude presunutá do archívu. Táto akcia je vratná cez administrátora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Vymazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewTarget && (
        <CompanyDetailDialog
          company={viewTarget}
          onClose={() => setViewTarget(null)}
          getStateName={getStateName}
        />
      )}

      <LogoHistoryDialog
        company={logoHistoryTarget}
        onClose={() => setLogoHistoryTarget(null)}
      />
    </div>
  );
}

function CompanyDivisionsTab({ companyId }: { companyId: number | null }) {
  const { toast } = useToastCompanyDiv();
  const [selectedDivisionId, setSelectedDivisionId] = useState("");

  const { data: companyDivisions, isLoading } = useQuery<any[]>({
    queryKey: [`/api/companies/${companyId}/divisions`],
    enabled: !!companyId,
  });

  const { data: allDivisions } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
    enabled: !!companyId,
  });

  const linkedDivisionIds = (companyDivisions || []).map((cd: any) => cd.division?.id || cd.divisionId);
  const availableDivisions = (allDivisions || []).filter(d => d.isActive && !linkedDivisionIds.includes(d.id));

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/companies/${companyId}/divisions`, { divisionId: parseInt(selectedDivisionId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/divisions`] });
      toast({ title: "Uspech", description: "Divizia priradena" });
      setSelectedDivisionId("");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa priradit diviziu", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (linkId: number) => apiRequest("DELETE", `/api/company-divisions/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/divisions`] });
      toast({ title: "Uspech", description: "Prepojenie odstranene" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa odstranit prepojenie", variant: "destructive" }),
  });

  if (!companyId) {
    return <div className="text-sm text-muted-foreground py-4">Najprv uložte spoločnosť, potom priraďte divízie.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
          <SelectTrigger className="flex-1" data-testid="select-company-division">
            <SelectValue placeholder="Vyberte diviziu na priradenie" />
          </SelectTrigger>
          <SelectContent>
            {availableDivisions.map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.name}{d.code ? ` (${d.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!selectedDivisionId || addMutation.isPending}
          size="sm"
          data-testid="button-add-division-to-company"
        >
          <Plus className="w-4 h-4 mr-1" /> Priradit
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-2">Nacitavam...</div>
      ) : !(companyDivisions || []).length ? (
        <div className="text-center text-muted-foreground py-2">Ziadne priradene divizie</div>
      ) : (
        <div className="space-y-2">
          {(companyDivisions || []).map((link: any) => (
            <div key={link.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <span className="font-medium" data-testid={`text-company-division-${link.id}`}>{link.division?.name || "-"}</span>
                {link.division?.code && <Badge variant="secondary" className="ml-2 font-mono">{link.division.code}</Badge>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(link.id)} data-testid={`button-remove-division-${link.id}`}>
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
