import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useMyCompanies, useCreateMyCompany, useUpdateMyCompany, useDeleteMyCompany } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useAppUser } from "@/hooks/use-app-user";
import { Plus, Building2, Pencil, Trash2, Eye, Upload, FileText, X, Download, Clock, MapPin, FileCheck, Image, Loader2, Search, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Phone, Mail, GitBranch, Info, UserCheck, UserPlus, Users, Camera, UserCog, Archive } from "lucide-react";
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
  titleBefore?: string;
  firstName?: string;
  lastName?: string;
  titleAfter?: string;
}

interface StatusHistoryEntry {
  status: "active" | "inactive" | "temporarily_inactive";
  from?: string;
  to?: string;
}

interface BranchEmployee {
  photo?: string;
  uid?: string;
  position?: string;
  titleBefore?: string;
  firstName?: string;
  lastName?: string;
  titleAfter?: string;
  phones?: string[];
  emails?: string[];
  status?: "active" | "inactive" | "temporarily_inactive";
  inactiveUntil?: string;
  statusHistory?: StatusHistoryEntry[];
}

interface BranchEntry {
  name?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
  city?: string;
  stateId?: number;
  phone?: string;
  email?: string;
  phones?: string[];
  emails?: string[];
  isActive?: boolean;
  activeFrom?: string;
  cancelledAt?: string;
  branchStatus?: string;
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
  DialogDescription,
  DialogFooter,
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
  { key: "uid", label: "UID" },
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
  streetNumber: z.string().optional().nullable(),
  orientNumber: z.string().min(1, "Orientačné číslo je povinné"),
  postalCode: z.string().min(1, "PSČ je povinné"),
  city: z.string().min(1, "Mesto je povinné"),
  corrStreet: z.string().optional().nullable(),
  corrStreetNumber: z.string().optional().nullable(),
  corrOrientNumber: z.string().optional().nullable(),
  corrPostalCode: z.string().optional().nullable(),
  corrCity: z.string().optional().nullable(),
  corrStateId: z.number().optional().nullable(),
  stateId: z.number().optional(),
  description: z.string().optional().nullable(),
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
  const [archiving, setArchiving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: freshCompany } = useQuery<MyCompany>({
    queryKey: ["/api/my-companies", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/my-companies/${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const logoSource = freshCompany || company;
  const primaryLogo = (logoSource?.logos as any[])?.find((l: any) => l.isPrimary && !l.isArchived) || null;

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
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId] });
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId, "logo-history"] });
      toast({ title: "Logo nahrané", description: `${file.name} je teraz aktívne logo.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrať logo.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleArchive() {
    if (!companyId || !primaryLogo) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/my-companies/${companyId}/logos/archive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: primaryLogo.url }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["/api/my-companies"] });
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId, "logo-history"] });
      toast({ title: "Logo archivované", description: "Primárne logo bolo archivované." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa archivovať logo.", variant: "destructive" });
    } finally {
      setArchiving(false);
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
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId] });
      qc.invalidateQueries({ queryKey: ["/api/my-companies", companyId, "logo-history"] });
      toast({ title: "Logo nastavené", description: "Vybrané logo je teraz primárne." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nastaviť logo.", variant: "destructive" });
    } finally {
      setSettingPrimary(null);
    }
  }

  const allLogos: any[] = (logoSource?.logos as any[]) || [];
  const activeLogos = allLogos.filter((l: any) => !l.isArchived);
  const archivedLogos = allLogos.filter((l: any) => l.isArchived);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Logo spoločnosti</h4>
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

      {primaryLogo ? (
        <div className="flex flex-col items-center gap-3 p-5 border-2 border-primary/40 rounded-lg bg-primary/5" data-testid="div-primary-logo">
          <div className="w-28 h-28 rounded-lg border border-border overflow-hidden bg-background flex items-center justify-center shadow-md">
            <img src={primaryLogo.url} alt="Aktívne logo" className="w-full h-full object-contain" />
          </div>
          <Badge variant="outline" className="border-green-600 text-green-600 text-[10px]">Aktívne logo</Badge>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => window.open(primaryLogo.url, "_blank")} data-testid="button-view-primary-logo">
              <Eye className="w-3.5 h-3.5" /> Zobraziť
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleArchive} disabled={archiving} data-testid="button-archive-logo">
              {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Archivovať
            </Button>
          </div>
        </div>
      ) : companyId ? (
        <div className="p-8 border-2 border-dashed border-border rounded-lg text-center text-sm text-muted-foreground" data-testid="text-no-logo">
          Žiadne aktívne logo
        </div>
      ) : null}

      {activeLogos.filter((l: any) => !l.isPrimary).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ostatné aktívne</p>
          <div className="grid grid-cols-4 gap-2">
            {activeLogos.filter((l: any) => !l.isPrimary).map((logo: any, i: number) => (
              <div key={i} className="group relative flex flex-col items-center gap-1.5 p-2 border border-border rounded-md bg-muted/10 hover:border-primary/40 transition-colors" data-testid={`logo-active-${i}`}>
                <div className="w-14 h-14 rounded overflow-hidden border border-border bg-background flex items-center justify-center">
                  <img src={logo.url} alt="logo" className="w-full h-full object-contain" />
                </div>
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2 w-full" onClick={() => handleSetPrimary(logo.url)} disabled={!!settingPrimary} data-testid={`button-set-primary-logo-${i}`}>
                  {settingPrimary === logo.url ? <Loader2 className="w-3 h-3 animate-spin" /> : "Nastaviť"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {archivedLogos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Archivované</p>
          <div className="grid grid-cols-4 gap-2">
            {archivedLogos.map((logo: any, i: number) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-2 border border-border/50 rounded-md bg-muted/5 opacity-60" data-testid={`logo-archived-${i}`}>
                <div className="w-14 h-14 rounded overflow-hidden border border-border bg-background flex items-center justify-center">
                  <img src={logo.url} alt="logo" className="w-full h-full object-contain grayscale" />
                </div>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 w-full" onClick={() => handleSetPrimary(logo.url)} disabled={!!settingPrimary} data-testid={`button-restore-logo-${i}`}>
                  {settingPrimary === logo.url ? <Loader2 className="w-3 h-3 animate-spin" /> : "Obnoviť"}
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
  section: "official" | "work" | "tax";
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
  const [editingEmployeeIdx, setEditingEmployeeIdx] = useState<number | null>(null);
  const [newEmployee, setNewEmployee] = useState<BranchEmployee>({ status: "active" });
  const [empPhones, setEmpPhones] = useState<string[]>([]);
  const [empEmails, setEmpEmails] = useState<string[]>([]);
  const [empStatusHistory, setEmpStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [empUidStatus, setEmpUidStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const employeePhotoRef = useRef<HTMLInputElement>(null);

  async function lookupEmployeeByUid() {
    const uid = newEmployee.uid?.trim();
    if (!uid) return;
    setEmpUidStatus("loading");
    try {
      const res = await fetch(`/api/subjects/by-uid/${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        setNewEmployee(prev => ({
          ...prev,
          firstName: data.firstName || prev.firstName,
          lastName: data.lastName || prev.lastName,
          titleBefore: data.titleBefore || prev.titleBefore,
          titleAfter: data.titleAfter || prev.titleAfter,
          photo: data.photoUrl || prev.photo,
        }));
        setEmpUidStatus("found");
      } else {
        setEmpUidStatus("not-found");
      }
    } catch {
      setEmpUidStatus("not-found");
    }
  }
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
      corrOrientNumber: "",
      corrPostalCode: "",
      corrCity: "",
      corrStateId: undefined,
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
        const hasCorrAddr = !!(editingCompany.corrStreet || editingCompany.corrStreetNumber || (editingCompany as any).corrOrientNumber || editingCompany.corrPostalCode || editingCompany.corrCity || (editingCompany as any).corrStateId);
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
          corrOrientNumber: (editingCompany as any).corrOrientNumber || "",
          corrPostalCode: editingCompany.corrPostalCode || "",
          corrCity: editingCompany.corrCity || "",
          corrStateId: (editingCompany as any).corrStateId || undefined,
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
          corrOrientNumber: "",
          corrPostalCode: "",
          corrCity: "",
          corrStateId: undefined,
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
      if (data.streetNumber) {
        const raw = String(data.streetNumber).trim();
        if (raw.includes("/")) {
          const [popisne, orientacne] = raw.split("/").map((s: string) => s.trim());
          form.setValue("streetNumber", popisne || "");
          form.setValue("orientNumber", orientacne || "");
        } else {
          form.setValue("streetNumber", "");
          form.setValue("orientNumber", raw);
        }
      }
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
    setEditingEmployeeIdx(null);
    setNewEmployee({ status: "active" });
    setEmpPhones([]);
    setEmpEmails([]);
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
    setEditingEmployeeIdx(null);
    setNewEmployee({ status: "active" });
    setEmpPhones([]);
    setEmpEmails([]);
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

  function deriveCurrentStatus(history: StatusHistoryEntry[]): "active" | "inactive" | "temporarily_inactive" {
    if (!history || history.length === 0) return "active";
    const current = history.find(e => !e.to) || history[history.length - 1];
    return current.status || "active";
  }

  function saveEmployee() {
    if (newEmployee.firstName || newEmployee.lastName || newEmployee.position || newEmployee.uid) {
      const currentStatus = deriveCurrentStatus(empStatusHistory);
      const saved: BranchEmployee = {
        ...newEmployee,
        phones: empPhones.filter(p => p.trim()),
        emails: empEmails.filter(e => e.trim()),
        statusHistory: empStatusHistory,
        status: currentStatus,
        inactiveUntil: undefined,
      };
      if (editingEmployeeIdx !== null) {
        setBranchEmployees(prev => prev.map((e, i) => i === editingEmployeeIdx ? saved : e));
        setEditingEmployeeIdx(null);
      } else {
        setBranchEmployees(prev => [...prev, saved]);
      }
      setNewEmployee({ status: "active" });
      setEmpPhones([]);
      setEmpEmails([]);
      setEmpStatusHistory([]);
      setEmpUidStatus("idle");
      setAddingBranchEmployee(false);
    }
  }

  function openEditEmployee(idx: number) {
    const emp = branchEmployees[idx];
    setNewEmployee({ ...emp });
    setEmpPhones(emp.phones ?? []);
    setEmpEmails(emp.emails ?? []);
    if (emp.statusHistory && emp.statusHistory.length > 0) {
      setEmpStatusHistory(emp.statusHistory);
    } else if (emp.status) {
      setEmpStatusHistory([{ status: emp.status, from: "", to: emp.inactiveUntil || "" }]);
    } else {
      setEmpStatusHistory([]);
    }
    setEmpUidStatus("idle");
    setEditingEmployeeIdx(idx);
    setAddingBranchEmployee(true);
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
      corrOrientNumber: corrSameAsHQ ? null : (data.corrOrientNumber || null),
      corrPostalCode: corrSameAsHQ ? null : (data.corrPostalCode || null),
      corrCity: corrSameAsHQ ? null : (data.corrCity || null),
      corrStateId: corrSameAsHQ ? null : (data.corrStateId || null),
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
  const taxDocs = (editingCompany?.taxDocs as DocEntry[]) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {editingCompany ? "Upraviť spoločnosť" : "Pridať novú spoločnosť"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="company-form" onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
                <TabsTrigger value="basic" data-testid="tab-basic">Základné údaje</TabsTrigger>
                <TabsTrigger value="officers" data-testid="tab-officers">Štatutári</TabsTrigger>
                <TabsTrigger value="address" data-testid="tab-address">Adresa</TabsTrigger>
                <TabsTrigger value="branches" data-testid="tab-branches">Pobočky</TabsTrigger>
                <TabsTrigger value="divisions" data-testid="tab-divisions">Divízie</TabsTrigger>
                <TabsTrigger value="docs" data-testid="tab-docs">Dokumenty</TabsTrigger>
                <TabsTrigger value="logo" data-testid="tab-logo">Logo</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Poznámky</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                {editingCompany?.uid && (
                  <div className="flex items-center gap-2 px-1 py-1.5 rounded-md bg-muted/40 border border-border/50">
                    <span className="text-xs text-muted-foreground shrink-0">UID</span>
                    <span className="font-mono text-sm font-medium tracking-wide whitespace-nowrap select-all" data-testid="input-company-uid">{formatUid(editingCompany.uid)}</span>
                  </div>
                )}
                <div className="flex gap-3 items-end">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="flex-[5]">
                      <FormLabel>Názov spoločnosti</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem className="flex-[2]">
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
                          <div className={`relative rounded-md transition-all duration-200 ${registryResult && !registryError ? "ring-2 ring-green-600 ring-offset-0" : ""}`}>
                            <Input
                              {...field}
                              value={field.value || ""}
                              data-testid="input-ico"
                              className={`${watchedSubjectType === "po" ? "pr-32" : ""} ${registryResult && !registryError ? "border-green-600 bg-green-950/20 focus-visible:ring-green-600" : ""}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && watchedSubjectType === "po") {
                                  e.preventDefault();
                                  handleRegistryLookup();
                                }
                              }}
                            />
                            {watchedSubjectType === "po" && (
                              <button
                                ref={registryLookupBtnRef}
                                type="button"
                                disabled={registryLoading}
                                onClick={handleRegistryLookup}
                                data-testid="button-registry-lookup"
                                className={`absolute right-0 top-0 bottom-0 flex items-center gap-1.5 px-3 text-xs font-medium border-l rounded-r-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                  ${registryResult && !registryError
                                    ? "border-green-600 text-green-500 bg-green-950/30 hover:bg-green-900/40"
                                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  }`}
                              >
                                {registryLoading
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : registryResult && !registryError
                                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                                    : <Search className="w-3.5 h-3.5" />
                                }
                                {registryLoading ? "Hľadám..." : registryResult && !registryError ? "Nájdené" : "Hľadať"}
                              </button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {watchedSubjectType === "po" && (
                      <>
                        {registryError && (
                          <div className="flex items-center gap-1 text-xs text-destructive" data-testid="text-registry-error">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{registryError}</span>
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
                <FormField control={form.control} name="foundedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum založenia spoločnosti</FormLabel>
                    <FormControl><Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-founded-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
                        <FormLabel>Popisné číslo</FormLabel>
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
                  <div className="grid grid-cols-3 gap-4">
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
                    <FormField control={form.control} name="stateId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Štát *</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Vybrať štát" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allStates?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                            form.setValue("corrOrientNumber", "");
                            form.setValue("corrPostalCode", "");
                            form.setValue("corrCity", "");
                            form.setValue("corrStateId", undefined);
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
                          <FormLabel>Ulica *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-street" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="corrStreetNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Popisné číslo</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-street-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrOrientNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Orientačné číslo *</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-orient-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="corrPostalCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>PSČ *</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-postal-code" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrCity" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mesto / Obec *</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-corr-city" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrStateId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Štát *</FormLabel>
                            <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-corr-state">
                                  <SelectValue placeholder="Vybrať štát" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {allStates?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
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
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Štát</label>
                      <Select
                        value={newBranch.stateId ? String(newBranch.stateId) : ""}
                        onValueChange={(v) => setNewBranch(p => ({ ...p, stateId: Number(v) }))}
                      >
                        <SelectTrigger data-testid="select-branch-state">
                          <SelectValue placeholder="Vybrať štát" />
                        </SelectTrigger>
                        <SelectContent>
                          {allStates?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAddingBranchEmployee(true); setNewEmployee({ status: "active" }); setEmpStatusHistory([]); setEmpUidStatus("idle"); }} data-testid="button-add-employee">
                            <UserPlus className="w-3 h-3 mr-1" />Pridať pracovníka
                          </Button>
                        )}
                      </div>

                      {addingBranchEmployee && (
                        <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30" data-testid="form-new-employee">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1 shrink-0">
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
                              <div className="flex gap-2 items-start">
                                <div className="flex-1 space-y-1">
                                  <div className="flex gap-1.5">
                                    <Input
                                      placeholder="UID"
                                      value={newEmployee.uid || ""}
                                      onChange={e => { setNewEmployee(p => ({ ...p, uid: e.target.value })); setEmpUidStatus("idle"); }}
                                      className="text-sm font-mono"
                                      data-testid="input-emp-uid"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={lookupEmployeeByUid}
                                      disabled={!newEmployee.uid?.trim() || empUidStatus === "loading"}
                                      className="shrink-0 h-9 text-xs gap-1"
                                      data-testid="button-emp-uid-search"
                                    >
                                      <Search className="w-3 h-3" />
                                      {empUidStatus === "loading" ? "Hľadám..." : "Hľadať"}
                                    </Button>
                                  </div>
                                  {empUidStatus === "found" && (
                                    <p className="text-[11px] text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Pracovník nájdený – údaje doplnené</p>
                                  )}
                                  {empUidStatus === "not-found" && (
                                    <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />UID nenájdené – pracovník musí byť najprv zaregistrovaný v Subjektoch</p>
                                  )}
                                </div>
                                <Input placeholder="Pozícia / funkcia" value={newEmployee.position || ""} onChange={e => setNewEmployee(p => ({ ...p, position: e.target.value }))} className="text-sm w-36" data-testid="input-emp-position" />
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <Input placeholder="Titul pred" value={newEmployee.titleBefore || ""} onChange={e => setNewEmployee(p => ({ ...p, titleBefore: e.target.value }))} className="text-sm" data-testid="input-emp-title-before" />
                                <Input placeholder="Meno" value={newEmployee.firstName || ""} onChange={e => setNewEmployee(p => ({ ...p, firstName: e.target.value }))} className="text-sm" data-testid="input-emp-first-name" />
                                <Input placeholder="Priezvisko" value={newEmployee.lastName || ""} onChange={e => setNewEmployee(p => ({ ...p, lastName: e.target.value }))} className="text-sm" data-testid="input-emp-last-name" />
                                <Input placeholder="Titul za" value={newEmployee.titleAfter || ""} onChange={e => setNewEmployee(p => ({ ...p, titleAfter: e.target.value }))} className="text-sm" data-testid="input-emp-title-after" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Phone className="w-3 h-3" />Telefóny</label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEmpPhones(prev => [...prev, ""])} data-testid="button-add-emp-phone">
                                <Plus className="w-3 h-3 mr-0.5" />Pridať
                              </Button>
                            </div>
                            {empPhones.map((ph, i) => (
                              <div key={i} className="flex gap-2">
                                <Input placeholder={`Telefón ${i + 1}`} value={ph} onChange={e => setEmpPhones(prev => prev.map((p, j) => j === i ? e.target.value : p))} className="text-sm" data-testid={`input-emp-phone-${i}`} />
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setEmpPhones(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-emp-phone-${i}`}><X className="w-3 h-3" /></Button>
                              </div>
                            ))}
                            {empPhones.length === 0 && <p className="text-xs text-muted-foreground">Žiadne telefóny</p>}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" />E-maily</label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEmpEmails(prev => [...prev, ""])} data-testid="button-add-emp-email">
                                <Plus className="w-3 h-3 mr-0.5" />Pridať
                              </Button>
                            </div>
                            {empEmails.map((em, i) => (
                              <div key={i} className="flex gap-2">
                                <Input placeholder={`E-mail ${i + 1}`} value={em} onChange={e => setEmpEmails(prev => prev.map((p, j) => j === i ? e.target.value : p))} className="text-sm" data-testid={`input-emp-email-${i}`} />
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setEmpEmails(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-emp-email-${i}`}><X className="w-3 h-3" /></Button>
                              </div>
                            ))}
                            {empEmails.length === 0 && <p className="text-xs text-muted-foreground">Žiadne e-maily</p>}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">História stavu</label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs"
                                onClick={() => setEmpStatusHistory(prev => [...prev, { status: "active", from: "", to: "" }])}
                                data-testid="button-add-status-entry"
                              ><Plus className="w-3 h-3 mr-0.5" />Pridať stav</Button>
                            </div>
                            {empStatusHistory.length === 0 && (
                              <p className="text-xs text-muted-foreground">Žiadna história stavu. Kliknite „Pridať stav".</p>
                            )}
                            <div className="space-y-2">
                              {empStatusHistory.map((entry, hi) => (
                                <div key={hi} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center" data-testid={`status-history-row-${hi}`}>
                                  <select
                                    value={entry.status}
                                    onChange={e => setEmpStatusHistory(prev => prev.map((h, j) => j === hi ? { ...h, status: e.target.value as StatusHistoryEntry["status"] } : h))}
                                    className="h-8 text-xs rounded border border-border bg-background px-2 text-foreground"
                                    data-testid={`select-status-${hi}`}
                                  >
                                    <option value="active">Aktívny</option>
                                    <option value="temporarily_inactive">Dočasne neaktívny</option>
                                    <option value="inactive">Neaktívny</option>
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">od</span>
                                    <Input type="date" value={entry.from || ""} onChange={e => setEmpStatusHistory(prev => prev.map((h, j) => j === hi ? { ...h, from: e.target.value } : h))} className="h-8 text-xs w-32" data-testid={`input-status-from-${hi}`} />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">do</span>
                                    <Input type="date" value={entry.to || ""} onChange={e => setEmpStatusHistory(prev => prev.map((h, j) => j === hi ? { ...h, to: e.target.value } : h))} className="h-8 text-xs w-32" placeholder="súčasnosť" data-testid={`input-status-to-${hi}`} />
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setEmpStatusHistory(prev => prev.filter((_, j) => j !== hi))} data-testid={`button-delete-status-${hi}`}><X className="w-3 h-3" /></Button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end pt-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingBranchEmployee(false); setEditingEmployeeIdx(null); setNewEmployee({ status: "active" }); setEmpPhones([]); setEmpEmails([]); setEmpStatusHistory([]); setEmpUidStatus("idle"); }} data-testid="button-employee-cancel">Zrušiť</Button>
                            <Button type="button" size="sm" onClick={saveEmployee} data-testid="button-employee-save">{editingEmployeeIdx !== null ? "Uložiť zmeny" : "Uložiť pracovníka"}</Button>
                          </div>
                        </div>
                      )}

                      {branchEmployees.length > 0 && (
                        <div className="space-y-2">
                          {branchEmployees.map((emp, i) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 border border-border rounded-md bg-muted/10" data-testid={`employee-row-${i}`}>
                              <div className="w-10 h-10 rounded shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center mt-0.5">
                                {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="foto" /> : <UserCog className="w-4 h-4 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {emp.uid && <span className="text-xs font-mono text-primary">{formatUid(emp.uid)}</span>}
                                  {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {[emp.titleBefore, emp.firstName, emp.lastName, emp.titleAfter].filter(Boolean).join(" ") || "—"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  {(emp.phones ?? []).map((ph, pi) => <span key={pi} className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{ph}</span>)}
                                  {(emp.emails ?? []).map((em, ei) => <span key={ei} className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{em}</span>)}
                                </div>
                                {(() => {
                                  const hist = emp.statusHistory ?? [];
                                  const curStatus = hist.length > 0 ? deriveCurrentStatus(hist) : (emp.status || "active");
                                  const curEntry = hist.find(e => !e.to) || hist[hist.length - 1];
                                  return (
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <Badge variant="outline" className={`text-[10px] ${curStatus === "active" ? "border-green-600 text-green-600" : curStatus === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                                        {curStatus === "active" ? "Aktívny" : curStatus === "temporarily_inactive" ? "Dočasne neaktívny" : "Neaktívny"}
                                      </Badge>
                                      {curEntry?.from && <span className="text-[10px] text-muted-foreground">od {curEntry.from}</span>}
                                      {hist.length > 1 && <span className="text-[10px] text-muted-foreground">({hist.length} záznamy)</span>}
                                    </div>
                                  );
                                })()}
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-0.5" onClick={() => openEditEmployee(i)} data-testid={`button-edit-employee-${i}`}><Pencil className="w-3 h-3" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive mt-0.5" onClick={() => setBranchEmployees(prev => prev.filter((_, j) => j !== i))} data-testid={`button-delete-employee-${i}`}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {branchEmployees.length === 0 && !addingBranchEmployee && (
                        <p className="text-xs text-muted-foreground text-center py-3">Žiadni pracovníci. Kliknite "Pridať pracovníka".</p>
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
                              <p className="text-muted-foreground text-xs">{[br.street, br.streetNumber, br.postalCode, br.city, br.stateId ? getStateName(br.stateId) : null].filter(Boolean).join(", ") || "Bez adresy"}</p>
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
                  companyIco={editingCompany?.ico}
                />
              </TabsContent>

              <TabsContent value="docs" className="mt-4 space-y-6">
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
                <Separator />
                <FileUploadSection
                  companyId={editingCompany?.id || null}
                  section="tax"
                  docs={taxDocs}
                  label="Sekcia C: Daňové dokumenty"
                  sublabel="Daňové priznania, výkazy DPH, potvrdenia správcu dane"
                />
              </TabsContent>

              <TabsContent value="logo" className="mt-4">
                {editingCompany ? (
                  <LogoUploadSection
                    companyId={editingCompany.id}
                    company={editingCompany}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Logo spoločnosti</label>
                      <p className="text-xs text-muted-foreground">Logo sa nahrá automaticky po prvom uložení spoločnosti</p>
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
                        <Button type="button" size="sm" variant="outline" onClick={() => logoFileRef.current?.click()} data-testid="button-select-logo">
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {pendingLogo ? "Zmeniť logo" : "Vybrať logo"}
                        </Button>
                        {pendingLogo && (
                          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setPendingLogo(null); setPendingLogoPreview(null); if (logoFileRef.current) logoFileRef.current.value = ""; }} data-testid="button-clear-logo">
                            <X className="w-3.5 h-3.5 mr-1" />Odstrániť
                          </Button>
                        )}
                      </div>
                      {pendingLogoPreview && (
                        <div className="flex items-center gap-3 p-2.5 border border-border rounded-md w-fit">
                          <img src={pendingLogoPreview} alt="Náhľad loga" className="h-12 w-12 object-contain rounded" data-testid="img-logo-preview" />
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{pendingLogo?.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-6">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charakteristika (Čím sa firma zaoberá)</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={4} data-testid="input-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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

          </form>
        </Form>
        <DialogFooter>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel">
              Zrušiť
            </Button>
            {editingCompany && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatProcessingTime(editingCompany.processingTimeSec || 0)}
              </span>
            )}
          </div>
          <Button type="submit" form="company-form" disabled={isPending} data-testid="button-save">
            {isPending ? "Ukladám..." : "Uložiť"}
          </Button>
        </DialogFooter>
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
  const taxDocs = (company.taxDocs as DocEntry[]) || [];

  const streetNum = (() => {
    if (company.streetNumber && company.orientNumber) return `${company.streetNumber}/${company.orientNumber}`;
    if (company.orientNumber) return company.orientNumber;
    if (company.streetNumber) return company.streetNumber;
    return null;
  })();
  const addressParts = [company.street, streetNum].filter(Boolean).join(" ");

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
            <TabsTrigger value="logo" data-testid="detail-tab-logo">Logo</TabsTrigger>
            <TabsTrigger value="notes" data-testid="detail-tab-notes">Poznámky</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-4 space-y-4">
            {company.uid && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 border border-border/50" data-testid="text-detail-company-uid-bar">
                <span className="text-xs text-muted-foreground shrink-0">UID</span>
                <span className="font-mono text-sm font-medium tracking-wide whitespace-nowrap select-all" data-testid="text-detail-company-uid">{formatUid(company.uid)}</span>
              </div>
            )}
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

            {(company.corrStreet || company.corrCity || (company as any).corrOrientNumber || (company as any).corrStateId) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Korespondenčná adresa</h4>
                  </div>
                  <div className="text-sm space-y-1 pl-1">
                    {(() => {
                      const csn = company.corrStreetNumber;
                      const con = (company as any).corrOrientNumber;
                      const corrNum = csn && con ? `${csn}/${con}` : con || csn || null;
                      return <p data-testid="text-detail-corr-address">{[company.corrStreet, corrNum].filter(Boolean).join(" ") || "-"}</p>;
                    })()}
                    <p className="text-muted-foreground" data-testid="text-detail-corr-city">
                      {[company.corrPostalCode, company.corrCity, (company as any).corrStateId ? getStateName((company as any).corrStateId) : null].filter(Boolean).join(" ") || "-"}
                    </p>
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
                          <p className="text-muted-foreground text-xs">{[br.street, br.streetNumber, br.postalCode, br.city, br.stateId ? getStateName(br.stateId) : null].filter(Boolean).join(", ") || "Bez adresy"}</p>
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
                                  <div key={ei} className="flex items-start gap-2.5 p-2 rounded border border-border/50 bg-muted/10" data-testid={`detail-branch-${idx}-emp-${ei}`}>
                                    <div className="w-9 h-9 rounded shrink-0 border border-border overflow-hidden bg-muted flex items-center justify-center mt-0.5">
                                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="foto" /> : <UserCog className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {emp.uid && <span className="text-[10px] font-mono text-primary">{formatUid(emp.uid)}</span>}
                                        {emp.position && <span className="text-[10px] text-muted-foreground">{emp.position}</span>}
                                      </div>
                                      <p className="text-xs font-medium truncate">
                                        {[emp.titleBefore, emp.firstName, emp.lastName, emp.titleAfter].filter(Boolean).join(" ") || "—"}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                        {(emp.phones ?? []).map((ph, pi) => <span key={pi} className="flex items-center gap-0.5"><Phone className="w-2 h-2" />{ph}</span>)}
                                        {(emp.emails ?? []).map((em, emi) => <span key={emi} className="flex items-center gap-0.5"><Mail className="w-2 h-2" />{em}</span>)}
                                      </div>
                                      {(() => {
                                        const hist = (emp as any).statusHistory as StatusHistoryEntry[] | undefined ?? [];
                                        const curStatus = hist.length > 0 ? deriveCurrentStatus(hist) : (emp.status || "active");
                                        return (
                                          <div className="mt-0.5 space-y-0.5">
                                            {hist.length > 0 ? hist.map((h, hi) => (
                                              <div key={hi} className="flex items-center gap-1 text-[10px] flex-wrap">
                                                <Badge variant="outline" className={`text-[10px] py-0 ${h.status === "active" ? "border-green-600 text-green-600" : h.status === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                                                  {h.status === "active" ? "Aktívny" : h.status === "temporarily_inactive" ? "Dočasne neaktívny" : "Neaktívny"}
                                                </Badge>
                                                {h.from && <span className="text-muted-foreground">od {h.from}</span>}
                                                {h.to ? <span className="text-muted-foreground">do {h.to}</span> : <span className="text-muted-foreground/60">– súčasnosť</span>}
                                              </div>
                                            )) : (
                                              <Badge variant="outline" className={`text-[10px] ${curStatus === "active" ? "border-green-600 text-green-600" : curStatus === "temporarily_inactive" ? "border-amber-500 text-amber-500" : "border-destructive text-destructive"}`}>
                                                {curStatus === "active" ? "Aktívny" : curStatus === "temporarily_inactive" ? "Dočasne neaktívny" : "Neaktívny"}
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
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
            <CompanyOfficersSection companyId={company.id} companyUid={company.uid} companyIco={company.ico} />
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia A: Oficiálne dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{officialDocs.length}</Badge>
              </div>
              {officialDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Žiadne oficiálne dokumenty</p>
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
                <h4 className="text-sm font-medium">Sekcia B: Pracovné dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{workDocs.length}</Badge>
              </div>
              {workDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Žiadne pracovné dokumenty</p>
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
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia C: Daňové dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{taxDocs.length}</Badge>
              </div>
              {taxDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Žiadne daňové dokumenty</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {taxDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border" data-testid={`detail-file-tax-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateSlovak(doc.uploadedAt)}</span>
                      <Button size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-detail-download-tax-${idx}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logo" className="mt-4">
            <LogoUploadSection
              companyId={company.id}
              company={company}
            />
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
                {columnVisibility.isVisible("uid") && <TableHead className="whitespace-nowrap">UID</TableHead>}
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
                  {columnVisibility.isVisible("name") && (
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {(() => {
                          const logo = (company.logos as any[])?.find((l: any) => l.isPrimary && !l.isArchived);
                          return logo?.url ? (
                            <div className="w-7 h-7 rounded border border-border bg-background flex-shrink-0 overflow-hidden flex items-center justify-center">
                              <img src={logo.url} alt="" className="w-full h-full object-contain" data-testid={`img-logo-${company.id}`} />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded border border-border/40 bg-muted/30 flex-shrink-0 flex items-center justify-center">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground/50" />
                            </div>
                          );
                        })()}
                        <span className="font-medium">{company.name}</span>
                      </div>
                    </TableCell>
                  )}
                  {columnVisibility.isVisible("uid") && <TableCell className="font-mono text-xs whitespace-nowrap">{company.uid ? formatUid(company.uid) : "-"}</TableCell>}
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

const OFFICER_TYPES = ["Konateľ", "Štatutár", "Predseda predstavenstva", "Člen predstavenstva", "Prokurista", "Predseda dozornej rady", "Člen dozornej rady", "Iné"];

function CompanyOfficersSection({ companyId, registryDirectors, companyUid, companyIco }: { companyId: number | null; registryDirectors?: RegistryDirector[]; companyUid?: string | null; companyIco?: string | null }) {
  const { toast } = useToastCompanyDiv();
  const { data: officerSectionStates } = useStates();
  const [localDirectors, setLocalDirectors] = useState<RegistryDirector[] | null>(null);
  const [fetchingRegistry, setFetchingRegistry] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ titleBefore: "", firstName: "", lastName: "", titleAfter: "", type: "Konateľ", city: "", rc: "" });
  const [pendingRegistryDir, setPendingRegistryDir] = useState<RegistryDirector | null>(null);
  const [rcInput, setRcInput] = useState("");
  const [pendingOfficerForRc, setPendingOfficerForRc] = useState<any | null>(null);
  const [rcOfficerInput, setRcOfficerInput] = useState("");
  const [editingOfficer, setEditingOfficer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    titleBefore: string; firstName: string; lastName: string; titleAfter: string;
    type: string; city: string; street: string; streetNumber: string; orientNumber: string; postalCode: string; stateId: string;
    share: string; validFrom: string; validTo: string; rc: string;
    idCardNumber: string; idCardExpiry: string;
    activeFrom: string; activeTo: string; inactiveFrom: string; inactiveTo: string;
    isOfficerActive: boolean;
  } | null>(null);

  const { data: officers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/my-companies', companyId, 'officers'],
    queryFn: async () => {
      const r = await fetch(`/api/my-companies/${companyId}/officers`);
      if (!r.ok) throw new Error(`Officers fetch failed: ${r.status}`);
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: editingOfficerMandatesRaw = [] } = useQuery<any[]>({
    queryKey: ['/api/company-officers', editingOfficer?.id, 'mandates'],
    queryFn: async () => {
      const r = await fetch(`/api/company-officers/${editingOfficer!.id}/mandates`);
      if (!r.ok) throw new Error(`Mandates fetch failed: ${r.status}`);
      return r.json();
    },
    enabled: !!editingOfficer?.id,
  });
  const editingOfficerMandates = Array.isArray(editingOfficerMandatesRaw) ? editingOfficerMandatesRaw : [];

  async function fetchFromRegistry() {
    if (!companyIco) return;
    setFetchingRegistry(true);
    try {
      const res = await fetch(`/api/lookup/ico/${companyIco.replace(/\s/g, '')}`);
      const data = await res.json();
      if (data?.directors?.length) {
        setLocalDirectors(data.directors);
        toast({ title: "Štatutári načítaní", description: `Načítaných ${data.directors.length} štatutárov z Obchodného registra.` });
      } else {
        setLocalDirectors([]);
        toast({ title: "Žiadni štatutári", description: "Obchodný register nevrátil žiadnych štatutárov pre toto IČO.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa načítať štatutárov z registra.", variant: "destructive" });
    } finally {
      setFetchingRegistry(false);
    }
  }

  const effectiveDirectors = registryDirectors ?? localDirectors ?? undefined;

  const registerMutation = useMutation({
    mutationFn: async ({ officerId, birthNumber }: { officerId: number; birthNumber: string }) => {
      const resp = await apiRequest("POST", `/api/company-officers/${officerId}/register-subject`, { birthNumber });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Chyba pri zápise");
      }
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      setPendingOfficerForRc(null);
      setRcOfficerInput("");
      if (data.alreadyRegistered) {
        toast({ title: "Štatutár je už zapísaný", description: `UID: ${formatUid(data.subject?.uid)}` });
      } else {
        toast({ title: "Štatutár zapísaný do systému", description: `UID: ${formatUid(data.uid || data.subject?.uid)}` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa zapísať štatutára", variant: "destructive" });
    },
  });

  const registerFromRegistryMutation = useMutation({
    mutationFn: async ({ dir, birthNumber }: { dir: RegistryDirector; birthNumber: string }) => {
      if (!companyId) throw new Error("Firma musí byť najprv uložená");
      const resp = await apiRequest("POST", "/api/company-officers/register-from-registry", {
        companyId,
        name: dir.name,
        role: dir.role || 'Štatutár',
        since: dir.since,
        titleBefore: dir.titleBefore,
        firstName: dir.firstName,
        lastName: dir.lastName,
        titleAfter: dir.titleAfter,
        birthNumber: birthNumber || undefined,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Chyba pri zápise z registra");
      }
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      setPendingRegistryDir(null);
      setRcInput("");
      if (data.alreadyExists) {
        toast({ title: "Štatutár už existuje v záznamoch" });
      } else if (data.noRc) {
        toast({ title: "Štatutár zapísaný bez RČ", description: "UID nebolo priradené — rodné číslo je povinné pre vznik UID.", variant: "destructive" });
      } else {
        toast({ title: "Štatutár zapísaný", description: `UID: ${formatUid(data.subject?.uid)}` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa zapísať štatutára z registra", variant: "destructive" });
    },
  });

  const createManualMutation = useMutation({
    mutationFn: async (data: typeof manualForm) => {
      if (!companyId) throw new Error("Firma musí byť najprv uložená");
      const resp = await apiRequest("POST", `/api/my-companies/${companyId}/officers`, {
        type: data.type,
        titleBefore: data.titleBefore || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        titleAfter: data.titleAfter || null,
        city: data.city || null,
        birthNumber: data.rc || null,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Chyba pri pridaní štatutára");
      }
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      const desc = data?.subject?.uid ? `UID: ${formatUid(data.subject.uid)}` : undefined;
      toast({ title: "Štatutár pridaný", description: desc });
      setShowManualForm(false);
      setManualForm({ titleBefore: "", firstName: "", lastName: "", titleAfter: "", type: "Konateľ", city: "", rc: "" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa pridať štatutára", variant: "destructive" }),
  });


  const updateOfficerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const resp = await apiRequest("PUT", `/api/company-officers/${id}`, data);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Chyba pri ukladaní");
      }
      return resp.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-companies', companyId, 'officers'] });
      if (editingOfficer?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/company-officers', editingOfficer.id, 'mandates'] });
      }
      setEditingOfficer(null);
      setEditForm(null);
      if (result?.subjectSynced) {
        toast({ title: "Štatutár aktualizovaný", description: `Zmeny boli synchronizované so subjektom ${result.firstName || ''} ${result.lastName || ''}`.trim() });
      } else {
        toast({ title: "Štatutár aktualizovaný" });
      }
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa uložiť štatutára", variant: "destructive" }),
  });

  async function openEditOfficer(off: any) {
    setEditingOfficer(off);
    setEditForm({
      titleBefore: off.titleBefore || "",
      firstName: off.firstName || "",
      lastName: off.lastName || "",
      titleAfter: off.titleAfter || "",
      type: off.type || "Konateľ",
      city: off.city || "",
      street: off.street || "",
      streetNumber: off.streetNumber || "",
      orientNumber: off.orientNumber || "",
      postalCode: off.postalCode || "",
      stateId: off.stateId ? String(off.stateId) : "none",
      share: off.share || "",
      validFrom: off.validFrom ? String(off.validFrom).substring(0, 10) : "",
      validTo: off.validTo ? String(off.validTo).substring(0, 10) : "",
      rc: "",
      idCardNumber: off.idCardNumber || "",
      idCardExpiry: off.idCardExpiry ? String(off.idCardExpiry).substring(0, 10) : "",
      activeFrom: off.activeFrom ? String(off.activeFrom).substring(0, 10) : "",
      activeTo: off.activeTo ? String(off.activeTo).substring(0, 10) : "",
      inactiveFrom: off.inactiveFrom ? String(off.inactiveFrom).substring(0, 10) : "",
      inactiveTo: off.inactiveTo ? String(off.inactiveTo).substring(0, 10) : "",
      isOfficerActive: !off.inactiveFrom,
    });
    if (off.subjectId) {
      try {
        const res = await fetch(`/api/company-officers/${off.id}/rc`);
        if (res.ok) {
          const data = await res.json();
          if (data.birthNumber) {
            setEditForm(prev => prev ? { ...prev, rc: data.birthNumber } : prev);
          }
        }
      } catch { /* ignorovať */ }
    }
  }

  const registeredNames = new Set(
    officers.map((off: any) =>
      `${(off.firstName || '').toLowerCase().trim()} ${(off.lastName || '').toLowerCase().trim()}`
    )
  );

  const unregisteredDirectors = (effectiveDirectors || []).filter(dir => {
    const parts = dir.name.trim().split(/\s+/);
    const titles = ['Ing.', 'Mgr.', 'JUDr.', 'MUDr.', 'RNDr.', 'PhDr.', 'PaedDr.', 'doc.', 'prof.', 'Bc.', 'MBA', 'PhD.', 'CSc.', 'DrSc.', 'RSDr.', 'MVDr.', 'Dr.'];
    const mainParts = parts.filter(p => !titles.some(t => p.replace(/,/g, '').toLowerCase() === t.toLowerCase()));
    const simpleName = mainParts.join(' ').toLowerCase().trim();
    return !registeredNames.has(simpleName);
  });

  if (!companyId) return (
    <div className="text-sm text-muted-foreground italic py-2">
      Najprv uložte základné údaje firmy — potom môžete pridávať štatutárov.
    </div>
  );
  if (isLoading) return (
    <div className="text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="w-3 h-3 animate-spin" />Načítavam štatutárov...
    </div>
  );

  return (
    <div className="space-y-4" data-testid="section-db-officers">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium shrink-0">
          <UserCheck className="w-3 h-3" />Štatutári{officers.length > 0 ? ` (${officers.length})` : ""}
        </p>
        <div className="flex items-center gap-2">
          {companyIco && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={fetchFromRegistry}
              disabled={fetchingRegistry}
              data-testid="button-fetch-officers-from-registry"
            >
              {fetchingRegistry ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Search className="w-3 h-3 mr-1" />
              )}
              Načítať z OR
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => setShowManualForm(v => !v)}
            data-testid="button-toggle-manual-officer-form"
          >
            {showManualForm ? <ChevronUp className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            {showManualForm ? "Zavrieť" : "Pridať manuálne"}
          </Button>
        </div>
      </div>

      {showManualForm && (
        <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20" data-testid="panel-manual-officer-form">
          <p className="text-xs font-medium text-muted-foreground">Nový štatutár – manuálny zápis</p>
          <div className="grid grid-cols-[80px_1fr_1fr_80px] gap-2">
            <Input
              placeholder="Titul pred"
              value={manualForm.titleBefore}
              onChange={e => setManualForm(f => ({ ...f, titleBefore: e.target.value }))}
              className="h-8 text-xs"
              data-testid="input-manual-title-before"
            />
            <Input
              placeholder="Meno *"
              value={manualForm.firstName}
              onChange={e => setManualForm(f => ({ ...f, firstName: e.target.value }))}
              className="h-8 text-xs"
              data-testid="input-manual-first-name"
            />
            <Input
              placeholder="Priezvisko *"
              value={manualForm.lastName}
              onChange={e => setManualForm(f => ({ ...f, lastName: e.target.value }))}
              className="h-8 text-xs"
              data-testid="input-manual-last-name"
            />
            <Input
              placeholder="Titul za"
              value={manualForm.titleAfter}
              onChange={e => setManualForm(f => ({ ...f, titleAfter: e.target.value }))}
              className="h-8 text-xs"
              data-testid="input-manual-title-after"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={manualForm.type}
              onValueChange={v => setManualForm(f => ({ ...f, type: v }))}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-manual-officer-type">
                <SelectValue placeholder="Funkcia" />
              </SelectTrigger>
              <SelectContent>
                {OFFICER_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Mesto (nepovinné)"
              value={manualForm.city}
              onChange={e => setManualForm(f => ({ ...f, city: e.target.value }))}
              className="h-8 text-xs"
              data-testid="input-manual-city"
            />
            <Input
              placeholder="Rodné číslo *"
              value={manualForm.rc}
              onChange={e => setManualForm(f => ({ ...f, rc: e.target.value }))}
              className="h-8 text-xs"
              inputMode="numeric"
              data-testid="input-manual-rc"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (!manualForm.firstName.trim() && !manualForm.lastName.trim()) {
                  toast({ title: "Chyba", description: "Zadajte aspoň meno alebo priezvisko", variant: "destructive" });
                  return;
                }
                createManualMutation.mutate(manualForm);
              }}
              disabled={createManualMutation.isPending}
              data-testid="button-save-manual-officer"
            >
              {createManualMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Uložiť štatutára
            </Button>
          </div>
        </div>
      )}

      {officers.length > 0 && (
        <div className="space-y-2">
          {officers.map((off: any) => (
            <div key={off.id} className="flex items-center gap-3 p-3 border border-border rounded-md text-sm" data-testid={`officer-db-${off.id}`}>
              <UserCheck className={`w-4 h-4 flex-shrink-0 ${off.inactiveFrom ? "text-red-500" : "text-green-500"}`} />
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
                  <Badge variant="secondary" className="font-mono text-[10px] whitespace-nowrap shrink-0" data-testid={`badge-uid-${off.id}`}>
                    {formatUid(off.subjectUid)}
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => { setPendingOfficerForRc(off); setRcOfficerInput(""); }}
                    data-testid={`button-register-officer-${off.id}`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Zapísať do systému
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 px-0"
                  onClick={() => openEditOfficer(off)}
                  data-testid={`button-edit-officer-${off.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
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
                  <span className="font-medium">
                    {(dir.titleBefore || dir.firstName || dir.lastName || dir.titleAfter)
                      ? [dir.titleBefore, dir.firstName, dir.lastName, dir.titleAfter].filter(Boolean).join(" ")
                      : dir.name}
                  </span>
                  {dir.role && <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">{dir.role}</Badge>}
                </div>
                {dir.since && <span className="text-xs text-muted-foreground">od: {dir.since}</span>}
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="text-xs h-7"
                onClick={() => { setPendingRegistryDir(dir); setRcInput(""); }}
                data-testid={`button-register-registry-${idx}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                Zapísať
              </Button>
            </div>
          ))}
        </div>
      )}

      {officers.length === 0 && unregisteredDirectors.length === 0 && (
        <div className="py-4 text-center" data-testid="text-no-officers">
          <p className="text-sm text-muted-foreground">
            Žiadni zapísaní štatutári.
            {!companyIco && (
              <span className="block text-xs mt-1">Pre načítanie z OR zadajte IČO v záložke „Základné údaje".</span>
            )}
          </p>
        </div>
      )}

      {/* Edit officer dialog */}
      <Dialog open={!!editingOfficer} onOpenChange={(open) => { if (!open) { setEditingOfficer(null); setEditForm(null); } }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-officer">
          <DialogHeader>
            <DialogTitle>Upraviť štatutára</DialogTitle>
            <DialogDescription>Rodné číslo sa ukladá zašifrované. Zmeny sa synchronizujú so subjektom v zozname klientov.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3 py-1 pr-1">

              {/* R1: UID + RC */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">UID</label>
                  <div className="h-8 flex items-center px-3 rounded border border-border bg-muted/30 text-xs font-mono text-muted-foreground whitespace-nowrap overflow-hidden">
                    {editingOfficer?.subjectUid ? formatUid(editingOfficer.subjectUid) : <span className="italic">bez UID</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Rodné číslo</label>
                  <Input className="h-8 text-sm" placeholder="napr. 800101/1234" value={editForm.rc} onChange={e => setEditForm(f => f ? { ...f, rc: e.target.value } : f)} data-testid="input-edit-officer-rc" inputMode="numeric" />
                </div>
              </div>

              {/* R2: Tituly + Meno + Priezvisko */}
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Titul pred</label>
                  <Input className="h-8 text-sm" placeholder="Ing." value={editForm.titleBefore} onChange={e => setEditForm(f => f ? { ...f, titleBefore: e.target.value } : f)} data-testid="input-edit-officer-titlebefore" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Meno</label>
                  <Input className="h-8 text-sm" value={editForm.firstName} onChange={e => setEditForm(f => f ? { ...f, firstName: e.target.value } : f)} data-testid="input-edit-officer-firstname" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Priezvisko</label>
                  <Input className="h-8 text-sm" value={editForm.lastName} onChange={e => setEditForm(f => f ? { ...f, lastName: e.target.value } : f)} data-testid="input-edit-officer-lastname" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Titul za</label>
                  <Input className="h-8 text-sm" placeholder="PhD." value={editForm.titleAfter} onChange={e => setEditForm(f => f ? { ...f, titleAfter: e.target.value } : f)} data-testid="input-edit-officer-titleafter" />
                </div>
              </div>

              {/* R3: Ulica 50% + Číslo popisné 25% + Číslo orientačné 25% */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Ulica</label>
                  <Input className="h-8 text-sm" value={editForm.street} onChange={e => setEditForm(f => f ? { ...f, street: e.target.value } : f)} data-testid="input-edit-officer-street" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Číslo popisné</label>
                  <Input className="h-8 text-sm" value={editForm.streetNumber} onChange={e => setEditForm(f => f ? { ...f, streetNumber: e.target.value } : f)} data-testid="input-edit-officer-streetnumber" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Číslo orientačné</label>
                  <Input className="h-8 text-sm" value={editForm.orientNumber} onChange={e => setEditForm(f => f ? { ...f, orientNumber: e.target.value } : f)} data-testid="input-edit-officer-orientnumber" />
                </div>
              </div>

              {/* R4: PSČ 20% + Mesto 40% + Štát 40% */}
              <div className="grid grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">PSČ</label>
                  <Input className="h-8 text-sm" value={editForm.postalCode} onChange={e => setEditForm(f => f ? { ...f, postalCode: e.target.value } : f)} data-testid="input-edit-officer-postalcode" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Mesto / obec</label>
                  <Input className="h-8 text-sm" value={editForm.city} onChange={e => setEditForm(f => f ? { ...f, city: e.target.value } : f)} data-testid="input-edit-officer-city" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Štát</label>
                  <Select value={editForm.stateId} onValueChange={val => setEditForm(f => f ? { ...f, stateId: val } : f)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-edit-officer-state">
                      <SelectValue placeholder="Vybrať" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {officerSectionStates?.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* R6: Číslo OP + Platnosť OP */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Číslo občianskeho preukazu</label>
                  <Input className="h-8 text-sm" placeholder="napr. AB123456" value={editForm.idCardNumber} onChange={e => setEditForm(f => f ? { ...f, idCardNumber: e.target.value } : f)} data-testid="input-edit-officer-idcardnumber" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Platnosť OP</label>
                  <Input type="date" className="h-8 text-sm" value={editForm.idCardExpiry} onChange={e => setEditForm(f => f ? { ...f, idCardExpiry: e.target.value } : f)} data-testid="input-edit-officer-idcardexpiry" />
                </div>
              </div>

              {/* R7: Funkcia + Obchodný podiel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Funkcia / typ</label>
                  <Input className="h-8 text-sm" placeholder="Konateľ" value={editForm.type} onChange={e => setEditForm(f => f ? { ...f, type: e.target.value } : f)} data-testid="input-edit-officer-type" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Obchodný podiel</label>
                  <Input className="h-8 text-sm" placeholder="napr. 50%" value={editForm.share} onChange={e => setEditForm(f => f ? { ...f, share: e.target.value } : f)} data-testid="input-edit-officer-share" />
                </div>
              </div>

              {/* R8: Platnosť od + Platnosť do */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Platnosť od</label>
                  <Input type="date" className="h-8 text-sm" value={editForm.validFrom} onChange={e => setEditForm(f => f ? { ...f, validFrom: e.target.value } : f)} data-testid="input-edit-officer-validfrom" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Platnosť do</label>
                  <Input type="date" className="h-8 text-sm" value={editForm.validTo} onChange={e => setEditForm(f => f ? { ...f, validTo: e.target.value } : f)} data-testid="input-edit-officer-validto" />
                </div>
              </div>

              {/* R9: Aktívny/Neaktívny prepínač + kondicionálne dátumy */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={editForm.isOfficerActive
                    ? "border-green-600 text-green-500 hover:bg-green-950/30 h-8 text-sm"
                    : "border-red-600 text-red-500 hover:bg-red-950/30 h-8 text-sm"}
                  onClick={() => setEditForm(f => f ? { ...f, isOfficerActive: !f.isOfficerActive } : f)}
                  data-testid="button-toggle-officer-active"
                >
                  {editForm.isOfficerActive ? "🟢 Aktívny" : "🔴 Neaktívny"}
                </Button>
                <div className={`grid gap-2 ${editForm.isOfficerActive ? "grid-cols-1 max-w-[200px]" : "grid-cols-2"}`}>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Aktívny od</label>
                    <Input type="date" className="h-8 text-sm" value={editForm.activeFrom} onChange={e => setEditForm(f => f ? { ...f, activeFrom: e.target.value } : f)} data-testid="input-edit-officer-activefrom" />
                  </div>
                  {!editForm.isOfficerActive && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Neaktívny od</label>
                      <Input type="date" className="h-8 text-sm" value={editForm.inactiveFrom} onChange={e => setEditForm(f => f ? { ...f, inactiveFrom: e.target.value } : f)} data-testid="input-edit-officer-inactivefrom" />
                    </div>
                  )}
                </div>
              </div>

              {/* R10: História mandátov */}
              <div className="space-y-1 pt-1 border-t border-border">
                <label className="text-xs text-muted-foreground font-medium">História mandátov</label>
                {editingOfficerMandates.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">Žiadna história</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {editingOfficerMandates.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1" data-testid={`mandate-history-${m.id}`}>
                        <span className="font-mono">
                          {m.validFrom ? formatDateSlovak(m.validFrom) : '?'} → {m.validTo ? formatDateSlovak(m.validTo) : 'doteraz'}
                        </span>
                        {m.endReason && <span className="text-amber-500 text-[10px]">({m.endReason})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setEditingOfficer(null); setEditForm(null); }} data-testid="button-edit-officer-cancel">
              Zrušiť
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editingOfficer || !editForm) return;
                updateOfficerMutation.mutate({
                  id: editingOfficer.id,
                  data: {
                    titleBefore: editForm.titleBefore || null,
                    firstName: editForm.firstName || null,
                    lastName: editForm.lastName || null,
                    titleAfter: editForm.titleAfter || null,
                    type: editForm.type || null,
                    city: editForm.city || null,
                    street: editForm.street || null,
                    streetNumber: editForm.streetNumber || null,
                    orientNumber: editForm.orientNumber || null,
                    postalCode: editForm.postalCode || null,
                    stateId: editForm.stateId && editForm.stateId !== "none" ? Number(editForm.stateId) : null,
                    share: editForm.share || null,
                    validFrom: editForm.validFrom || null,
                    validTo: editForm.validTo || null,
                    idCardNumber: editForm.idCardNumber || null,
                    idCardExpiry: editForm.idCardExpiry || null,
                    activeFrom: editForm.activeFrom || null,
                    activeTo: editForm.activeTo || null,
                    inactiveFrom: editForm.isOfficerActive ? null : (editForm.inactiveFrom || null),
                    inactiveTo: editForm.isOfficerActive ? null : (editForm.inactiveTo || null),
                    birthNumber: editForm.rc || undefined,
                  },
                });
              }}
              disabled={updateOfficerMutation.isPending}
              data-testid="button-edit-officer-save"
            >
              {updateOfficerMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RC Dialog for registry director */}
      <Dialog open={!!pendingRegistryDir} onOpenChange={(open) => { if (!open) { setPendingRegistryDir(null); setRcInput(""); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-rc-registry">
          <DialogHeader>
            <DialogTitle>Zapísať štatutára</DialogTitle>
            <DialogDescription>Rodné číslo je povinné — bez neho nie je možné priradiť UID.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm font-medium">
              {pendingRegistryDir?.name}
              {pendingRegistryDir?.role && (
                <span className="ml-2 text-xs text-muted-foreground">({pendingRegistryDir.role})</span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rodné číslo <span className="text-destructive">*</span></label>
              <Input
                placeholder="napr. 800101/1234"
                value={rcInput}
                onChange={e => setRcInput(e.target.value)}
                inputMode="numeric"
                autoFocus
                data-testid="input-rc-registry"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPendingRegistryDir(null); setRcInput(""); }}
              data-testid="button-rc-dialog-cancel"
            >
              Zrušiť
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingRegistryDir) return;
                registerFromRegistryMutation.mutate({ dir: pendingRegistryDir, birthNumber: rcInput });
              }}
              disabled={registerFromRegistryMutation.isPending || rcInput.replace(/[/\s]/g, '').length < 9}
              data-testid="button-rc-dialog-confirm"
            >
              {registerFromRegistryMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Zapísať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RC Dialog for manually added officers (Zapísať do systému) */}
      <Dialog open={!!pendingOfficerForRc} onOpenChange={(open) => { if (!open) { setPendingOfficerForRc(null); setRcOfficerInput(""); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-rc-officer">
          <DialogHeader>
            <DialogTitle>Zapísať do systému</DialogTitle>
            <DialogDescription>Rodné číslo je povinné — bez neho nie je možné priradiť UID.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm font-medium">
              {[pendingOfficerForRc?.titleBefore, pendingOfficerForRc?.firstName, pendingOfficerForRc?.lastName, pendingOfficerForRc?.titleAfter].filter(Boolean).join(' ')}
              {pendingOfficerForRc?.type && (
                <span className="ml-2 text-xs text-muted-foreground">({pendingOfficerForRc.type})</span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rodné číslo <span className="text-destructive">*</span></label>
              <Input
                placeholder="napr. 800101/1234"
                value={rcOfficerInput}
                onChange={e => setRcOfficerInput(e.target.value)}
                inputMode="numeric"
                autoFocus
                data-testid="input-rc-officer"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPendingOfficerForRc(null); setRcOfficerInput(""); }}
              data-testid="button-rc-officer-cancel"
            >
              Zrušiť
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingOfficerForRc) return;
                registerMutation.mutate({ officerId: pendingOfficerForRc.id, birthNumber: rcOfficerInput });
              }}
              disabled={registerMutation.isPending || rcOfficerInput.replace(/[/\s]/g, '').length < 9}
              data-testid="button-rc-officer-confirm"
            >
              {registerMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Zapísať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
