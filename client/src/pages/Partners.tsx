import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner, usePartnerContacts, usePartnerProducts, useCreatePartnerContact, useCreatePartnerProduct, useUpdatePartnerLifecycleStatus } from "@/hooks/use-partners";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { PhoneInput } from "@/components/phone-input";
import { formatDateSlovak, formatPhone, formatUid, canCreateRecords, canEditRecords, canDeleteRecords } from "@/lib/utils";
import {
  Plus, Briefcase, Pencil, Trash2, Clock, Users, Package, Calendar, Archive, MapPin, Circle,
  FastForward, Play, Pause, Upload, Square, FileText, X, Download, Image, Loader2, GitBranch,
  Phone, Mail, Camera, UserCog, UserPlus, Search, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { PartnerContract, DocEntry } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { insertPartnerSchema } from "@shared/schema";
import type { Partner, InsertPartner } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  status: "active" | "temporarily_inactive" | "inactive";
  from: string;
  to: string;
}

interface BranchEmployee {
  uid?: string;
  photo?: string;
  titleBefore?: string;
  firstName?: string;
  lastName?: string;
  titleAfter?: string;
  position?: string;
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
  orientNumber?: string;
  postalCode?: string;
  city?: string;
  stateId?: number;
  phone?: string;
  email?: string;
  phones?: string[];
  emails?: string[];
  isActive?: boolean;
  branchStatus?: string;
  activeFrom?: string;
  cancelledAt?: string;
  employees?: BranchEmployee[];
}

interface BusinessActivity {
  text: string;
  since?: string;
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
  businessActivities?: BusinessActivity[];
  directors?: any[];
  actingNote?: string;
  message?: string;
  error?: string;
}

// ─── Lifecycle Status Config ──────────────────────────────────────────────────

const LIFECYCLE_STATUS_CONFIG: Record<string, { label: string; Icon: typeof Circle; colorClass: string; filled?: boolean }> = {
  record: { label: "Príprava spolupráce s obchodným partnerom", Icon: Circle, colorClass: "text-gray-400", filled: true },
  fast_forward: { label: "Štart spolupráce – zmluva podpísaná", Icon: FastForward, colorClass: "text-blue-500" },
  play: { label: "Aktívna spolupráca", Icon: Play, colorClass: "text-emerald-500", filled: true },
  pause: { label: "Pozastavená spolupráca", Icon: Pause, colorClass: "text-yellow-500" },
  eject: { label: "Výpoveď zmluvy s obchodným partnerom", Icon: Upload, colorClass: "text-orange-500" },
  stop: { label: "Ukončená spolupráca s obchodným partnerom", Icon: Square, colorClass: "text-red-500", filled: true },
};

function LifecycleStatusIcon({ status }: { status: string | null | undefined }) {
  const config = LIFECYCLE_STATUS_CONFIG[status || "record"] || LIFECYCLE_STATUS_CONFIG.record;
  const IconComp = config.Icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" data-testid={`status-lifecycle-${status || "record"}`}>
          <IconComp className={`w-5 h-5 ${config.colorClass}`} fill={config.filled ? "currentColor" : "none"} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Table Config ────────────────────────────────────────────────────────────

const PARTNER_COLUMNS: ColumnDef[] = [
  { key: "uid", label: "UID" },
  { key: "name", label: "Nazov" },
  { key: "code", label: "Kod" },
  { key: "specialization", label: "Zameranie" },
  { key: "ico", label: "ICO" },
  { key: "city", label: "Mesto" },
  { key: "collaborationDate", label: "Datum spoluprace" },
];

const PARTNER_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "uid", label: "UID", type: "text" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "code", label: "Kod", type: "text" },
  { key: "specialization", label: "Zameranie", type: "text" },
  { key: "ico", label: "ICO", type: "text" },
  { key: "city", label: "Mesto", type: "text" },
  { key: "collaborationDate", label: "Datum spoluprace", type: "date" },
];

// ─── Form Schema ─────────────────────────────────────────────────────────────

const partnerFormSchema = insertPartnerSchema.extend({
  name: z.string().min(1, "Názov je povinný"),
  subjectType: z.string().optional(),
  ico: z.string().optional().nullable(),
  dic: z.string().optional().nullable(),
  icDph: z.string().optional().nullable(),
  vatParagraph: z.string().optional().nullable(),
  vatRegisteredAt: z.string().nullable().optional(),
  foundedDate: z.string().nullable().optional(),
  collaborationDate: z.string().optional().nullable(),
  corrStreet: z.string().optional().nullable(),
  corrStreetNumber: z.string().optional().nullable(),
  corrOrientNumber: z.string().optional().nullable(),
  corrPostalCode: z.string().optional().nullable(),
  corrCity: z.string().optional().nullable(),
  corrStateId: z.number().optional().nullable(),
});

type PartnerFormData = z.infer<typeof partnerFormSchema>;

// ─── Partner Logo Section ────────────────────────────────────────────────────

function PartnerLogoSection({ partnerId, partner }: { partnerId: number | null; partner: Partner | null }) {
  const [uploading, setUploading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const primaryLogo = (partner?.logos as any[])?.find((l: any) => l.isPrimary && !l.isArchived) || null;
  const allLogos: any[] = (partner?.logos as any[]) || [];
  const activeLogos = allLogos.filter((l: any) => !l.isArchived);
  const archivedLogos = allLogos.filter((l: any) => l.isArchived);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/partners/${partnerId}/files/logos`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      qc.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Logo nahrané", description: `${file.name} je teraz aktívne logo.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrať logo.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleArchive() {
    if (!partnerId || !primaryLogo) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/partners/${partnerId}/logos/archive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: primaryLogo.url }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Archive failed");
      qc.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Logo archivované", description: "Primárne logo bolo archivované." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa archivovať logo.", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  }

  async function handleSetPrimary(logoUrl: string) {
    if (!partnerId) return;
    setSettingPrimary(logoUrl);
    try {
      const res = await fetch(`/api/partners/${partnerId}/logos/set-primary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Set primary failed");
      qc.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Logo nastavené", description: "Vybrané logo je teraz primárne." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nastaviť logo.", variant: "destructive" });
    } finally {
      setSettingPrimary(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Logo partnera</h4>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} data-testid="input-logo-upload" />
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="button-upload-logo">
            <Image className="w-4 h-4 mr-2" />
            {uploading ? "Nahrávam..." : "Nahrať logo"}
          </Button>
        </div>
      </div>

      {!partnerId && (
        <div className="p-8 border-2 border-dashed border-border rounded-lg text-center text-sm text-muted-foreground" data-testid="text-save-first-logo">
          Najprv uložte partnera, potom môžete nahrať logo.
        </div>
      )}

      {partnerId && primaryLogo ? (
        <div className="flex flex-col items-center gap-3 p-5 border-2 border-primary/40 rounded-lg bg-primary/5" data-testid="div-primary-logo">
          <div className="w-40 h-28 flex items-center justify-center">
            <img src={primaryLogo.url} alt="Aktívne logo" className="w-full h-full object-contain" />
          </div>
          <Badge variant="outline" className="border-green-600 text-green-600 text-[10px]">Aktívne logo</Badge>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => window.open(primaryLogo.url, "_blank")} data-testid="button-view-primary-logo">
              <Download className="w-3 h-3" />Zobraziť
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleArchive} disabled={archiving} data-testid="button-archive-logo">
              <Archive className="w-3 h-3" />{archiving ? "Archivujem..." : "Archivovať"}
            </Button>
          </div>
        </div>
      ) : partnerId ? (
        <div className="p-8 border-2 border-dashed border-border rounded-lg text-center text-sm text-muted-foreground" data-testid="text-no-logo">
          Žiadne aktívne logo
        </div>
      ) : null}

      {activeLogos.filter((l: any) => !l.isPrimary).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ďalšie aktívne logá</p>
          <div className="flex flex-wrap gap-3">
            {activeLogos.filter((l: any) => !l.isPrimary).map((logo: any, i: number) => (
              <div key={i} className="group relative flex flex-col items-center gap-1.5 p-2 border border-border rounded-md bg-muted/10 hover:border-primary/40 transition-colors" data-testid={`logo-active-${i}`}>
                <div className="w-20 h-14">
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Archivované logá</p>
          <div className="flex flex-wrap gap-3">
            {archivedLogos.map((logo: any, i: number) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-2 border border-border/50 rounded-md bg-muted/5 opacity-60" data-testid={`logo-archived-${i}`}>
                <div className="w-20 h-14">
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

// ─── Partner File Section ────────────────────────────────────────────────────

function PartnerFileSection({
  partnerId,
  section,
  docs,
  label,
  sublabel,
}: {
  partnerId: number | null;
  section: "official" | "work" | "tax";
  docs: DocEntry[];
  label: string;
  sublabel: string;
}) {
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/partners/${partnerId}/files/${section}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      qc.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Súbor nahraný", description: `${file.name} bol úspešne nahraný.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrať súbor.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileUrl: string, fileName: string) {
    if (!partnerId) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/files/${section}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      qc.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Súbor vymazaný", description: `${fileName} bol odstránený.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa vymazať súbor.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-medium">{label}</h4>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        {partnerId && (
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} data-testid={`input-file-${section}`} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()} data-testid={`button-upload-${section}`}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahrávam..." : "Nahrať súbor"}
            </Button>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground" data-testid={`text-no-files-${section}`}>
          {partnerId ? "Žiadne súbory. Kliknite na 'Nahrať súbor'." : "Najprv uložte partnera, potom môžete nahrávať súbory."}
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border" data-testid={`file-entry-${section}-${idx}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{doc.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatDateSlovak(doc.uploadedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-download-${section}-${idx}`}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(doc.url, doc.name)} data-testid={`button-delete-file-${section}-${idx}`}>
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Partner Unified Dialog ──────────────────────────────────────────────────

function PartnerUnifiedDialog({
  open,
  onOpenChange,
  partnerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number | null;
}) {
  const { toast } = useToast();
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const lifecycleMutation = useUpdatePartnerLifecycleStatus();
  const { data: allPartners } = usePartners();
  const { data: appUser } = useAppUser();
  const { data: allStates } = useStates();
  const { data: myCompanies } = useMyCompanies();
  const timerRef = useRef<number>(0);
  const registryLookupBtnRef = useRef<HTMLButtonElement>(null);
  const isSubmittingRef = useRef(false);

  // Core state
  const [notesHtml, setNotesHtml] = useState("");
  const [activeTab, setActiveTab] = useState("basic");
  const [lifecycleStatus, setLifecycleStatus] = useState("record");
  const [statusStartDate, setStatusStartDate] = useState("");
  const [statusEndDate, setStatusEndDate] = useState("");

  // DPH
  const [platcaDph, setPlatcaDph] = useState(false);

  // ORSR registry
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryResult, setRegistryResult] = useState<RegistryLookupResponse | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [selectedActivityIndices, setSelectedActivityIndices] = useState<Set<number>>(new Set());

  // Pending logo for new partner
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Business activities
  const [localActivities, setLocalActivities] = useState<BusinessActivity[]>([]);
  const [newActivityText, setNewActivityText] = useState("");
  const [newActivitySince, setNewActivitySince] = useState("");

  // Correspondence address
  const [corrSameAsHQ, setCorrSameAsHQ] = useState(false);

  // Branches
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

  const editingPartner = partnerId
    ? allPartners?.find(p => p.id === partnerId) || null
    : null;

  const isEditing = !!editingPartner;

  const { data: pContacts } = usePartnerContacts(isEditing ? partnerId : null);
  const { data: pProducts } = usePartnerProducts(isEditing ? partnerId : null);
  const createContact = useCreatePartnerContact();
  const createProduct = useCreatePartnerProduct();

  // Contact state
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactPosition, setNewContactPosition] = useState("");
  const [newContactValidFrom, setNewContactValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [newContactValidTo, setNewContactValidTo] = useState("");
  const [showArchivedContacts, setShowArchivedContacts] = useState(false);

  // Product state
  const [newProductName, setNewProductName] = useState("");
  const [newProductType, setNewProductType] = useState("Financny");
  const [newProductCode, setNewProductCode] = useState("");

  // Contract state
  const [newContractNumber, setNewContractNumber] = useState("");
  const [newContractSignedDate, setNewContractSignedDate] = useState("");

  const { data: pContracts } = useQuery<PartnerContract[]>({
    queryKey: ["/api/partners", partnerId, "contracts"],
    queryFn: async () => {
      if (!partnerId) return [];
      const res = await fetch(`/api/partners/${partnerId}/contracts`, { credentials: "include" });
      if (!res.ok) throw new Error("Chyba pri nacitani zmluv");
      return res.json();
    },
    enabled: isEditing && !!partnerId,
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: { partnerId: number; companyId: number; contractNumber?: string; signedDate?: string }) => {
      return apiRequest("POST", `/api/partners/${data.partnerId}/contracts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "contracts"] });
      setNewContractNumber("");
      setNewContractSignedDate("");
      toast({ title: "Zmluva pridaná" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return apiRequest("DELETE", `/api/partner-contracts/${contractId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "contracts"] });
      toast({ title: "Zmluva vymazaná" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      name: "",
      code: "",
      subjectType: "",
      specialization: "",
      ico: "",
      dic: "",
      icDph: "",
      vatParagraph: "",
      vatRegisteredAt: null,
      foundedDate: null,
      street: "",
      streetNumber: "",
      orientNumber: "",
      postalCode: "",
      city: "",
      stateId: undefined,
      description: "",
      notes: "",
      collaborationDate: undefined,
      corrStreet: "",
      corrStreetNumber: "",
      corrOrientNumber: "",
      corrPostalCode: "",
      corrCity: "",
      corrStateId: undefined,
    },
  });

  const watchedSubjectType = form.watch("subjectType");

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      setRegistryResult(null);
      setRegistryError(null);
      setPendingLogo(null);
      setPendingLogoPreview(null);
      if (editingPartner) {
        const ep = editingPartner as any;
        const hasCorrAddr = !!(ep.corrStreet || ep.corrStreetNumber || ep.corrOrientNumber || ep.corrPostalCode || ep.corrCity || ep.corrStateId);
        setCorrSameAsHQ(!hasCorrAddr);
        setLocalActivities((ep.businessActivities as BusinessActivity[]) || []);
        setBranches((ep.branches as BranchEntry[]) || []);
        setPlatcaDph(!!(ep.icDph && ep.icDph.trim()));
        form.reset({
          name: editingPartner.name,
          code: editingPartner.code || "",
          subjectType: ep.subjectType || "",
          specialization: editingPartner.specialization || "",
          ico: editingPartner.ico || "",
          dic: editingPartner.dic || "",
          icDph: editingPartner.icDph || "",
          vatParagraph: ep.vatParagraph || "",
          vatRegisteredAt: ep.vatRegisteredAt ? new Date(ep.vatRegisteredAt).toISOString().split("T")[0] : null,
          foundedDate: ep.foundedDate ? new Date(ep.foundedDate).toISOString().split("T")[0] : null,
          street: editingPartner.street || "",
          streetNumber: editingPartner.streetNumber || "",
          orientNumber: editingPartner.orientNumber || "",
          postalCode: editingPartner.postalCode || "",
          city: editingPartner.city || "",
          stateId: editingPartner.stateId || undefined,
          description: editingPartner.description || "",
          notes: editingPartner.notes || "",
          collaborationDate: editingPartner.collaborationDate ? new Date(editingPartner.collaborationDate).toISOString().split("T")[0] : "",
          corrStreet: ep.corrStreet || "",
          corrStreetNumber: ep.corrStreetNumber || "",
          corrOrientNumber: ep.corrOrientNumber || "",
          corrPostalCode: ep.corrPostalCode || "",
          corrCity: ep.corrCity || "",
          corrStateId: ep.corrStateId || undefined,
        });
        setNotesHtml(editingPartner.notes || "");
        setLifecycleStatus(editingPartner.lifecycleStatus || "record");
        setStatusStartDate(editingPartner.statusStartDate ? new Date(editingPartner.statusStartDate).toISOString().split("T")[0] : "");
        setStatusEndDate(editingPartner.statusEndDate ? new Date(editingPartner.statusEndDate).toISOString().split("T")[0] : "");
        // Auto-load ORSR if IČO and type is PO
        if (ep.ico?.trim() && ep.subjectType === "po") {
          setRegistryLoading(true);
          fetch(`/api/lookup/ico/${encodeURIComponent(ep.ico.trim())}?type=company`, { credentials: "include" })
            .then(r => r.json())
            .then(data => {
              if (data.found && data.businessActivities?.length) {
                setRegistryResult(data);
                setSelectedActivityIndices(new Set(data.businessActivities.map((_: BusinessActivity, i: number) => i)));
              }
            })
            .catch(() => {})
            .finally(() => setRegistryLoading(false));
        }
      } else {
        setCorrSameAsHQ(true);
        setLocalActivities([]);
        setBranches([]);
        setPlatcaDph(false);
        form.reset({
          name: "",
          code: "",
          subjectType: "",
          specialization: "",
          ico: "",
          dic: "",
          icDph: "",
          vatParagraph: "",
          vatRegisteredAt: null,
          foundedDate: null,
          street: "",
          streetNumber: "",
          orientNumber: "",
          postalCode: "",
          city: "",
          stateId: appUser?.activeStateId || undefined,
          description: "",
          notes: "",
          collaborationDate: undefined,
          corrStreet: "",
          corrStreetNumber: "",
          corrOrientNumber: "",
          corrPostalCode: "",
          corrCity: "",
          corrStateId: undefined,
        });
        setNotesHtml("");
        setLifecycleStatus("record");
        setStatusStartDate("");
        setStatusEndDate("");
      }
      setNewContactFirst("");
      setNewContactLast("");
      setNewContactEmail("");
      setNewContactPhone("");
      setNewContactPosition("");
      setNewContactValidFrom(new Date().toISOString().split("T")[0]);
      setNewContactValidTo("");
      setShowArchivedContacts(false);
      setNewProductName("");
      setNewProductCode("");
      setNewContractNumber("");
      setNewContractSignedDate("");
      setNewActivityText("");
      setNewActivitySince("");
      setAddingBranch(false);
      setEditingBranchIdx(null);
      setNewBranch({});
      setBranchPhones([]);
      setBranchEmails([]);
      setBranchEmployees([]);
      setAddingBranchEmployee(false);
      setSelectedActivityIndices(new Set());
      setActiveTab("basic");
    }
  }, [open, editingPartner, form, appUser?.activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setPendingLogo(null);
      setPendingLogoPreview(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  // ─── ORSR Registry Lookup ──────────────────────────────────────────────────

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
        setLocalActivities(prev => {
          const existing = new Set(prev.map((a: BusinessActivity) => a.text.trim()));
          const newOnes = (data.businessActivities as BusinessActivity[]).filter((a: BusinessActivity) => !existing.has(a.text.trim()));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
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
      if (data.foundedDate) form.setValue("foundedDate", data.foundedDate);
      if (data.icDph) {
        form.setValue("icDph", data.icDph);
        setPlatcaDph(true);
      }
      if (data.vatParagraph) form.setValue("vatParagraph", data.vatParagraph);
      if (data.vatRegisteredAt) form.setValue("vatRegisteredAt", data.vatRegisteredAt);
    } catch {
      setRegistryError("Chyba pri komunikácii s registrom");
    } finally {
      setRegistryLoading(false);
    }
  }

  // ─── Branch helpers ────────────────────────────────────────────────────────

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

  async function lookupEmployeeByUid() {
    const uid = newEmployee.uid?.trim();
    if (!uid) return;
    setEmpUidStatus("loading");
    try {
      const res = await fetch(`/api/subjects/by-uid/${encodeURIComponent(uid)}`, { credentials: "include" });
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

  // ─── Submit ────────────────────────────────────────────────────────────────

  function onSubmit(data: PartnerFormData) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const { collaborationDate, vatRegisteredAt, foundedDate, ...rest } = data;
    const payload: any = {
      ...rest,
      notes: notesHtml,
      processingTimeSec,
      collaborationDate: collaborationDate ? new Date(collaborationDate) : null,
      vatRegisteredAt: vatRegisteredAt ? new Date(vatRegisteredAt) : null,
      foundedDate: foundedDate ? new Date(foundedDate) : null,
      businessActivities: localActivities,
      branches,
      corrStreet: corrSameAsHQ ? null : (data.corrStreet || null),
      corrStreetNumber: corrSameAsHQ ? null : (data.corrStreetNumber || null),
      corrOrientNumber: corrSameAsHQ ? null : (data.corrOrientNumber || null),
      corrPostalCode: corrSameAsHQ ? null : (data.corrPostalCode || null),
      corrCity: corrSameAsHQ ? null : (data.corrCity || null),
      corrStateId: corrSameAsHQ ? null : (data.corrStateId || null),
    };

    if (!platcaDph) {
      payload.icDph = null;
      payload.vatParagraph = null;
      payload.vatRegisteredAt = null;
    }

    if (lifecycleStatus === "fast_forward" && !statusStartDate) {
      isSubmittingRef.current = false;
      toast({ title: "Chyba", description: "Stav 'Štart spolupráce' vyžaduje dátum štartu", variant: "destructive" });
      return;
    }
    if (lifecycleStatus === "eject" && !statusEndDate) {
      isSubmittingRef.current = false;
      toast({ title: "Chyba", description: "Stav 'Výpoveď zmluvy' vyžaduje dátum ukončenia", variant: "destructive" });
      return;
    }

    if (editingPartner) {
      const oldStatus = editingPartner.lifecycleStatus || "record";
      const statusChanged = lifecycleStatus !== oldStatus
        || (lifecycleStatus === "fast_forward" && statusStartDate !== (editingPartner.statusStartDate ? new Date(editingPartner.statusStartDate).toISOString().split("T")[0] : ""))
        || (lifecycleStatus === "eject" && statusEndDate !== (editingPartner.statusEndDate ? new Date(editingPartner.statusEndDate).toISOString().split("T")[0] : ""));
      updateMutation.mutate(
        { id: editingPartner.id, data: { ...payload, changeReason: "User edit" } },
        {
          onSuccess: () => {
            if (statusChanged) {
              const statusData: { status: string; startDate?: string; endDate?: string } = { status: lifecycleStatus };
              if (lifecycleStatus === "fast_forward" && statusStartDate) statusData.startDate = new Date(statusStartDate).toISOString();
              if (lifecycleStatus === "eject" && statusEndDate) statusData.endDate = new Date(statusEndDate).toISOString();
              lifecycleMutation.mutate({ id: editingPartner.id, data: statusData }, {
                onSuccess: () => { isSubmittingRef.current = false; handleOpenChange(false); },
                onError: () => { isSubmittingRef.current = false; toast({ title: "Chyba", description: "Nepodarilo sa zmeniť stav", variant: "destructive" }); },
              });
            } else {
              isSubmittingRef.current = false;
              handleOpenChange(false);
            }
          },
          onError: () => { isSubmittingRef.current = false; },
        }
      );
    } else {
      createMutation.mutate(payload as InsertPartner, {
        onSuccess: async (newPartner: any) => {
          isSubmittingRef.current = false;
          if (pendingLogo && newPartner?.id) {
            try {
              const fd = new FormData();
              fd.append("file", pendingLogo);
              await fetch(`/api/partners/${newPartner.id}/files/logos`, {
                method: "POST",
                body: fd,
                credentials: "include",
              });
            } catch {}
          }
          handleOpenChange(false);
        },
        onError: () => { isSubmittingRef.current = false; },
      });
    }
  }

  function handleAddContact() {
    if (!newContactFirst || !newContactLast || !partnerId) return;
    const contactData: any = {
      firstName: newContactFirst, lastName: newContactLast, email: newContactEmail,
      phone: newContactPhone, position: newContactPosition, partnerId,
      validFrom: newContactValidFrom ? new Date(newContactValidFrom).toISOString() : new Date().toISOString(),
    };
    if (newContactValidTo) contactData.validTo = new Date(newContactValidTo).toISOString();
    createContact.mutate({ partnerId, data: contactData });
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactPosition("");
    setNewContactValidFrom(new Date().toISOString().split("T")[0]);
    setNewContactValidTo("");
  }

  function handleAddProduct() {
    if (!newProductName || !partnerId) return;
    createProduct.mutate({
      partnerId,
      data: { name: newProductName, productType: newProductType, code: newProductCode, partnerId },
    });
    setNewProductName("");
    setNewProductCode("");
  }

  function handleAddContract() {
    if (!appUser?.activeCompanyId) {
      toast({ title: "Chyba", description: "Nemáš aktívnu spoločnosť", variant: "destructive" });
      return;
    }
    if (!partnerId) return;
    createContractMutation.mutate({
      partnerId,
      companyId: appUser.activeCompanyId,
      contractNumber: newContractNumber || undefined,
      signedDate: newContractSignedDate || undefined,
    });
  }

  const isPending = createMutation.isPending || updateMutation.isPending || lifecycleMutation.isPending;

  const officialDocs = ((editingPartner as any)?.officialDocs as DocEntry[]) || [];
  const workDocs = ((editingPartner as any)?.workDocs as DocEntry[]) || [];
  const taxDocs = ((editingPartner as any)?.taxDocs as DocEntry[]) || [];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle data-testid="text-partner-dialog-title">
            {editingPartner ? editingPartner.name : "Pridať nového partnera"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
              <TabsList className="flex flex-wrap h-auto gap-1 w-full">
                <TabsTrigger value="basic" data-testid="partner-tab-basic">Základné údaje</TabsTrigger>
                <TabsTrigger value="address" data-testid="partner-tab-address">Adresa</TabsTrigger>
                <TabsTrigger value="activities" data-testid="partner-tab-activities">Predmet podnikania</TabsTrigger>
                <TabsTrigger value="branches" data-testid="partner-tab-branches">Pobočky</TabsTrigger>
                <TabsTrigger value="docs" data-testid="partner-tab-docs">Dokumenty</TabsTrigger>
                <TabsTrigger value="logo" data-testid="partner-tab-logo">Logo</TabsTrigger>
                {isEditing && <TabsTrigger value="contacts" data-testid="partner-tab-contacts">Kontakty</TabsTrigger>}
                {isEditing && <TabsTrigger value="products" data-testid="partner-tab-products">Produkty</TabsTrigger>}
                {isEditing && <TabsTrigger value="zmluvy" data-testid="partner-tab-zmluvy">Zmluvy</TabsTrigger>}
                <TabsTrigger value="notes" data-testid="partner-tab-notes">Poznámky</TabsTrigger>
              </TabsList>

              {/* ─── Základné údaje ─────────────────────────────────────── */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                {editingPartner?.uid && (
                  <div className="flex items-center gap-2 px-1 py-1.5 rounded-md bg-muted/40 border border-border/50">
                    <span className="text-xs text-muted-foreground shrink-0">UID</span>
                    <span className="font-mono text-sm font-medium tracking-wide whitespace-nowrap select-all" data-testid="input-partner-uid">{formatUid(editingPartner.uid)}</span>
                  </div>
                )}

                {/* Name + Code v jednom riadku — rovnako ako Companies.tsx */}
                <div className="flex gap-3 items-end">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="flex-[5]">
                      <FormLabel>Názov partnera *</FormLabel>
                      <FormControl><Input {...field} data-testid="input-partner-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem className="flex-[2]">
                      <FormLabel>Kód partnera</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} maxLength={25} className="font-mono uppercase" data-testid="input-partner-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Typ subjektu — rovnako ako Companies.tsx */}
                <FormField control={form.control} name="subjectType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ subjektu</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-partner-subject-type">
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

                {/* IČO s ORSR vyhľadávaním (len pri type=po) | DIČ s "povinné" badge */}
                <div className="flex items-start gap-3">
                  <div className="w-[60%] space-y-2">
                    <FormField control={form.control} name="ico" render={({ field }) => (
                      <FormItem>
                        <FormLabel>IČO</FormLabel>
                        <FormControl>
                          <div className={`relative rounded-md transition-all duration-200 ${registryResult && !registryError ? "ring-2 ring-green-600 ring-offset-0" : ""}`}>
                            <Input
                              {...field}
                              value={field.value || ""}
                              data-testid="input-partner-ico"
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
                    {watchedSubjectType === "po" && registryError && (
                      <div className="flex items-center gap-1 text-xs text-destructive" data-testid="text-registry-error">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{registryError}</span>
                      </div>
                    )}
                  </div>
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem className="w-[40%] flex-shrink-0">
                      <FormLabel>DIČ *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} value={field.value || ""} className="pr-[72px]" data-testid="input-partner-dic" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/30 pointer-events-none select-none" data-testid="badge-dic-required">
                            povinné
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Platca DPH switch */}
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

                {/* IČ DPH, Paragraf, Dátum registrácie DPH — len keď platcaDph */}
                {platcaDph && (
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="icDph" render={({ field }) => (
                      <FormItem>
                        <FormLabel>IČ DPH *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-partner-icdph" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vatParagraph" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Podľa paragrafu</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="§4" data-testid="input-partner-vat-paragraph" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vatRegisteredAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dátum registrácie DPH</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-partner-vat-registered-at" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* Dátum vzniku */}
                <FormField control={form.control} name="foundedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum vzniku partnera</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-partner-founded-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />

                {/* Partner-specific fields */}
                <FormField control={form.control} name="specialization" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zameranie partnera</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="napr. Poistenie, Reality, SFA..." data-testid="input-partner-specialization" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charakteristika / popis</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={3} data-testid="input-partner-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="collaborationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum začatia spolupráce</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? (typeof field.value === "string" ? field.value : new Date(field.value as any).toISOString().split("T")[0]) : ""}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        data-testid="input-partner-collaboration-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />

                {/* Stav partnerstva — POSLEDNÝ PARAMETER */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-muted-foreground" />
                    Stav partnerstva
                  </label>
                  <Select value={lifecycleStatus} onValueChange={setLifecycleStatus}>
                    <SelectTrigger data-testid="select-partner-lifecycle-status">
                      <SelectValue placeholder="Vybrať stav" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LIFECYCLE_STATUS_CONFIG).map(([key, cfg]) => {
                        const IconComp = cfg.Icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <IconComp className={`w-4 h-4 ${cfg.colorClass}`} fill={cfg.filled ? "currentColor" : "none"} />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {lifecycleStatus === "fast_forward" && (
                    <div>
                      <label className="text-sm font-medium">Dátum štartu <span className="text-destructive">*</span></label>
                      <Input type="date" value={statusStartDate} onChange={(e) => setStatusStartDate(e.target.value)} data-testid="input-partner-status-start-date" />
                    </div>
                  )}
                  {lifecycleStatus === "eject" && (
                    <div>
                      <label className="text-sm font-medium">Dátum ukončenia <span className="text-destructive">*</span></label>
                      <Input type="date" value={statusEndDate} onChange={(e) => setStatusEndDate(e.target.value)} data-testid="input-partner-status-end-date" />
                    </div>
                  )}
                </div>

                {isEditing && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Clock className="w-3 h-3" />
                      <span>Čas spracovania: {editingPartner?.processingTimeSec || 0}s</span>
                      <span>|</span>
                      <span>Vytvorené: {formatDateSlovak(editingPartner?.createdAt)}</span>
                      <span>|</span>
                      <span>Aktualizované: {formatDateSlovak(editingPartner?.updatedAt)}</span>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ─── Adresa ─────────────────────────────────────────────── */}
              <TabsContent value="address" className="space-y-6 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Adresa sídla</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField control={form.control} name="street" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Ulica *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-street" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Popisné číslo</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-street-number" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="orientNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orientačné číslo</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-orient-number" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    <FormField control={form.control} name="postalCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>PSČ *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-postal-code" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Mesto / Obec *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-city" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="stateId" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Štát *</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-partner-state">
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
                      <label htmlFor="corr-same" className="text-xs text-muted-foreground cursor-pointer select-none">Rovnaká ako sídlo</label>
                    </div>
                  </div>

                  {corrSameAsHQ ? (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="text-corr-same">
                      Korešpondenčná adresa je zhodná so sídlom partnera.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-4">
                        <FormField control={form.control} name="corrStreet" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Ulica</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-corr-street" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrStreetNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Popisné číslo</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-corr-street-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrOrientNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Orientačné číslo</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-corr-orient-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-5 gap-4">
                        <FormField control={form.control} name="corrPostalCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>PSČ</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-corr-postal" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrCity" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Mesto</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-corr-city" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="corrStateId" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Štát</FormLabel>
                            <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-partner-corr-state">
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

              {/* ─── Predmet podnikania ──────────────────────────────────── */}
              <TabsContent value="activities" className="mt-4 space-y-4">
                {/* ORSR activities section — rovnako ako Companies.tsx */}
                {registryResult?.businessActivities && registryResult.businessActivities.length > 0 && (
                  <div className="border border-border rounded-md" data-testid="section-orsr-activities">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Z ORSR registra</span>
                        <Badge variant="secondary" className="text-xs">{selectedActivityIndices.size}/{registryResult.businessActivities.length}</Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        data-testid="button-import-selected-activities"
                        onClick={() => {
                          const toAdd = registryResult.businessActivities!
                            .filter((_, i) => selectedActivityIndices.has(i));
                          const existing = new Set(localActivities.map((a: BusinessActivity) => a.text.trim()));
                          const newOnes = toAdd.filter(a => !existing.has(a.text.trim()));
                          if (newOnes.length > 0) setLocalActivities(prev => [...prev, ...newOnes]);
                        }}
                      >
                        Importovať označené
                      </Button>
                    </div>
                    <div className="divide-y divide-border max-h-48 overflow-y-auto">
                      {registryResult.businessActivities.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-2 px-3 py-2 text-sm" data-testid={`orsr-activity-row-${idx}`}>
                          <Checkbox
                            id={`orsr-act-${idx}`}
                            checked={selectedActivityIndices.has(idx)}
                            onCheckedChange={(checked) => {
                              setSelectedActivityIndices(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(idx);
                                else next.delete(idx);
                                return next;
                              });
                            }}
                            className="mt-0.5 shrink-0"
                            data-testid={`checkbox-orsr-activity-${idx}`}
                          />
                          <label htmlFor={`orsr-act-${idx}`} className="flex-1 cursor-pointer leading-relaxed text-foreground">{act.text}</label>
                          {act.since && <span className="text-xs text-muted-foreground font-mono shrink-0">od {act.since}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {registryLoading && !registryResult && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 p-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Načítavam predmety podnikania z ORSR…
                  </div>
                )}

                {!registryLoading && !registryResult && localActivities.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground" data-testid="text-activities-empty">
                    {form.getValues("ico") && watchedSubjectType === "po"
                      ? "Predmety podnikania neboli nájdené v ORSR registri."
                      : "Zadajte IČO a typ PO v záložke Základné údaje pre načítanie predmetov podnikania z ORSR, alebo pridajte manuálne."}
                  </div>
                )}

                {localActivities.length > 0 && (
                  <div className="border border-border rounded-md" data-testid="section-local-activities">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Predmety podnikania</span>
                      <Badge variant="secondary" className="text-xs">{localActivities.length}</Badge>
                    </div>
                    <div className="divide-y divide-border max-h-72 overflow-y-auto">
                      {localActivities.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-2 px-3 py-2 text-sm group" data-testid={`activity-row-${idx}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground break-words">{act.text}</p>
                            {act.since && <p className="text-xs text-muted-foreground mt-0.5 font-mono">od {act.since}</p>}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                            data-testid={`button-delete-activity-${idx}`}
                            onClick={() => setLocalActivities(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-border rounded-md p-3 space-y-3" data-testid="section-add-activity">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pridať manuálne</p>
                  <div className="space-y-2">
                    <textarea
                      className="w-full min-h-[72px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Popis predmetu podnikania alebo činnosti..."
                      value={newActivityText}
                      onChange={e => setNewActivityText(e.target.value)}
                      data-testid="input-new-activity-text"
                    />
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Dátum od</label>
                        <input
                          type="date"
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={newActivitySince}
                          onChange={e => setNewActivitySince(e.target.value)}
                          data-testid="input-new-activity-since"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        data-testid="button-add-activity"
                        disabled={!newActivityText.trim()}
                        onClick={() => {
                          if (!newActivityText.trim()) return;
                          const entry: BusinessActivity = { text: newActivityText.trim() };
                          if (newActivitySince) entry.since = newActivitySince;
                          setLocalActivities(prev => [...prev, entry]);
                          setNewActivityText("");
                          setNewActivitySince("");
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />Pridať
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Pobočky ─────────────────────────────────────────────── */}
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

                    <div className="grid grid-cols-4 gap-3">
                      <Input placeholder="Ulica" value={newBranch.street || ""} onChange={e => setNewBranch(p => ({ ...p, street: e.target.value }))} className="col-span-2" data-testid="input-branch-street" />
                      <Input placeholder="Číslo popisné" value={newBranch.streetNumber || ""} onChange={e => setNewBranch(p => ({ ...p, streetNumber: e.target.value }))} data-testid="input-branch-street-number" />
                      <Input placeholder="Číslo orient." value={newBranch.orientNumber || ""} onChange={e => setNewBranch(p => ({ ...p, orientNumber: e.target.value }))} data-testid="input-branch-orient-number" />
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <Input placeholder="PSČ" value={newBranch.postalCode || ""} onChange={e => setNewBranch(p => ({ ...p, postalCode: e.target.value }))} data-testid="input-branch-postal" />
                      <Input placeholder="Mesto" value={newBranch.city || ""} onChange={e => setNewBranch(p => ({ ...p, city: e.target.value }))} className="col-span-2" data-testid="input-branch-city" />
                      <div className="col-span-2">
                        <Select value={newBranch.stateId ? String(newBranch.stateId) : ""} onValueChange={(v) => setNewBranch(p => ({ ...p, stateId: Number(v) }))}>
                          <SelectTrigger data-testid="select-branch-state"><SelectValue placeholder="Vybrať štát" /></SelectTrigger>
                          <SelectContent>{allStates?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
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
                          <PhoneInput value={ph} onChange={val => setBranchPhones(prev => prev.map((p, j) => j === i ? val : p))} initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code} data-testid={`input-branch-phone-${i}`} />
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
                              onClick={() => setNewBranch(p => ({ ...p, isActive: val !== "inactive", branchStatus: val } as any))}
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

                    {/* Branch employees */}
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
                                {newEmployee.photo ? <img src={newEmployee.photo} className="w-full h-full object-cover" alt="foto" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                              </div>
                              <input ref={employeePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleEmployeePhotoUpload} data-testid="input-employee-photo" />
                              <span className="text-[10px] text-muted-foreground">Fotografia</span>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2 items-start">
                                <div className="flex-1 space-y-1">
                                  <div className="flex gap-1.5">
                                    <Input placeholder="UID" value={newEmployee.uid || ""} onChange={e => { setNewEmployee(p => ({ ...p, uid: e.target.value })); setEmpUidStatus("idle"); }} className="text-sm font-mono" data-testid="input-emp-uid" />
                                    <Button type="button" variant="outline" size="sm" onClick={lookupEmployeeByUid} disabled={!newEmployee.uid?.trim() || empUidStatus === "loading"} className="shrink-0 h-9 text-xs gap-1" data-testid="button-emp-uid-search">
                                      <Search className="w-3 h-3" />
                                      {empUidStatus === "loading" ? "Hľadám..." : "Hľadať"}
                                    </Button>
                                  </div>
                                  {empUidStatus === "found" && <p className="text-[11px] text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Pracovník nájdený – údaje doplnené</p>}
                                  {empUidStatus === "not-found" && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />UID nenájdené</p>}
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
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEmpPhones(prev => [...prev, ""])} data-testid="button-add-emp-phone"><Plus className="w-3 h-3 mr-0.5" />Pridať</Button>
                            </div>
                            {empPhones.map((ph, i) => (
                              <div key={i} className="flex gap-2">
                                <PhoneInput value={ph} onChange={val => setEmpPhones(prev => prev.map((p, j) => j === i ? val : p))} initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code} data-testid={`input-emp-phone-${i}`} />
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setEmpPhones(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-emp-phone-${i}`}><X className="w-3 h-3" /></Button>
                              </div>
                            ))}
                            {empPhones.length === 0 && <p className="text-xs text-muted-foreground">Žiadne telefóny</p>}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" />E-maily</label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEmpEmails(prev => [...prev, ""])} data-testid="button-add-emp-email"><Plus className="w-3 h-3 mr-0.5" />Pridať</Button>
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
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEmpStatusHistory(prev => [...prev, { status: "active", from: "", to: "" }])} data-testid="button-add-status-entry"><Plus className="w-3 h-3 mr-0.5" />Pridať stav</Button>
                            </div>
                            {empStatusHistory.length === 0 && <p className="text-xs text-muted-foreground">Žiadna história stavu.</p>}
                            <div className="space-y-2">
                              {empStatusHistory.map((entry, hi) => (
                                <div key={hi} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center" data-testid={`status-history-row-${hi}`}>
                                  <select value={entry.status} onChange={e => setEmpStatusHistory(prev => prev.map((h, j) => j === hi ? { ...h, status: e.target.value as StatusHistoryEntry["status"] } : h))} className="h-8 text-xs rounded border border-border bg-background px-2 text-foreground" data-testid={`select-status-${hi}`}>
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
                                <p className="text-sm font-medium">{[emp.titleBefore, emp.firstName, emp.lastName, emp.titleAfter].filter(Boolean).join(" ") || "—"}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  {(emp.phones ?? []).map((ph, pi) => <span key={pi} className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{ph}</span>)}
                                  {(emp.emails ?? []).map((em, ei) => <span key={ei} className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{em}</span>)}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmployee(i)} data-testid={`button-edit-employee-${i}`}><Pencil className="w-3 h-3" /></Button>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setBranchEmployees(prev => prev.filter((_, j) => j !== i))} data-testid={`button-delete-employee-${i}`}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end border-t border-border pt-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingBranch(false); setEditingBranchIdx(null); }} data-testid="button-cancel-branch">Zrušiť</Button>
                      <Button type="button" size="sm" onClick={saveBranchForm} data-testid="button-save-branch">
                        {editingBranchIdx !== null ? "Uložiť zmeny" : "Pridať pobočku"}
                      </Button>
                    </div>
                  </div>
                )}

                {branches.length > 0 && !addingBranch && (
                  <div className="space-y-2">
                    {branches.map((br, idx) => (
                      <div key={idx} className="border border-border rounded-md p-3" data-testid={`branch-row-${idx}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium">{br.name || `Pobočka ${idx + 1}`}</span>
                              <Badge variant={br.isActive !== false ? "secondary" : "destructive"} className="text-[10px] px-1.5">
                                {br.isActive !== false ? "Aktívna" : "Neaktívna"}
                              </Badge>
                            </div>
                            {(br.street || br.city) && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {[br.street, br.streetNumber, br.city].filter(Boolean).join(", ")}
                              </p>
                            )}
                            {((br.phones ?? []).length > 0 || (br.emails ?? []).length > 0) && (
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                {(br.phones ?? []).map((ph, pi) => <span key={pi} className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{ph}</span>)}
                                {(br.emails ?? []).map((em, ei) => <span key={ei} className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{em}</span>)}
                              </div>
                            )}
                            {(br.employees ?? []).length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" />{br.employees?.length} pracovníkov
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBranchForm(idx)} data-testid={`button-edit-branch-${idx}`}><Pencil className="w-3 h-3" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setBranches(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-delete-branch-${idx}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {branches.length === 0 && !addingBranch && (
                  <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md" data-testid="text-no-branches">
                    Žiadne pobočky. Kliknite na "Pridať pobočku".
                  </div>
                )}
              </TabsContent>

              {/* ─── Dokumenty ───────────────────────────────────────────── */}
              <TabsContent value="docs" className="mt-4 space-y-6">
                <PartnerFileSection
                  partnerId={editingPartner?.id ?? null}
                  section="official"
                  docs={officialDocs}
                  label="Sekcia A: Oficiálne dokumenty"
                  sublabel="Zmluvy, certifikáty, oprávnenia"
                />
                <Separator />
                <PartnerFileSection
                  partnerId={editingPartner?.id ?? null}
                  section="work"
                  docs={workDocs}
                  label="Sekcia B: Pracovné dokumenty"
                  sublabel="Priebežná dokumentácia, prílohy"
                />
                <Separator />
                <PartnerFileSection
                  partnerId={editingPartner?.id ?? null}
                  section="tax"
                  docs={taxDocs}
                  label="Sekcia C: Daňové dokumenty"
                  sublabel="Daňové doklady, výkazy"
                />
              </TabsContent>

              {/* ─── Logo ────────────────────────────────────────────────── */}
              <TabsContent value="logo" className="mt-4">
                {isEditing ? (
                  <PartnerLogoSection partnerId={editingPartner.id} partner={editingPartner} />
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Logo partnera</label>
                      <p className="text-xs text-muted-foreground">Logo sa nahrá automaticky po prvom uložení partnera</p>
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
                          <Image className="w-4 h-4 mr-2" />
                          {pendingLogo ? "Zmeniť logo" : "Vybrať logo"}
                        </Button>
                        {pendingLogo && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setPendingLogo(null); setPendingLogoPreview(null); }} data-testid="button-clear-logo">
                            <X className="w-4 h-4 mr-1" />Odstrániť
                          </Button>
                        )}
                      </div>
                      {pendingLogoPreview && (
                        <div className="mt-3 w-40 h-28 border border-border rounded-md overflow-hidden flex items-center justify-center bg-muted/30" data-testid="div-logo-preview">
                          <img src={pendingLogoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                      {!pendingLogo && (
                        <div className="mt-3 p-8 border-2 border-dashed border-border rounded-lg text-center text-sm text-muted-foreground" data-testid="text-no-pending-logo">
                          Žiadne logo vybrané
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── Kontakty ────────────────────────────────────────────── */}
              {isEditing && (
                <TabsContent value="contacts" className="mt-4 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Externé kontakty partnera</h4>
                    <Badge variant="secondary" className="ml-auto">{pContacts?.filter(c => c.isActive !== false).length || 0} aktívnych</Badge>
                  </div>
                  {(() => {
                    const activeContacts = pContacts?.filter(c => c.isActive !== false) || [];
                    const archivedContacts = pContacts?.filter(c => c.isActive === false) || [];
                    return (
                      <>
                        {activeContacts.length > 0 ? (
                          <div className="space-y-2">
                            {activeContacts.map(c => (
                              <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`pcontact-${c.id}`}>
                                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{c.titleBefore ? `${c.titleBefore} ` : ""}{c.firstName} {c.lastName}{c.titleAfter ? `, ${c.titleAfter}` : ""}</p>
                                  <p className="text-xs text-muted-foreground">{c.position || ""} {c.email ? `| ${c.email}` : ""} {c.phone ? `| ${formatPhone(c.phone)}` : ""}</p>
                                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>Od: {formatDateSlovak(c.validFrom)}</span>
                                    <span>Do: {c.validTo ? formatDateSlovak(c.validTo) : "Neurčito"}</span>
                                  </div>
                                </div>
                                {c.isPrimary && <Badge variant="secondary">Primárny</Badge>}
                                <Badge variant="outline">SL{c.securityLevel}</Badge>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">Žiadne aktívne kontakty</p>
                        )}
                        {archivedContacts.length > 0 && (
                          <div className="space-y-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowArchivedContacts(!showArchivedContacts)} data-testid="button-toggle-archived-contacts">
                              <Archive className="w-4 h-4 mr-1" />
                              {showArchivedContacts ? "Skryť archív" : `Zobraziť archív (${archivedContacts.length})`}
                            </Button>
                            {showArchivedContacts && archivedContacts.map(c => (
                              <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border/50 text-sm opacity-60" data-testid={`pcontact-archived-${c.id}`}>
                                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{c.titleBefore ? `${c.titleBefore} ` : ""}{c.firstName} {c.lastName}{c.titleAfter ? `, ${c.titleAfter}` : ""}</p>
                                  <p className="text-xs text-muted-foreground">{c.position || ""} {c.email ? `| ${c.email}` : ""} {c.phone ? `| ${formatPhone(c.phone)}` : ""}</p>
                                </div>
                                <Badge variant="destructive">Archivovaný</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Pridať kontakt</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Meno" value={newContactFirst} onChange={e => setNewContactFirst(e.target.value)} data-testid="input-contact-first" />
                      <Input placeholder="Priezvisko" value={newContactLast} onChange={e => setNewContactLast(e.target.value)} data-testid="input-contact-last" />
                      <Input placeholder="Email" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} data-testid="input-contact-email" />
                      <PhoneInput value={newContactPhone} onChange={val => setNewContactPhone(val)} initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code} data-testid="input-contact-phone" />
                      <Input placeholder="Pozícia" value={newContactPosition} onChange={e => setNewContactPosition(e.target.value)} data-testid="input-contact-position" />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Aktívny od</label>
                        <Input type="date" value={newContactValidFrom} onChange={e => setNewContactValidFrom(e.target.value)} data-testid="input-contact-valid-from" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Aktívny do (prázdne = neurčito)</label>
                        <Input type="date" value={newContactValidTo} onChange={e => setNewContactValidTo(e.target.value)} data-testid="input-contact-valid-to" />
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={handleAddContact} disabled={!newContactFirst || !newContactLast} data-testid="button-add-contact">
                      <Plus className="w-4 h-4 mr-1" /> Pridať kontakt
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* ─── Produkty ────────────────────────────────────────────── */}
              {isEditing && (
                <TabsContent value="products" className="mt-4 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Katalóg produktov partnera</h4>
                    <Badge variant="secondary" className="ml-auto">{pProducts?.length || 0}</Badge>
                  </div>
                  {pProducts && pProducts.length > 0 ? (
                    <div className="space-y-2">
                      {pProducts.map(p => (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`pproduct-${p.id}`}>
                          <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            {p.code && <p className="text-xs font-mono text-muted-foreground">{p.code}</p>}
                          </div>
                          <Badge variant="outline">{p.productType}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Žiadne produkty</p>
                  )}
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Pridať produkt</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Názov produktu" value={newProductName} onChange={e => setNewProductName(e.target.value)} data-testid="input-product-name" />
                      <Select value={newProductType} onValueChange={setNewProductType}>
                        <SelectTrigger data-testid="select-product-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Financny">Finančný</SelectItem>
                          <SelectItem value="Realitny">Realitný</SelectItem>
                          <SelectItem value="Poistny">Poistný</SelectItem>
                          <SelectItem value="Iny">Iný</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Kód" value={newProductCode} onChange={e => setNewProductCode(e.target.value)} className="font-mono" data-testid="input-product-code" />
                    </div>
                    <Button type="button" size="sm" onClick={handleAddProduct} disabled={!newProductName} data-testid="button-add-product">
                      <Plus className="w-4 h-4 mr-1" /> Pridať produkt
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* ─── Zmluvy ──────────────────────────────────────────────── */}
              {isEditing && (
                <TabsContent value="zmluvy" className="mt-4 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Zmluvy s partnerom</h4>
                    <Badge variant="secondary" className="ml-auto">{pContracts?.length || 0}</Badge>
                  </div>
                  {pContracts && pContracts.length > 0 ? (
                    <div className="space-y-2">
                      {pContracts.map(c => (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`pcontract-${c.id}`}>
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate font-mono" data-testid={`text-contract-number-${c.id}`}>
                              {c.contractNumber || <span className="text-muted-foreground italic">Bez čísla</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {myCompanies?.find(co => co.id === c.companyId)?.name || `Spoločnosť #${c.companyId}`}
                            </p>
                            {c.signedDate && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>Podpis: {formatDateSlovak(c.signedDate)}</span>
                              </div>
                            )}
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteContractMutation.mutate(c.id)} disabled={deleteContractMutation.isPending} data-testid={`button-delete-contract-${c.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Žiadne zmluvy s partnerom</p>
                  )}
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Pridať zmluvu</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Číslo zmluvy (voliteľné)" value={newContractNumber} onChange={e => setNewContractNumber(e.target.value)} className="font-mono" data-testid="input-contract-number" />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Dátum podpisu (voliteľné)</label>
                        <Input type="date" value={newContractSignedDate} onChange={e => setNewContractSignedDate(e.target.value)} data-testid="input-contract-signed-date" />
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={handleAddContract} disabled={createContractMutation.isPending} data-testid="button-add-contract">
                      <Plus className="w-4 h-4 mr-1" /> Pridať zmluvu
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* ─── Poznámky ────────────────────────────────────────────── */}
              <TabsContent value="notes" className="mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Poznámkový blok</label>
                  <RichTextEditor
                    content={notesHtml}
                    onChange={setNotesHtml}
                    placeholder="Zadajte poznámky k partnerovi..."
                    data-testid="editor-partner-notes"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <ProcessingSaveButton isPending={isPending} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Partners Page ────────────────────────────────────────────────────────────

export default function Partners() {
  const { data: partners, isLoading } = usePartners();
  const { data: appUser } = useAppUser();
  const tableFilter = useSmartFilter(partners || [], PARTNER_FILTER_COLUMNS, "partners");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("partners", PARTNER_COLUMNS);
  const deleteMutation = useDeletePartner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  function openCreate() {
    setEditingPartnerId(null);
    setDialogOpen(true);
  }

  function openPartner(partner: Partner) {
    setEditingPartnerId(partner.id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-partners-title">Zoznam partnerov</h2>
          <p className="text-sm text-muted-foreground mt-1">Správa externých obchodných partnerov.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          {canCreateRecords(appUser) && (
            <Button onClick={openCreate} data-testid="button-add-partner">
              <Plus className="w-4 h-4 mr-2" />
              Pridať nového partnera
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("uid") && <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>}
                {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Názov</TableHead>}
                {columnVisibility.isVisible("code") && <TableHead sortKey="code" sortDirection={sortKey === "code" ? sortDirection : null} onSort={requestSort}>Kód</TableHead>}
                {columnVisibility.isVisible("specialization") && <TableHead sortKey="specialization" sortDirection={sortKey === "specialization" ? sortDirection : null} onSort={requestSort}>Zameranie</TableHead>}
                {columnVisibility.isVisible("ico") && <TableHead sortKey="ico" sortDirection={sortKey === "ico" ? sortDirection : null} onSort={requestSort}>IČO</TableHead>}
                {columnVisibility.isVisible("city") && <TableHead sortKey="city" sortDirection={sortKey === "city" ? sortDirection : null} onSort={requestSort}>Mesto</TableHead>}
                {columnVisibility.isVisible("collaborationDate") && <TableHead sortKey="collaborationDate" sortDirection={sortKey === "collaborationDate" ? sortDirection : null} onSort={requestSort}>Dátum spolupráce</TableHead>}
                <TableHead className="w-[80px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Načítavam...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!partners || partners.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground" data-testid="text-partners-empty">
                    Žiadni partneri. Kliknite na "Pridať nového partnera".
                  </TableCell>
                </TableRow>
              )}
              {sortedData.map(partner => (
                <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`} onRowClick={() => openPartner(partner)}>
                  {columnVisibility.isVisible("uid") && <TableCell className="font-mono text-xs text-muted-foreground">{formatUid(partner.uid) || "-"}</TableCell>}
                  {columnVisibility.isVisible("name") && (
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const logo = (partner.logos as any[])?.find((l: any) => l.isPrimary && !l.isArchived);
                          return logo ? <img src={logo.url} alt="logo" className="w-6 h-6 object-contain rounded flex-shrink-0" /> : null;
                        })()}
                        {partner.name}
                      </div>
                    </TableCell>
                  )}
                  {columnVisibility.isVisible("code") && <TableCell>{partner.code ? <Badge variant="secondary" className="font-mono">{partner.code}</Badge> : "-"}</TableCell>}
                  {columnVisibility.isVisible("specialization") && <TableCell className="text-sm">{partner.specialization || "-"}</TableCell>}
                  {columnVisibility.isVisible("ico") && <TableCell className="text-sm">{partner.ico || "-"}</TableCell>}
                  {columnVisibility.isVisible("city") && <TableCell className="text-sm">{partner.city || "-"}</TableCell>}
                  {columnVisibility.isVisible("collaborationDate") && <TableCell className="text-xs text-muted-foreground">{formatDateSlovak(partner.collaborationDate)}</TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LifecycleStatusIcon status={partner.lifecycleStatus} />
                      {canEditRecords(appUser) && (
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openPartner(partner); }} data-testid={`button-edit-partner-${partner.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDeleteRecords(appUser) && !partner.uid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteTarget(partner); }} data-testid={`button-delete-partner-${partner.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PartnerUnifiedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partnerId={editingPartnerId}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať partnera?</AlertDialogTitle>
            <AlertDialogDescription>
              Partner "{deleteTarget?.name}" bude presunutý do archívu. Táto akcia je vratná cez administrátora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-partner">Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-partner"
            >
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
