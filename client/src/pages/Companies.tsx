import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useMyCompanies, useCreateMyCompany, useUpdateMyCompany, useDeleteMyCompany } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useAppUser } from "@/hooks/use-app-user";
import { Plus, Building2, Pencil, Trash2, Eye, Upload, FileText, X, Download, Clock, MapPin, FileCheck, Image, Loader2, Search, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Phone, Mail, GitBranch, Info, UserCheck, UserPlus, Users, Camera, UserCog } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak, formatUid } from "@/lib/utils";
import { useToast as useToastCompanyDiv } from "@/hooks/use-toast";
import type { CompanyLogoHistory, Division } from "@shared/schema";

interface BusinessActivity {
  text: string;
  since?: string;
}

interface RegistryShareholder {
  name: string;
  contribution?: string;
  address?: string;
}

interface RegistryDirector {
  name: string;
  role: string;
  since?: string;
}

interface BranchEmployee {
  photo?: string;
  uid?: string;
  position?: string;
  titleBefore?: string;
  firstName?: string;
  lastName?: string;
  titleAfter?: string;
  phone?: string;
  email?: string;
  otherContact?: string;
  status?: "active" | "inactive" | "temporarily_inactive";
}

interface BranchEntry {
  name?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  phones?: string[];
  emails?: string[];
  isActive?: boolean;
  activeFrom?: string;
  cancelledAt?: string;
  employees?: BranchEmployee[];
}

interface RegistryLookupResponse {
  found: boolean;
  source?: string;
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  icDph?: string;
  vatParagraph?: string;
  vatRegisteredAt?: string;
  foundedDate?: string;
  normalized?: string;
  businessActivities?: BusinessActivity[];
  shareCapital?: string;
  shareholders?: RegistryShareholder[];
  directors?: RegistryDirector[];
  actingNote?: string;
  message?: string;
  error?: string;
}

import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  { key: "city", label: "Mesto" },
  { key: "state", label: "Štát" },
];

const COMPANY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Názov", type: "text" },
  { key: "ico", label: "IČO", type: "text" },
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
  corrStreet: z.string().optional().nullable(),
  corrStreetNumber: z.string().optional().nullable(),
  corrPostalCode: z.string().optional().nullable(),
  corrCity: z.string().optional().nullable(),
  stateId: z.number().optional(),
  description: z.string().min(1, "Charakteristika je povinná"),
  subjectType: z.string().optional(),
  code: z.string().min(1, "Kód je povinný").max(25, "Max 25 znakov"),
  foundedDate: z.string().nullable().optional(),
  vatParagraph: z.string().optional(),
  vatRegisteredAt: z.string().nullable().optional(),
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
  const registryLookupBtnRef = useRef<HTMLButtonElement>(null);
  const [notesHtml, setNotesHtml] = useState("");
  const [platcaDph, setPlatcaDph] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryResult, setRegistryResult] = useState<RegistryLookupResponse | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [showActivities, setShowActivities] = useState(true);
  const [selectedActivityIndices, setSelectedActivityIndices] = useState<Set<number>>(new Set());
  const [corrSameAsHQ, setCorrSameAsHQ] = useState(false);
  const [branches, setBranches] = useState<BranchEntry[]>([]);
  const [addingBranch, setAddingBranch] = useState(false);
  const [editingBranchIdx, setEditingBranchIdx] = useState<number | null>(null);
  const [newBranch, setNewBranch] = useState<BranchEntry>({});
  const [branchPhones, setBranchPhones] = useState<string[]>([]);
  const [branchEmails, setBranchEmails] = useState<string[]>([]);
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([]);
  const [addingBranchEmployee, setAddingBranchEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState<BranchEmployee>({ status: "active" });
  const employeePhotoRef = useRef<HTMLInputElement>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const editingCompany = editingCompanyId
    ? allCompanies?.find(c => c.id === editingCompanyId) || null
    : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
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
      corrStreet: "",
      corrStreetNumber: "",
      corrPostalCode: "",
      corrCity: "",
      stateId: undefined,
      description: "",
      notes: "",
      foundedDate: null,
      vatParagraph: "",
      vatRegisteredAt: null,
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
        const hasCorrAddr = !!(editingCompany.corrStreet || editingCompany.corrStreetNumber || editingCompany.corrPostalCode || editingCompany.corrCity);
        setCorrSameAsHQ(!hasCorrAddr);
        setBranches((editingCompany.branches as BranchEntry[]) || []);
        form.reset({
          name: editingCompany.name,
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
          corrStreet: editingCompany.corrStreet || "",
          corrStreetNumber: editingCompany.corrStreetNumber || "",
          corrPostalCode: editingCompany.corrPostalCode || "",
          corrCity: editingCompany.corrCity || "",
          stateId: editingCompany.stateId || appUser?.activeStateId || undefined,
          description: editingCompany.description || "",
          notes: editingCompany.notes || "",
          foundedDate: (editingCompany as any).foundedDate ? new Date((editingCompany as any).foundedDate).toISOString().split("T")[0] : null,
          vatParagraph: editingCompany.vatParagraph || "",
          vatRegisteredAt: editingCompany.vatRegisteredAt ? new Date(editingCompany.vatRegisteredAt).toISOString().split("T")[0] : null,
        });
        setNotesHtml(editingCompany.notes || "");
      } else {
        setPlatcaDph(false);
        setCorrSameAsHQ(true);
        setBranches([]);
        form.reset({
          name: "",
          code: "",
          ico: "",
          dic: "",
          icDph: "",
          street: "",
          streetNumber: "",
          orientNumber: "",
          postalCode: "",
          city: "",
          corrStreet: "",
          corrStreetNumber: "",
          corrPostalCode: "",
          corrCity: "",
          stateId: appUser?.activeStateId || undefined,
          description: "",
          notes: "",
          foundedDate: null,
          vatParagraph: "",
          vatRegisteredAt: null,
        });
        setNotesHtml("");
      }
    }
  }, [open, editingCompany, form]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setPendingLogo(null);
      setPendingLogoPreview(null);
    }
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
      if (data.businessActivities?.length) {
        setSelectedActivityIndices(new Set(data.businessActivities.map((_: BusinessActivity, i: number) => i)));
      }
      if (data.name) form.setValue("name", data.name);
      if (data.street) form.setValue("street", data.street);
      if (data.streetNumber) form.setValue("streetNumber", data.streetNumber);
      if (data.zip) form.setValue("postalCode", data.zip);
      if (data.city) form.setValue("city", data.city);
      if (data.legalForm) form.setValue("description", data.legalForm);
      const currentDic = form.getValues("dic");
      if (data.dic && (!currentDic || !currentDic.trim())) {
        form.setValue("dic", data.dic);
      }
      if (data.foundedDate) {
        form.setValue("foundedDate", data.foundedDate);
      }
      if (data.icDph) {
        form.setValue("icDph", data.icDph);
        setPlatcaDph(true);
      }
      if (data.vatParagraph) {
        form.setValue("vatParagraph", data.vatParagraph);
      }
      if (data.vatRegisteredAt) {
        form.setValue("vatRegisteredAt", data.vatRegisteredAt);
      }
    } catch {
      setRegistryError("Chyba pri komunikácii s registrom");
    } finally {
      setRegistryLoading(false);
    }
  }

  function openNewBranchForm() {
    setNewBranch({ isActive: true });
    setBranchPhones([]);
    setBranchEmails([]);
    setBranchEmployees([]);
    setAddingBranchEmployee(false);
    setNewEmployee({ status: "active" });
    setEditingBranchIdx(null);
    setAddingBranch(true);
  }

  function openEditBranchForm(idx: number) {
    const br = branches[idx];
    setNewBranch({ ...br });
    setBranchPhones(br.phones ?? (br.phone ? [br.phone] : []));
    setBranchEmails(br.emails ?? (br.email ? [br.email] : []));
    setBranchEmployees(br.employees ?? []);
    setAddingBranchEmployee(false);
    setNewEmployee({ status: "active" });
    setEditingBranchIdx(idx);
    setAddingBranch(true);
  }

  function saveBranchForm() {
    const branchData: BranchEntry = {
      ...newBranch,
      phones: branchPhones.filter(p => p.trim()),
      emails: branchEmails.filter(e => e.trim()),
      employees: branchEmployees,
      phone: undefined,
      email: undefined,
    };
    if (editingBranchIdx !== null) {
      setBranches(prev => prev.map((b, i) => i === editingBranchIdx ? branchData : b));
    } else {
      setBranches(prev => [...prev, branchData]);
    }
    setAddingBranch(false);
    setEditingBranchIdx(null);
    setNewBranch({});
    setBranchPhones([]);
    setBranchEmails([]);
    setBranchEmployees([]);
    setAddingBranchEmployee(false);
    setNewEmployee({ status: "active" });
  }

  function handleEmployeePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewEmployee(prev => ({ ...prev, photo: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function saveEmployee() {
    if (newEmployee.firstName || newEmployee.lastName || newEmployee.position || newEmployee.uid) {
      setBranchEmployees(prev => [...prev, { ...newEmployee }]);
      setNewEmployee({ status: "active" });
      setAddingBranchEmployee(false);
    }
  }

  function onSubmit(data: FormData) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const allActivities: BusinessActivity[] = registryResult?.businessActivities || (editingCompany?.businessActivities as BusinessActivity[]) || [];
    const biz: BusinessActivity[] = registryResult?.businessActivities
      ? allActivities.filter((_, i) => selectedActivityIndices.has(i))
      : allActivities;
    const payload = {
      ...data,
      notes: notesHtml,
      processingTimeSec,
      businessActivities: biz,
      foundedDate: data.foundedDate ? new Date(data.foundedDate).toISOString() : null,
      vatRegisteredAt: data.vatRegisteredAt ? new Date(data.vatRegisteredAt).toISOString() : null,
      corrStreet: corrSameAsHQ ? null : (data.corrStreet || null),
      corrStreetNumber: corrSameAsHQ ? null : (data.corrStreetNumber || null),
      corrPostalCode: corrSameAsHQ ? null : (data.corrPostalCode || null),
      corrCity: corrSameAsHQ ? null : (data.corrCity || null),
      branches,
    };

    if (editingCompany) {
      updateMutation.mutate(
        { id: editingCompany.id, data: { ...payload, changeReason: "User edit" } },
        { onSuccess: () => handleOpenChange(false) }
      );
    } else {
      createMutation.mutate(payload as InsertMyCompany, {
        onSuccess: async (newCompany) => {
          if (pendingLogo && newCompany?.id) {
            try {
              const fd = new FormData();
              fd.append("file", pendingLogo);
              await fetch(`/api/my-companies/${newCompany.id}/files/logos`, {
                method: "POST",
                body: fd,
                credentials: "include",
              });
            } catch {
            }
          }
          handleOpenChange(false);
        },
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const officialDocs = (editingCompany?.officialDocs as DocEntry[]) || [];
  const workDocs = (editingCompany?.workDocs as DocEntry[]) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
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
                <TabsTrigger value="officers" data-testid="tab-officers">Štatutári</TabsTrigger>
                <TabsTrigger value="address" data-testid="tab-address">Adresa</TabsTrigger>
                <TabsTrigger value="branches" data-testid="tab-branches">Pobočky</TabsTrigger>
                <TabsTrigger value="divisions" data-testid="tab-divisions">Divízie</TabsTrigger>
                <TabsTrigger value="docs" data-testid="tab-docs">Dokumenty</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Poznámky</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="flex gap-3">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="flex-[7]">
                      <FormLabel>Názov spoločnosti</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem className="flex-[3]">
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
                <div className="flex items-start gap-3">
                  <div className="w-[60%] space-y-2">
                    <FormField control={form.control} name="ico" render={({ field }) => (
                      <FormItem>
                        <FormLabel>IČO *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-ico" onKeyDown={(e) => { if (e.key === "Enter" && watchedSubjectType === "po") { e.preventDefault(); registryLookupBtnRef.current?.focus(); } }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {watchedSubjectType === "po" && (
                      <>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Button ref={registryLookupBtnRef} type="button" variant="outline" size="sm" disabled={registryLoading} onClick={handleRegistryLookup} className="shrink-0" data-testid="button-registry-lookup">
                            {registryLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                            {registryLoading ? "Hľadám..." : "Hľadať v registri"}
                          </Button>
                          {registryResult?.source && (
                            <Badge variant="outline" className="text-xs shrink-0" data-testid="badge-registry-source">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                              {registryResult.source}
                            </Badge>
                          )}
                          {registryError && (
                            <span className="text-xs text-destructive flex items-center gap-1 truncate" data-testid="text-registry-error">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{registryError}</span>
                            </span>
                          )}
                          {registryResult && !registryError && (
                            <span className="text-xs text-muted-foreground truncate" data-testid="text-registry-inline-summary">
                              {registryResult.name && <span className="font-medium text-foreground mr-1">{registryResult.name}</span>}
                              {registryResult.normalized && <span className="mr-1">IČO: {registryResult.normalized}</span>}
                              {registryResult.dic && <span className="mr-1">DIČ: {registryResult.dic}</span>}
                              {(registryResult.city) && <span>— {[registryResult.street, registryResult.streetNumber, registryResult.zip, registryResult.city].filter(Boolean).join(", ")}</span>}
                            </span>
                          )}
                        </div>
                        {(registryResult || registryError) && (
                          <div className="space-y-1.5">
                            {registryResult?.shareholders && registryResult.shareholders.length > 0 && (
                              <div className="border border-border rounded-md p-2.5 space-y-1" data-testid="section-shareholders">
                                <p className="text-xs font-medium">Spoločníci</p>
                                {registryResult.shareholders.map((sh, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground" data-testid={`shareholder-row-${idx}`}>
                                    <span className="font-medium text-foreground">{sh.name}</span>
                                    {sh.contribution && <span className="ml-1">— {sh.contribution}</span>}
                                    {sh.address && <span className="ml-1 text-[10px]">({sh.address})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {registryResult?.shareCapital && (
                              <div className="flex items-center gap-2 p-2.5 rounded-md border border-border text-xs" data-testid="text-share-capital">
                                <span className="font-medium">Základné imanie:</span>
                                <span className="text-muted-foreground">{registryResult.shareCapital}</span>
                              </div>
                            )}
                            {registryResult?.directors && registryResult.directors.length > 0 && (
                              <div className="border border-border rounded-md p-2.5 space-y-1" data-testid="section-directors">
                                <p className="text-xs font-medium">Štatutári</p>
                                {registryResult.directors.map((dir, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground" data-testid={`director-row-${idx}`}>
                                    <span className="font-medium text-foreground">{dir.name}</span>
                                    {dir.since && <span className="ml-1 text-[10px] font-mono">(od: {dir.since})</span>}
                                  </div>
                                ))}
                                {registryResult.actingNote && (
                                  <p className="text-[10px] text-muted-foreground mt-1 italic" data-testid="text-acting-note">{registryResult.actingNote}</p>
                                )}
                              </div>
                            )}
                            {registryResult && !registryError && (
                              <div className="border border-border rounded-md p-2.5 space-y-1" data-testid="section-registry-summary">
                                <p className="text-xs font-medium">Údaje z registra</p>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                                  {registryResult.name && (<><span className="text-muted-foreground">Názov:</span><span className="font-medium">{registryResult.name}</span></>)}
                                  {registryResult.normalized && (<><span className="text-muted-foreground">IČO:</span><span className="font-mono">{registryResult.normalized}</span></>)}
                                  {registryResult.dic && (<><span className="text-muted-foreground">DIČ:</span><span className="font-mono">{registryResult.dic}</span></>)}
                                  {registryResult.icDph && (<><span className="text-muted-foreground">IČ DPH:</span><span className="font-mono">{registryResult.icDph}{registryResult.vatParagraph ? ` (${registryResult.vatParagraph})` : ""}</span></>)}
                                  {registryResult.vatRegisteredAt && (<><span className="text-muted-foreground">Reg. DPH:</span><span>{registryResult.vatRegisteredAt}</span></>)}
                                  {registryResult.foundedDate && (<><span className="text-muted-foreground">Vznik:</span><span>{registryResult.foundedDate}</span></>)}
                                  {registryResult.legalForm && (<><span className="text-muted-foreground">Právna forma:</span><span>{registryResult.legalForm}</span></>)}
                                  {(registryResult.street || registryResult.city) && (<><span className="text-muted-foreground">Sídlo:</span><span>{[registryResult.street, registryResult.streetNumber, registryResult.zip, registryResult.city].filter(Boolean).join(", ")}</span></>)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem className="w-[40%] flex-shrink-0">
                      <FormLabel>DIČ *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} value={field.value || ""} className="pr-[72px]" data-testid="input-dic" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/30 pointer-events-none select-none" data-testid="badge-dic-required">
                            povinné
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={platcaDph}
                    onCheckedChange={(checked) => {
                      setPlatcaDph(checked);
                      if (!checked) {
                        form.setValue("icDph", "");
                        form.setValue("vatParagraph", "");
                        form.setValue("vatRegisteredAt", null);
                      }
                    }}
                    data-testid="switch-platca-dph"
                  />
                  <span className="text-sm font-medium">Platca DPH</span>
                </div>
                {platcaDph && (
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="icDph" render={({ field }) => (
                      <FormItem>
                        <FormLabel>IČ DPH *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-icdph" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vatParagraph" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Podľa paragrafu</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="§4" data-testid="input-vat-paragraph" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vatRegisteredAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dátum registrácie DPH</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-vat-registered-at" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
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
                {!editingCompany && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Logo spoločnosti</label>
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      data-testid="input-logo-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPendingLogo(file);
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setPendingLogoPreview(url);
                        } else {
                          setPendingLogoPreview(null);
                        }
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => logoFileRef.current?.click()}
                        data-testid="button-select-logo"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {pendingLogo ? "Zmeniť logo" : "Vybrať logo"}
                      </Button>
                      {pendingLogo && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setPendingLogo(null); setPendingLogoPreview(null); if (logoFileRef.current) logoFileRef.current.value = ""; }}
                          data-testid="button-clear-logo"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Odstrániť
                        </Button>
                      )}
                    </div>
                    {pendingLogoPreview && (
                      <div className="flex items-center gap-3 p-2.5 border border-border rounded-md w-fit">
                        <img src={pendingLogoPreview} alt="Náhľad loga" className="h-12 w-12 object-contain rounded" data-testid="img-logo-preview" />
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{pendingLogo?.name}</span>
                      </div>
                    )}
                    {!pendingLogo && (
                      <p className="text-xs text-muted-foreground">Logo sa nahrá automaticky po uložení spoločnosti</p>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="address" className="space-y-6 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Adresa sídla</h4>
                  </div>
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
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Korespondenčná adresa</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="corr-same"
                        checked={corrSameAsHQ}
                        onCheckedChange={(checked) => {
                          setCorrSameAsHQ(!!checked);
                          if (checked) {
                            form.setValue("corrStreet", "");
                            form.setValue("corrStreetNumber", "");
                            form.setValue("corrPostalCode", "");
                            form.setValue("corrCity", "");
                          }
                        }}
                        data-testid="checkbox-corr-same"
                      />
                      <label htmlFor="corr-same" className="text-sm text-muted-foreground cursor-pointer">Rovnaká ako sídlo</label>
                    </div>
                  </div>
                  {!corrSameAsHQ && (
                    <>
                      <FormField control={form.control} name="corrStreet" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ulica</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-street" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="corrStreetNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Číslo</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-street-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrPostalCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>PSČ</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-postal-code" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="corrCity" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mesto / Obec</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-city" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}
                </div>

              </TabsContent>

              <TabsContent value="branches" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Pobočky</h4>
                    <Badge variant="secondary" className="text-xs">{branches.length}</Badge>
                  </div>
                  {!addingBranch && (
                    <Button type="button" variant="outline" size="sm" onClick={openNewBranchForm} data-testid="button-add-branch">
                      <Plus className="w-3 h-3 mr-1" /> Pridať pobočku
                    </Button>
                  )}
                </div>

                {addingBranch && (
                  <div className="border border-primary/40 rounded-md p-4 space-y-4 bg-muted/20" data-testid="form-new-branch">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                      {editingBranchIdx !== null ? `Editácia pobočky #${editingBranchIdx + 1}` : "Nová pobočka"}
                    </p>

                    <Input placeholder="Názov pobočky" value={newBranch.name || ""} onChange={e => setNewBranch(p => ({ ...p, name: e.target.value }))} data-testid="input-branch-name" />
                    <div className="grid grid-cols-3 gap-3">
                      <Input placeholder="Ulica" value={newBranch.street || ""} onChange={e => setNewBranch(p => ({ ...p, street: e.target.value }))} className="col-span-2" data-testid="input-branch-street" />
                      <Input placeholder="Číslo" value={newBranch.streetNumber || ""} onChange={e => setNewBranch(p => ({ ...p, streetNumber: e.target.value }))} data-testid="input-branch-street-number" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="PSČ" value={newBranch.postalCode || ""} onChange={e => setNewBranch(p => ({ ...p, postalCode: e.target.value }))} data-testid="input-branch-postal" />
                      <Input placeholder="Mesto" value={newBranch.city || ""} onChange={e => setNewBranch(p => ({ ...p, city: e.target.value }))} data-testid="input-branch-city" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Phone className="w-3 h-3" />Telefóny</label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBranchPhones(prev => [...prev, ""])} data-testid="button-add-branch-phone">
                          <Plus className="w-3 h-3 mr-0.5" />Pridať telefón
                        </Button>
                      </div>
                      {branchPhones.map((ph, i) => (
                        <div key={i} className="flex gap-2">
                          <Input placeholder={`Telefón ${i + 1}`} value={ph} onChange={e => setBranchPhones(prev => prev.map((p, j) => j === i ? e.target.value : p))} data-testid={`input-branch-phone-${i}`} />
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setBranchPhones(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-branch-phone-${i}`}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      {branchPhones.length === 0 && <p className="text-xs text-muted-foreground">Žiadne telefóny</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" />E-maily</label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBranchEmails(prev => [...prev, ""])} data-testid="button-add-branch-email">
                          <Plus className="w-3 h-3 mr-0.5" />Pridať e-mail
                        </Button>
                      </div>
                      {branchEmails.map((em, i) => (
                        <div key={i} className="flex gap-2">
                          <Input placeholder={`E-mail ${i + 1}`} value={em} onChange={e => setBranchEmails(prev => prev.map((p, j) => j === i ? e.target.value : p))} data-testid={`input-branch-email-${i}`} />
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setBranchEmails(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-branch-email-${i}`}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      {branchEmails.length === 0 && <p className="text-xs text-muted-foreground">Žiadne e-maily</p>}
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stav pobočky</label>
                      <div className="flex gap-2">
                        {([["active", "Aktívna", "border-green-600 text-green-600"], ["temporarily_inactive", "Dočasne neaktívna", "border-amber-500 text-amber-500"], ["inactive", "Neaktívna", "border-destructive text-destructive"]] as const).map(([val, label, cls]) => {
                          const branchStatus = newBranch.isActive === false ? "inactive" : (newBranch as any).branchStatus || "active";
                          const isSelected = branchStatus === val;
                          return (
                            <button key={val} type="button"
                              className={`text-xs px-2.5 py-1 rounded border transition-colors ${isSelected ? cls + " bg-muted/50 font-semibold" : "border-border text-muted-foreground hover:border-primary/40"}`}
                              onClick={() => {
                                setNewBranch(p => ({
                                  ...p,
                                  isActive: val !== "inactive",
                                  branchStatus: val,
                                } as any));
                              }}
                              data-testid={`btn-branch-status-${val}`}
                            >{label}</button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Aktívna od</label>
                        <Input type="date" value={newBranch.activeFrom || ""} onChange={e => setNewBranch(p => ({ ...p, activeFrom: e.target.value || undefined }))} data-testid="input-branch-active-from" />
                      </div>
                      {newBranch.isActive === false && (
                        <div>
                          <label className="text-xs text-muted-foreground">Dátum zrušenia</label>
                          <Input type="date" value={newBranch.cancelledAt || ""} onChange={e => setNewBranch(p => ({ ...p, cancelledAt: e.target.value || undefined }))} data-testid="input-branch-cancelled-at" />
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pracovníci na pobočke</span>
                          <Badge variant="secondary" className="text-xs">{branchEmployees.length}</Badge>
                        </div>
                        {!addingBranchEmployee && (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAddingBranchEmployee(true); setNewEmployee({ status: "active" }); }} data-testid="button-add-employee">
                            <UserPlus className="w-3 h-3 mr-1" />Pridať zamestnanca
                          </Button>
                        )}
                      </div>

                      {addingBranchEmployee && (
                        <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30" data-testid="form-new-employee">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-16 h-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center cursor-pointer hover:opacity-80" onClick={() => employeePhotoRef.current?.click()} data-testid="employee-photo-area">
                                {newEmployee.photo
                                  ? <img src={newEmployee.photo} className="w-full h-full object-cover" alt="foto" />
                                  : <Camera className="w-5 h-5 text-muted-foreground" />
                                }
                              </div>
                              <input ref={employeePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleEmployeePhotoUpload} data-testid="input-employee-photo" />
                              <span className="text-[10px] text-muted-foreground">Fotografia</span>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <Input placeholder="Titul pred" value={newEmployee.titleBefore || ""} onChange={e => setNewEmployee(p => ({ ...p, titleBefore: e.target.value }))} className="text-sm" data-testid="input-emp-title-before" />
                                <Input placeholder="Meno" value={newEmployee.firstName || ""} onChange={e => setNewEmployee(p => ({ ...p, firstName: e.target.value }))} className="text-sm col-span-1" data-testid="input-emp-first-name" />
                                <Input placeholder="Titul za" value={newEmployee.titleAfter || ""} onChange={e => setNewEmployee(p => ({ ...p, titleAfter: e.target.value }))} className="text-sm" data-testid="input-emp-title-after" />
                              </div>
                              <Input placeholder="Priezvisko" value={newEmployee.lastName || ""} onChange={e => setNewEmployee(p => ({ ...p, lastName: e.target.value }))} className="text-sm" data-testid="input-emp-last-name" />
                              <div className="grid grid-cols-2 gap-2">
                                <Input placeholder="UID" value={newEmployee.uid || ""} onChange={e => setNewEmployee(p => ({ ...p, uid: e.target.value }))} className="text-sm font-mono" data-testid="input-emp-uid" />
                                <Input placeholder="Pozícia" value={newEmployee.position || ""} onChange={e => setNewEmployee(p => ({ ...p, position: e.target.value }))} className="text-sm" data-testid="input-emp-position" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Telefón" value={newEmployee.phone || ""} onChange={e => setNewEmployee(p => ({ ...p, phone: e.target.value }))} className="text-sm" data-testid="input-emp-phone" />
                            <Input placeholder="E-mail" value={newEmployee.email || ""} onChange={e => setNewEmployee(p => ({ ...p, email: e.target.value }))} className="text-sm" data-testid="input-emp-email" />
                          </div>
                          <Textarea placeholder="Iný kontakt (poznámka)" value={newEmployee.otherContact || ""} onChange={e => setNewEmployee(p => ({ ...p, otherContact: e.target.value }))} className="text-sm h-16 resize-none" data-testid="input-emp-other-contact" />
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Stav zamestnanca</label>
                            <div className="flex gap-2">
                              {([["active", "Aktívny", "border-green-600 text-green-600"], ["temporarily_inactive", "Dočasne neaktívny", "border-amber-500 text-amber-500"], ["inactive", "Neaktívny", "border-destructive text-destructive"]] as const).map(([val, label, cls]) => (
                                <button key={val} type="button"
                                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${newEmployee.status === val ? cls + " bg-muted/50 font-semibold" : "border-border text-muted-foreground hover:border-primary/40"}`}
                                  onClick={() => setNewEmployee(p => ({ ...p, status: val }))}
                                  data-testid={`btn-emp-status-${val}`}
                                >{label}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingBranchEmployee(false); setNewEmployee({ status: "active" }); }} data-testid="button-employee-cancel">Zrušiť</Button>
                            <Button type="button" size="sm" onClick={saveEmployee} data-testid="button-employee-save">Uložiť zamestnanca</Button>
                          </div>
                        </div>
                      )}

                      {branchEmployees.length > 0 && (
                        <div className="space-y-2">
                          {branchEmployees.map((emp, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 border border-border rounded-md bg-muted/10" data-testid={`employee-row-${i}`}>
                              <div className="w-10 h-10 rounded shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center">
                                {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="foto" /> : <UserCog className="w-4 h-4 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {[emp.titleBefore, emp.firstName, emp.lastName, emp.titleAfter].filter(Boolean).join(" ") || "—"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {emp.uid && <span className="font-mono">{emp.uid}</span>}
                                  {emp.position && <span>{emp.position}</span>}
                                  {emp.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{emp.phone}</span>}
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${emp.status === "active" ? "border-green-600 text-green-600" : emp.status === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                                {emp.status === "active" ? "Aktívny" : emp.status === "temporarily_inactive" ? "Dočasne" : "Neaktívny"}
                              </Badge>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => setBranchEmployees(prev => prev.filter((_, j) => j !== i))} data-testid={`button-delete-employee-${i}`}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {branchEmployees.length === 0 && !addingBranchEmployee && (
                        <p className="text-xs text-muted-foreground text-center py-3">Žiadni pracovníci. Kliknite "Pridať zamestnanca".</p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end pt-1 border-t border-border">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingBranch(false); setEditingBranchIdx(null); }} data-testid="button-branch-cancel">Zrušiť</Button>
                      <Button type="button" size="sm" onClick={saveBranchForm} data-testid="button-branch-save">
                        {editingBranchIdx !== null ? "Uložiť zmeny" : "Pridať pobočku"}
                      </Button>
                    </div>
                  </div>
                )}

                {branches.length > 0 && !addingBranch && (
                  <div className="space-y-2">
                    {branches.map((br, idx) => {
                      const brPhones = br.phones ?? (br.phone ? [br.phone] : []);
                      const brEmails = br.emails ?? (br.email ? [br.email] : []);
                      const empCount = br.employees?.length ?? 0;
                      const status = (br as any).branchStatus || (br.isActive !== false ? "active" : "inactive");
                      return (
                        <div key={idx} className="border border-border rounded-md p-3 space-y-2" data-testid={`branch-row-${idx}`}>
                          <div className="flex items-start gap-3">
                            <GitBranch className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-sm space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {br.name && <span className="font-medium">{br.name}</span>}
                                <Badge variant="outline" className={`text-[10px] ${status === "active" ? "border-green-600 text-green-600" : status === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`} data-testid={`badge-branch-status-${idx}`}>
                                  {status === "active" ? "Aktívna" : status === "temporarily_inactive" ? "Dočasne neaktívna" : "Neaktívna"}
                                </Badge>
                                {empCount > 0 && <Badge variant="secondary" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-0.5" />{empCount}</Badge>}
                              </div>
                              <p className="text-muted-foreground text-xs">{[br.street, br.streetNumber, br.postalCode, br.city].filter(Boolean).join(", ") || "Bez adresy"}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                {br.activeFrom && <span>Od: {br.activeFrom}</span>}
                                {br.isActive === false && br.cancelledAt && <span className="text-destructive">Zrušená: {br.cancelledAt}</span>}
                                {brPhones.map((p, i) => <span key={i} className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{p}</span>)}
                                {brEmails.map((e, i) => <span key={i} className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{e}</span>)}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBranchForm(idx)} data-testid={`button-edit-branch-${idx}`}><Pencil className="w-3 h-3" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setBranches(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-delete-branch-${idx}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {branches.length === 0 && !addingBranch && (
                  <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md" data-testid="text-no-branches">
                    Žiadne pobočky. Kliknite na "Pridať pobočku" pre pridanie prvej pobočky.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="divisions" className="mt-4 space-y-6">
                <CompanyDivisionsTab companyId={editingCompany?.id || null} />

                <Separator />

                {(() => {
                  const activitiesSource: BusinessActivity[] = registryResult?.businessActivities ?? (editingCompany?.businessActivities as BusinessActivity[]) ?? [];
                  const isFromLookup = !!registryResult?.businessActivities;
                  return (
                    <div data-testid="section-business-activities">
                      <div className="border border-border rounded-md">
                        <button
                          type="button"
                          className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                          onClick={() => setShowActivities(!showActivities)}
                          data-testid="button-toggle-activities"
                        >
                          <span>Predmety podnikania ({isFromLookup ? `${selectedActivityIndices.size}/${activitiesSource.length}` : activitiesSource.length})</span>
                          {showActivities ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showActivities && activitiesSource.length > 0 && (
                          <div className="border-t border-border p-3 space-y-1.5 max-h-48 overflow-y-auto">
                            {activitiesSource.map((act, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm" data-testid={`activity-row-${idx}`}>
                                {isFromLookup && (
                                  <Checkbox
                                    checked={selectedActivityIndices.has(idx)}
                                    onCheckedChange={(checked) => {
                                      const next = new Set(selectedActivityIndices);
                                      if (checked) next.add(idx); else next.delete(idx);
                                      setSelectedActivityIndices(next);
                                    }}
                                    data-testid={`checkbox-activity-${idx}`}
                                    className="mt-0.5"
                                  />
                                )}
                                <span className="text-muted-foreground flex-1">{act.text}</span>
                                {act.since && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">(od: {act.since})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {showActivities && activitiesSource.length === 0 && (
                          <div className="border-t border-border p-3 text-sm text-muted-foreground">
                            Žiadne predmety podnikania. Vyhľadajte firmu cez IČO v záložke Základné údaje.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="officers" className="mt-4 space-y-4">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5" data-testid="section-officers-info">
                  <p className="text-sm font-medium flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Čo sú Štatutári?</p>
                  <p className="text-sm text-muted-foreground">
                    Štatutári sú fyzické alebo právnické osoby oprávnené konať v mene spoločnosti navonok.
                    Patrí sem <span className="text-foreground font-medium">konateľ</span>, <span className="text-foreground font-medium">člen predstavenstva</span>,
                    {" "}<span className="text-foreground font-medium">prokurista</span>, správca, likvidátor a iné osoby zapísané v Obchodnom registri SR.
                    Každý štatutár musí byť zapísaný v systéme pod vlastným UID.
                  </p>
                </div>
                {registryResult?.actingNote && (
                  <p className="text-xs text-muted-foreground italic" data-testid="text-officers-acting-note">{registryResult.actingNote}</p>
                )}
                <CompanyOfficersSection
                  companyId={editingCompany?.id ?? null}
                  registryDirectors={registryResult?.directors}
                  companyUid={editingCompany?.uid}
                />
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
                <span className="text-xs font-mono text-muted-foreground">{company.code}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full mt-2">
          <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
            <TabsTrigger value="basic" data-testid="detail-tab-basic">Základné údaje</TabsTrigger>
            <TabsTrigger value="officers" data-testid="detail-tab-officers">Štatutári</TabsTrigger>
            <TabsTrigger value="address" data-testid="detail-tab-address">Adresa</TabsTrigger>
            <TabsTrigger value="branches" data-testid="detail-tab-branches">Pobočky</TabsTrigger>
            <TabsTrigger value="docs" data-testid="detail-tab-docs">Dokumenty</TabsTrigger>
            <TabsTrigger value="notes" data-testid="detail-tab-notes">Poznámky</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="IČO" value={company.ico} testId="text-detail-ico" />
              <InfoRow label="DIČ" value={company.dic} testId="text-detail-dic" />
              <InfoRow label="Kód firmy" value={company.code} mono testId="text-detail-code" />
              <InfoRow label="Typ subjektu" value={(company as any).subjectType ? (company as any).subjectType.toUpperCase() : "-"} testId="text-detail-subject-type" />
              <InfoRow label="Dátum založenia" value={(company as any).foundedDate ? formatDateSlovak((company as any).foundedDate) : "-"} testId="text-detail-founded-date" />
            </div>
            {company.icDph && (
              <div className="grid grid-cols-3 gap-4">
                <InfoRow label="IČ DPH" value={company.icDph} testId="text-detail-icdph" />
                <InfoRow label="Podľa paragrafu" value={company.vatParagraph || "-"} testId="text-detail-vat-paragraph" />
                <InfoRow label="Registrácia DPH" value={company.vatRegisteredAt ? formatDateSlovak(company.vatRegisteredAt) : "-"} testId="text-detail-vat-registered-at" />
              </div>
            )}
            {company.description && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Čím sa firma zaoberá</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-detail-description">{company.description}</p>
                </div>
              </>
            )}
            {((company.businessActivities as BusinessActivity[]) || []).length > 0 && (
              <>
                <Separator />
                <div data-testid="detail-section-activities">
                  <span className="text-xs text-muted-foreground">Predmety podnikania</span>
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {(company.businessActivities as BusinessActivity[]).map((act, idx) => (
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

          <TabsContent value="address" className="mt-4 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Adresa sídla</h4>
              </div>
              <div className="flex items-start gap-3 pl-1">
                <div className="text-sm space-y-1">
                  <p data-testid="text-detail-address">{addressParts || "Nezadaná adresa"}</p>
                  <p className="text-muted-foreground" data-testid="text-detail-city">{cityLine || "-"}</p>
                  <p data-testid="text-detail-state">{getStateName(company.stateId)}</p>
                </div>
              </div>
            </div>

            {(company.corrStreet || company.corrCity) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Korespondenčná adresa</h4>
                  </div>
                  <div className="text-sm space-y-1 pl-1">
                    <p data-testid="text-detail-corr-address">{[company.corrStreet, company.corrStreetNumber].filter(Boolean).join(" ") || "-"}</p>
                    <p className="text-muted-foreground" data-testid="text-detail-corr-city">{[company.corrPostalCode, company.corrCity].filter(Boolean).join(" ") || "-"}</p>
                  </div>
                </div>
              </>
            )}

          </TabsContent>

          <TabsContent value="branches" className="mt-4 space-y-4">
            {(() => {
              const branchList = (company.branches as BranchEntry[]) || [];
              return branchList.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Pobočky</h4>
                    <Badge variant="secondary" className="text-xs">{branchList.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {branchList.map((br, idx) => {
                      const brPhones = br.phones ?? (br.phone ? [br.phone] : []);
                      const brEmails = br.emails ?? (br.email ? [br.email] : []);
                      const empList = br.employees ?? [];
                      const status = (br as any).branchStatus || (br.isActive !== false ? "active" : "inactive");
                      return (
                        <div key={idx} className="border border-border rounded-md p-3 space-y-3 text-sm" data-testid={`detail-branch-${idx}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {br.name && <span className="font-medium">{br.name}</span>}
                            <Badge variant="outline" className={`text-[10px] ${status === "active" ? "border-green-600 text-green-600" : status === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                              {status === "active" ? "Aktívna" : status === "temporarily_inactive" ? "Dočasne neaktívna" : "Neaktívna"}
                            </Badge>
                            {empList.length > 0 && <Badge variant="secondary" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-0.5" />{empList.length} pracovníkov</Badge>}
                          </div>
                          <p className="text-muted-foreground text-xs">{[br.street, br.streetNumber, br.postalCode, br.city].filter(Boolean).join(", ") || "Bez adresy"}</p>
                          {(brPhones.length > 0 || brEmails.length > 0) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {brPhones.map((p, i) => <span key={i} className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{p}</span>)}
                              {brEmails.map((e, i) => <span key={i} className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{e}</span>)}
                            </div>
                          )}
                          {br.activeFrom && <p className="text-xs text-muted-foreground">Aktívna od: {br.activeFrom}{br.isActive === false && br.cancelledAt ? ` — Zrušená: ${br.cancelledAt}` : ""}</p>}
                          {empList.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" />Pracovníci na pobočke</p>
                              <div className="space-y-1.5">
                                {empList.map((emp, ei) => (
                                  <div key={ei} className="flex items-center gap-2.5 p-2 rounded border border-border/50 bg-muted/10" data-testid={`detail-branch-${idx}-emp-${ei}`}>
                                    <div className="w-9 h-9 rounded shrink-0 border border-border overflow-hidden bg-muted flex items-center justify-center">
                                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="foto" /> : <UserCog className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {[emp.titleBefore, emp.firstName, emp.lastName, emp.titleAfter].filter(Boolean).join(" ") || "—"}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                        {emp.uid && <span className="font-mono">{emp.uid}</span>}
                                        {emp.position && <span>{emp.position}</span>}
                                        {emp.phone && <span className="flex items-center gap-0.5"><Phone className="w-2 h-2" />{emp.phone}</span>}
                                        {emp.email && <span className="flex items-center gap-0.5"><Mail className="w-2 h-2" />{emp.email}</span>}
                                      </div>
                                      {emp.otherContact && <p className="text-[10px] text-muted-foreground/70 truncate">{emp.otherContact}</p>}
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] shrink-0 ${emp.status === "active" ? "border-green-600 text-green-600" : emp.status === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                                      {emp.status === "active" ? "Aktívny" : emp.status === "temporarily_inactive" ? "Dočasne" : "Neaktívny"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-detail-no-branches">
                  Žiadne pobočky
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="officers" className="mt-4 space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5" data-testid="detail-section-officers-info">
              <p className="text-sm font-medium flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Čo sú Štatutári?</p>
              <p className="text-sm text-muted-foreground">
                Štatutári sú fyzické alebo právnické osoby oprávnené konať v mene spoločnosti navonok.
                Každý štatutár musí byť zapísaný v systéme pod vlastným UID.
              </p>
            </div>
            <CompanyOfficersSection companyId={company.id} companyUid={company.uid} />
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
                {columnVisibility.isVisible("city") && <TableHead sortKey="city" sortDirection={sortKey === "city" ? sortDirection : null} onSort={requestSort}>Mesto</TableHead>}
                {columnVisibility.isVisible("state") && <TableHead>Štát</TableHead>}
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

function CompanyOfficersSection({ companyId, registryDirectors, companyUid }: { companyId: number | null; registryDirectors?: RegistryDirector[]; companyUid?: string | null }) {
  const { toast } = useToastCompanyDiv();
  const { data: officers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/my-companies', companyId, 'officers'],
    queryFn: () => fetch(`/api/my-companies/${companyId}/officers`).then(r => r.json()),
    enabled: !!companyId,
  });

  const registerMutation = useMutation({
    mutationFn: async (officerId: number) => {
      const resp = await apiRequest("POST", `/api/company-officers/${officerId}/register-subject`);
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      if (data.alreadyRegistered) {
        toast({ title: "Štatutár je už zapísaný", description: `UID: ${formatUid(data.subject?.uid)}` });
      } else {
        toast({ title: "Štatutár zapísaný do systému", description: `UID: ${formatUid(data.uid)}` });
      }
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zapísať štatutára", variant: "destructive" });
    },
  });

  const registerFromRegistryMutation = useMutation({
    mutationFn: async (dir: RegistryDirector) => {
      const resp = await apiRequest("POST", "/api/company-officers/register-from-registry", {
        companyId,
        name: dir.name,
        role: dir.role || 'Štatutár',
        since: dir.since,
      });
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      if (data.alreadyExists) {
        toast({ title: "Štatutár už existuje v záznamoch" });
      } else {
        toast({ title: "Štatutár zapísaný", description: `UID: ${formatUid(data.subject?.uid)}` });
      }
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zapísať štatutára z registra", variant: "destructive" });
    },
  });

  const registeredNames = new Set(
    officers.map((off: any) =>
      `${(off.firstName || '').toLowerCase().trim()} ${(off.lastName || '').toLowerCase().trim()}`
    )
  );

  const unregisteredDirectors = (registryDirectors || []).filter(dir => {
    const parts = dir.name.trim().split(/\s+/);
    const titles = ['Ing.', 'Mgr.', 'JUDr.', 'MUDr.', 'RNDr.', 'PhDr.', 'PaedDr.', 'doc.', 'prof.', 'Bc.', 'MBA', 'PhD.', 'CSc.', 'DrSc.', 'RSDr.', 'MVDr.', 'Dr.'];
    const mainParts = parts.filter(p => !titles.some(t => p.replace(/,/g, '').toLowerCase() === t.toLowerCase()));
    const simpleName = mainParts.join(' ').toLowerCase().trim();
    return !registeredNames.has(simpleName);
  });

  if (!companyId) return null;
  if (isLoading) return (
    <div className="text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="w-3 h-3 animate-spin" />Načítavam štatutárov...
    </div>
  );

  return (
    <div className="space-y-4" data-testid="section-db-officers">
      {officers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <UserCheck className="w-3 h-3" />Zapísaní štatutári ({officers.length})
          </p>
          {officers.map((off: any) => (
            <div key={off.id} className="flex items-center gap-3 p-3 border border-border rounded-md text-sm" data-testid={`officer-db-${off.id}`}>
              <UserCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {[off.titleBefore, off.firstName, off.lastName, off.titleAfter].filter(Boolean).join(" ")}
                    {off.ownerCompanyName && <span> {off.ownerCompanyName}</span>}
                  </span>
                  {off.type && <Badge variant="outline" className="text-[10px]">{off.type}</Badge>}
                </div>
                {off.city && <span className="text-xs text-muted-foreground">{off.city}</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {off.subjectUid ? (
                  <Badge variant="secondary" className="font-mono text-[10px]" data-testid={`badge-uid-${off.id}`}>
                    {formatUid(off.subjectUid)}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => registerMutation.mutate(off.id)}
                    disabled={registerMutation.isPending}
                    data-testid={`button-register-officer-${off.id}`}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    Zapísať do systému
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unregisteredDirectors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Search className="w-3 h-3" />Nájdení v registri – nezapísaní ({unregisteredDirectors.length})
          </p>
          {unregisteredDirectors.map((dir, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 border border-dashed border-amber-500/50 rounded-md text-sm bg-amber-500/5" data-testid={`officer-registry-unregistered-${idx}`}>
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{dir.name}</span>
                  {dir.role && <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">{dir.role}</Badge>}
                </div>
                {dir.since && <span className="text-xs text-muted-foreground">od: {dir.since}</span>}
              </div>
              <Button
                size="sm"
                variant="default"
                className="text-xs h-7"
                onClick={() => registerFromRegistryMutation.mutate(dir)}
                disabled={registerFromRegistryMutation.isPending}
                data-testid={`button-register-registry-${idx}`}
              >
                {registerFromRegistryMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                Zapísať
              </Button>
            </div>
          ))}
        </div>
      )}

      {officers.length === 0 && unregisteredDirectors.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-officers">
          Žiadni štatutári. Vyhľadajte firmu cez IČO v záložke „Základné údaje" pre načítanie štatutárov z Obchodného registra.
        </p>
      )}
    </div>
  );
}
