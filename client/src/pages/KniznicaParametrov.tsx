import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { isAdmin } from "@/lib/utils";
import {
  Library,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  FileText,
  Search,
  Loader2,
  Copy,
  LayoutTemplate,
  X,
  Brain,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Shield,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type SubjectParamSection = {
  id: number;
  clientTypeId: number;
  name: string;
  code: string;
  folderCategory: string;
  sortOrder: number;
  isPanel: boolean;
  parentSectionId: number | null;
  gridColumns: number;
  icon: string | null;
  isActive: boolean;
};

type SubjectParameter = {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  panelId: number | null;
  fieldKey: string;
  code: string;
  label: string;
  shortLabel: string | null;
  fieldType: string;
  isRequired: boolean;
  isHidden: boolean;
  options: string[];
  defaultValue: string | null;
  visibilityRule: { dependsOn: string; value: string } | null;
  unit: string | null;
  decimalPlaces: number;
  fieldCategory: string;
  categoryCode: string | null;
  sortOrder: number;
  rowNumber: number;
  widthPercent: number;
  isActive: boolean;
  createdAt: string;
};

type SubjectTemplate = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
};

const CLIENT_TYPE_MAP: Record<number, string> = {
  1: "FO (Fyzická osoba)",
  3: "SZČO",
  4: "PO (Právnická osoba)",
  5: "NS (Tretí sektor)",
  6: "VS (Verejný sektor)",
};

const FIELD_TYPE_OPTIONS = [
  { value: "short_text", label: "Krátky text" },
  { value: "long_text", label: "Dlhý text" },
  { value: "number", label: "Číslo" },
  { value: "desatinne_cislo", label: "Desatinné číslo" },
  { value: "date", label: "Dátum" },
  { value: "switch", label: "Prepínač (Áno/Nie)" },
  { value: "jedna_moznost", label: "Jedna možnosť" },
  { value: "viac_moznosti", label: "Viac možností" },
  { value: "phone", label: "Telefón" },
];

export default function KniznicaParametrov() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const userIsAdmin = isAdmin(appUser);
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedClientType, setSelectedClientType] = useState<string>("all");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editParam, setEditParam] = useState<SubjectParameter | null>(null);
  const [isParamDialogOpen, setIsParamDialogOpen] = useState(false);
  const [paramFormResetKey, setParamFormResetKey] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [editSection, setEditSection] = useState<SubjectParamSection | null>(null);
  const [isModuleBProtected, setIsModuleBProtected] = useState(true);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<SubjectTemplate | null>(null);
  const [bindingTemplateId, setBindingTemplateId] = useState<number | null>(null);
  const [extractionText, setExtractionText] = useState("");
  const [extractionClientType, setExtractionClientType] = useState<string>("1");
  const [extractionResults, setExtractionResults] = useState<any>(null);
  const [confirmedFields, setConfirmedFields] = useState<Set<number>>(new Set());
  const [rejectedFields, setRejectedFields] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "parameter" | "section" | "panel" | "template" | "unknown"; id: number; name: string } | null>(null);
  

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SubjectParamSection[]>({
    queryKey: ["/api/subject-param-sections"],
  });

  const { data: parameters = [], isLoading: paramsLoading } = useQuery<SubjectParameter[]>({
    queryKey: ["/api/subject-parameters"],
  });

  const { data: allSynonyms = [] } = useQuery<{ id: number; parameterId: number; synonym: string; status: string }[]>({
    queryKey: ["/api/parameter-synonyms"],
  });

  const synonymsByParamId = allSynonyms.reduce<Record<number, string[]>>((acc, s) => {
    if (!acc[s.parameterId]) acc[s.parameterId] = [];
    acc[s.parameterId].push(s.synonym.toLowerCase());
    return acc;
  }, {});

  const { data: templates = [], isLoading: templatesLoading } = useQuery<SubjectTemplate[]>({
    queryKey: ["/api/subject-templates"],
  });

  const { data: templateParams = [] } = useQuery<{ id: number; templateId: number; parameterId: number; sortOrder: number; validFrom: string | null; validTo: string | null }[]>({
    queryKey: [`/api/subject-template-params/${bindingTemplateId}`],
    enabled: !!bindingTemplateId,
  });

  const { data: paramDeps = {} } = useQuery<Record<number, { subjectCount: number; templateCount: number; historyCount: number }>>({
    queryKey: ["/api/param-dependencies-batch", parameters.map(p => p.id).join(",")],
    queryFn: async () => {
      const results: Record<number, any> = {};
      await Promise.all(
        parameters.map(async (p) => {
          const res = await fetch(`/api/subject-parameters/${p.id}/dependencies`, { credentials: "include" });
          if (res.ok) results[p.id] = await res.json();
        })
      );
      return results;
    },
    enabled: parameters.length > 0,
  });

  const { data: sectionDeps = {} } = useQuery<Record<number, { parameterCount: number; subjectCount: number }>>({
    queryKey: ["/api/section-dependencies-batch", sections.map(s => s.id).join(",")],
    queryFn: async () => {
      const results: Record<number, any> = {};
      await Promise.all(
        sections.map(async (s) => {
          const res = await fetch(`/api/subject-param-sections/${s.id}/dependencies`, { credentials: "include" });
          if (res.ok) results[s.id] = await res.json();
        })
      );
      return results;
    },
    enabled: sections.length > 0,
  });

  const { data: templateDeps = {} } = useQuery<Record<number, { parameterCount: number }>>({
    queryKey: ["/api/template-dependencies-batch", templates.map(t => t.id).join(",")],
    queryFn: async () => {
      const results: Record<number, any> = {};
      await Promise.all(
        templates.map(async (t) => {
          const res = await fetch(`/api/subject-templates/${t.id}/dependencies`, { credentials: "include" });
          if (res.ok) results[t.id] = await res.json();
        })
      );
      return results;
    },
    enabled: templates.length > 0,
  });

  const extractFieldsMutation = useMutation({
    mutationFn: async (data: { text: string; clientTypeId: string }) => {
      const res = await apiRequest("POST", "/api/ai/extract-fields", data);
      return res.json();
    },
    onSuccess: (data) => {
      setExtractionResults(data);
      setRejectedFields(new Set());
      const autoConfirmed = new Set<number>();
      (data.extracted || []).forEach((r: any, i: number) => {
        if (!r.needsConfirmation) autoConfirmed.add(i);
      });
      setConfirmedFields(autoConfirmed);
      toast({ title: `Extrakcia dokončená: ${data.matchedCount} zhôd, ${data.needsConfirmationCount} na potvrdenie` });
    },
    onError: () => {
      toast({ title: "Chyba pri extrakcii", variant: "destructive" });
    },
  });

  const confirmSynonymMutation = useMutation({
    mutationFn: async (data: { synonymId: number; documentName?: string; sourceText?: string }) => {
      const res = await apiRequest("POST", `/api/parameter-synonyms/${data.synonymId}/confirm`, {
        documentName: data.documentName,
        sourceText: data.sourceText,
      });
      return res.json();
    },
    onSuccess: (updated, variables) => {
      if (extractionResults?.extracted) {
        const newResults = { ...extractionResults };
        newResults.extracted = newResults.extracted.map((r: any) => {
          if (r.synonymId === variables.synonymId) {
            return {
              ...r,
              synonymStatus: updated.status,
              synonymConfirmationCount: updated.confirmationCount,
              isProposal: updated.status === "learning",
              needsConfirmation: updated.status === "learning",
            };
          }
          return r;
        });
        setExtractionResults(newResults);
      }
      toast({ title: `Synonymum potvrdené (${updated.confirmationCount}/5)` });
    },
    onError: () => {
      toast({ title: "Chyba pri potvrdzovaní", variant: "destructive" });
    },
  });

  const saveSectionMutation = useMutation({
    mutationFn: async (data: Partial<SubjectParamSection> & { id?: number }) => {
      if (data.id) {
        await apiRequest("PATCH", `/api/subject-param-sections/${data.id}`, data);
      } else {
        await apiRequest("POST", "/api/subject-param-sections", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      setIsSectionDialogOpen(false);
      setEditSection(null);
      toast({ title: "Sekcia uložená" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní sekcie", variant: "destructive" });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subject-param-sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      toast({ title: "Sekcia vymazaná" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní sekcie", variant: "destructive" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: Partial<SubjectTemplate> & { id?: number }) => {
      if (data.id) {
        await apiRequest("PATCH", `/api/subject-templates/${data.id}`, data);
      } else {
        await apiRequest("POST", "/api/subject-templates", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-templates"] });
      setIsTemplateDialogOpen(false);
      setEditTemplate(null);
      toast({ title: "Šablóna uložená" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní šablóny", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subject-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-templates"] });
      toast({ title: "Šablóna vymazaná" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní šablóny", variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/seed-subject-parameters");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      toast({ title: "Parametre úspešne naplnené" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Chyba pri seedovaní", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (): Promise<{ message: string; added: number; total: number }> => {
      const res = await apiRequest("POST", "/api/admin/sync-subject-parameters");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      toast({ title: data.added > 0 ? `Synchronizácia hotová – pridaných ${data.added} parametrov` : "Synchronizácia hotová – nič nechýbalo" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Chyba pri synchronizácii", variant: "destructive" });
    },
  });

  const addTemplateParamMutation = useMutation({
    mutationFn: async (data: { templateId: number; parameterId: number; validFrom?: string; validTo?: string }) => {
      await apiRequest("POST", "/api/subject-template-params", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/subject-template-params/${bindingTemplateId}`] });
      toast({ title: "Parameter pridaný do šablóny" });
    },
    onError: () => {
      toast({ title: "Chyba pri pridávaní", variant: "destructive" });
    },
  });

  const removeTemplateParamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subject-template-params/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/subject-template-params/${bindingTemplateId}`] });
      toast({ title: "Parameter odobraný zo šablóny" });
    },
    onError: () => {
      toast({ title: "Chyba", variant: "destructive" });
    },
  });

  const updateTemplateParamMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; validFrom?: string | null; validTo?: string | null }) => {
      await apiRequest("PATCH", `/api/subject-template-params/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/subject-template-params/${bindingTemplateId}`] });
      toast({ title: "Platnosť aktualizovaná" });
    },
    onError: () => {
      toast({ title: "Chyba", variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup-orphan-panels");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      toast({ title: `Upratovanie: ${data.panelCategoryFixed} kategórií opravených, ${data.orphanPanelsDeleted} sirôt zmazaných, ${data.paramCategoryFixed} parametrov opravených` });
    },
    onError: () => {
      toast({ title: "Chyba pri upratovaní", variant: "destructive" });
    },
  });

  const unknownDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/unknown-extracted-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unknown-extracted-fields"] });
      toast({ title: "Neznáme pole vymazané" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
    },
  });

  const deleteParamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subject-parameters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      toast({ title: "Parameter vymazaný" });
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      const jsonPart = msg.includes("{") ? msg.substring(msg.indexOf("{")) : "";
      let userMsg = "Chyba pri mazaní";
      try {
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          userMsg = parsed.message || userMsg;
        }
      } catch {}
      if (msg.includes("nie je možné vymazať")) userMsg = msg.replace(/^\d+:\s*/, "");
      toast({ title: userMsg, variant: "destructive" });
    },
  });

  const saveParamMutation = useMutation({
    mutationFn: async (data: Partial<SubjectParameter> & { id?: number }) => {
      const isEdit = !!data.id;
      if (data.id) {
        await apiRequest("PATCH", `/api/subject-parameters/${data.id}`, data);
      } else {
        await apiRequest("POST", "/api/subject-parameters", data);
      }
      return { isEdit };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      if (result.isEdit) {
        setIsParamDialogOpen(false);
        setEditParam(null);
      } else {
        setEditParam(null);
        setParamFormResetKey(k => k + 1);
      }
      toast({ title: "Parameter uložený" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    },
  });

  const filteredParams = (() => {
    const typeFiltered = parameters.filter(p =>
      selectedClientType === "all" || p.clientTypeId === Number(selectedClientType)
    );

    if (!debouncedSearchQuery) return typeFiltered;

    const q = debouncedSearchQuery.toLowerCase();

    const scored = typeFiltered.flatMap(p => {
      const label = p.label.toLowerCase();
      const key = p.fieldKey.toLowerCase();
      const short = (p.shortLabel || "").toLowerCase();
      const syns = synonymsByParamId[p.id] || [];

      let score = -1;
      if (label === q || key === q || short === q) score = 0;
      else if (label.startsWith(q) || key.startsWith(q) || short.startsWith(q)) score = 1;
      else if (label.includes(q) || key.includes(q) || short.includes(q)) score = 2;
      else if (syns.some(s => s === q)) score = 3;
      else if (syns.some(s => s.startsWith(q))) score = 4;
      else if (syns.some(s => s.includes(q))) score = 5;

      if (score === -1) return [];
      return [{ p, score }];
    });

    return scored
      .sort((a, b) => a.score !== b.score ? a.score - b.score : (a.p.sortOrder || 0) - (b.p.sortOrder || 0))
      .map(({ p }) => p);
  })();

  const isDeletePending = deleteParamMutation.isPending || deleteSectionMutation.isPending || deleteTemplateMutation.isPending || unknownDeleteMutation.isPending;

  const sectionMap = new Map(sections.map(s => [s.id, s]));

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const groupedBySection = new Map<number | null, SubjectParameter[]>();
  filteredParams.forEach(p => {
    const key = p.panelId || p.sectionId || null;
    if (!groupedBySection.has(key)) groupedBySection.set(key, []);
    groupedBySection.get(key)!.push(p);
  });

  const filteredSections = sections.filter(s => {
    if (selectedClientType !== "all" && s.clientTypeId !== Number(selectedClientType)) return false;
    return true;
  });

  const topLevelSections = filteredSections.filter(s => !s.isPanel && !s.parentSectionId);
  const panelSections = filteredSections.filter(s => s.isPanel);

  const isLoading = sectionsLoading || paramsLoading || templatesLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs" data-testid="badge-param-count">
          {parameters.length} parametrov
        </Badge>
        <Badge variant="outline" className="text-xs" data-testid="badge-section-count">
          {sections.length} sekcií
        </Badge>
        <Badge variant="outline" className="text-xs" data-testid="badge-template-count">
          {templates.length} šablón
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-between" data-testid="tabs-kniznica">
          <TabsTrigger value="templates" data-testid="tab-templates">
            <LayoutTemplate className="w-3.5 h-3.5 mr-1" />
            Šablóny
          </TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections">
            <Layers className="w-3.5 h-3.5 mr-1" />
            Sekcie & Panely
          </TabsTrigger>
          <TabsTrigger value="parameters" data-testid="tab-parameters">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Parametre
          </TabsTrigger>
          <TabsTrigger value="unknown" data-testid="tab-unknown-fields">
            <Brain className="w-3.5 h-3.5 mr-1" />
            Neznáme polia
          </TabsTrigger>
          <TabsTrigger value="extraction" data-testid="tab-extraction">
            <Wand2 className="w-3.5 h-3.5 mr-1" />
            Extrakcia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parameters" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať parameter..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => setDebouncedSearchQuery(e.target.value), 300);
                }}
                className="pl-9"
                data-testid="input-search-params"
              />
            </div>
            <Select value={selectedClientType} onValueChange={setSelectedClientType}>
              <SelectTrigger className="w-48" data-testid="select-client-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky typy</SelectItem>
                <SelectItem value="1">FO</SelectItem>
                <SelectItem value="3">SZČO</SelectItem>
                <SelectItem value="4">PO</SelectItem>
                <SelectItem value="5">NS</SelectItem>
                <SelectItem value="6">VS</SelectItem>
              </SelectContent>
            </Select>
            {userIsAdmin ? (
              <Button
                size="sm"
                onClick={() => { setEditParam(null); setIsParamDialogOpen(true); }}
                data-testid="button-add-param"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nový parameter
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast({ title: "Návrh parametra", description: "Funkcia návrhov parametrov bude dostupná čoskoro." })}
                data-testid="button-suggest-param"
              >
                <Brain className="w-4 h-4 mr-1" />
                Navrhnúť parameter
              </Button>
            )}
            {parameters.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                data-testid="button-seed-params"
              >
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Library className="w-4 h-4 mr-1" />}
                Naplniť knižnicu (304 parametrov)
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-params"
            >
              {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Synchronizovať chýbajúce parametre
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Kľúč</TableHead>
                      <TableHead>Názov</TableHead>
                      <TableHead>Typ poľa</TableHead>
                      <TableHead>Typ klienta</TableHead>
                      <TableHead>Sekcia / Panel</TableHead>
                      <TableHead className="w-16">Povinný</TableHead>
                      <TableHead className="w-16">Aktívny</TableHead>
                      <TableHead className="w-24">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Žiadne parametre
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParams.map((p, idx) => {
                        const section = p.sectionId ? sectionMap.get(p.sectionId) : null;
                        const panel = p.panelId ? sectionMap.get(p.panelId) : null;
                        return (
                          <TableRow key={p.id} data-testid={`row-param-${p.id}`}>
                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{p.fieldKey}</TableCell>
                            <TableCell className="font-medium">{p.label}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {FIELD_TYPE_OPTIONS.find(ft => ft.value === p.fieldType)?.label || p.fieldType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {CLIENT_TYPE_MAP[p.clientTypeId] || `Typ ${p.clientTypeId}`}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {section?.name || "—"}{panel ? ` → ${panel.name}` : ""}
                            </TableCell>
                            <TableCell>
                              {p.isRequired ? (
                                <Badge variant="destructive" className="text-[10px]">Áno</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Nie</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${p.isActive ? "bg-green-500" : "bg-red-500"}`} />
                                {(p as any).isObjectKey && (
                                  <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-500 px-1" data-testid={`badge-object-key-${p.id}`}>Kľúč</Badge>
                                )}
                                {(p as any).parameterScope === "contract" && (
                                  <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-500 px-1" data-testid={`badge-scope-contract-${p.id}`}>Zmluva</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { setEditParam(p); setIsParamDialogOpen(true); }}
                                  data-testid={`button-edit-param-${p.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {(() => {
                                  const deps = paramDeps[p.id];
                                  const isLocked = deps && (deps.historyCount > 0 || deps.templateCount > 0);
                                  if (isLocked) {
                                    const reasons: string[] = [];
                                    if (deps.subjectCount > 0) reasons.push(`${deps.subjectCount} subjektov`);
                                    if (deps.templateCount > 0) reasons.push(`${deps.templateCount} šablón`);
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-muted-foreground cursor-not-allowed"
                                              disabled
                                              data-testid={`button-lock-param-${p.id}`}
                                            >
                                              <Lock className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="left" className="max-w-xs">
                                            <p className="text-xs">Toto pole nie je možné vymazať, pretože obsahuje dáta u {reasons.join(" a je súčasťou ")}.</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  }
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => setDeleteConfirm({ type: "parameter", id: p.id, name: p.label })}
                                      data-testid={`button-delete-param-${p.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  );
                                })()}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 mb-2" data-testid="module-b-readonly-banner">
            <Shield className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-500">CHRÁNENÁ ZÓNA</span>
            <span className="text-xs text-muted-foreground flex-1">Šablónu (B) spravujte cez Režim Architekt v Profile subjektu (C). Tu je len náhľad.</span>
            <Button
              size="sm"
              variant={isModuleBProtected ? "outline" : "destructive"}
              className="h-6 text-[10px] shrink-0"
              onClick={() => setIsModuleBProtected(!isModuleBProtected)}
              data-testid="btn-toggle-protection"
            >
              <Lock className="w-3 h-3 mr-1" />
              {isModuleBProtected ? "Odomknúť editáciu" : "Zamknúť"}
            </Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedClientType} onValueChange={setSelectedClientType}>
              <SelectTrigger className="w-48" data-testid="select-section-client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky typy</SelectItem>
                <SelectItem value="1">FO</SelectItem>
                <SelectItem value="3">SZČO</SelectItem>
                <SelectItem value="4">PO</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => { setEditSection(null); setIsSectionDialogOpen(true); }}
              disabled={isModuleBProtected}
              data-testid="button-add-section"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nová sekcia/panel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending || isModuleBProtected}
              data-testid="button-cleanup"
            >
              {cleanupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
              Upratať hierarchiu
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {topLevelSections.map(folder => {
                const childPanels = panelSections.filter(ps => ps.parentSectionId === folder.id);
                const isExpanded = expandedSections.has(folder.id);
                return (
                  <Card key={folder.id} data-testid={`card-section-${folder.id}`}>
                    <CardHeader
                      className="py-3 px-4 cursor-pointer"
                      onClick={() => toggleSection(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-sm font-semibold">{folder.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          {CLIENT_TYPE_MAP[folder.clientTypeId] || `Typ ${folder.clientTypeId}`}
                        </Badge>
                        <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30" variant="outline">
                          {folder.folderCategory || "—"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {childPanels.length} panelov
                        </Badge>
                        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => { setEditSection(folder); setIsSectionDialogOpen(true); }}
                            disabled={isModuleBProtected}
                            data-testid={`button-edit-section-${folder.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {(() => {
                            const deps = sectionDeps[folder.id];
                            const isLocked = deps && deps.parameterCount > 0;
                            if (isLocked) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground cursor-not-allowed"
                                        disabled
                                        data-testid={`button-lock-section-${folder.id}`}
                                      >
                                        <Lock className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-xs">Túto sekciu nie je možné vymazať, pretože obsahuje {deps.parameterCount} parametrov/panelov.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => setDeleteConfirm({ type: "section", id: folder.id, name: folder.name })}
                                disabled={isModuleBProtected}
                                data-testid={`button-delete-section-${folder.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-3 px-4">
                        <div className="space-y-2 ml-6 border-l-2 border-blue-500/20 pl-3">
                          {childPanels.map(panel => {
                            const panelParams = parameters.filter(p => p.panelId === panel.id);
                            const categoryMismatch = panel.folderCategory && panel.folderCategory !== folder.folderCategory;
                            return (
                              <div key={panel.id} className={`border rounded p-3 ${categoryMismatch ? "border-amber-500/40 bg-amber-500/5" : ""}`} data-testid={`panel-${panel.id}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-muted-foreground text-xs">└</span>
                                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{panel.name}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {panelParams.length} polí
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    Grid: {panel.gridColumns} stĺpce
                                  </span>
                                  {categoryMismatch && (
                                    <Badge className="text-[9px] bg-amber-500/20 text-amber-500 border-amber-500/30" variant="outline">
                                      ⚠ {panel.folderCategory} ≠ {folder.folderCategory}
                                    </Badge>
                                  )}
                                  <div className="ml-auto flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => { setEditSection(panel); setIsSectionDialogOpen(true); }}
                                      disabled={isModuleBProtected}
                                      data-testid={`button-edit-panel-${panel.id}`}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    {(() => {
                                      const deps = sectionDeps[panel.id];
                                      const isLocked = deps && deps.parameterCount > 0;
                                      if (isLocked) {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-muted-foreground cursor-not-allowed"
                                                  disabled
                                                  data-testid={`button-lock-panel-${panel.id}`}
                                                >
                                                  <Lock className="w-3 h-3" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent side="left" className="max-w-xs">
                                                <p className="text-xs">Tento panel nie je možné vymazať, pretože obsahuje {deps.parameterCount} parametrov.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      }
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive"
                                          onClick={() => setDeleteConfirm({ type: "section", id: panel.id, name: panel.name })}
                                          disabled={isModuleBProtected}
                                          data-testid={`button-delete-panel-${panel.id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      );
                                    })()}
                                  </div>
                                </div>
                                {panelParams.length > 0 && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                                    {panelParams.sort((a, b) => a.sortOrder - b.sortOrder).map(p => (
                                      <div
                                        key={p.id}
                                        className="text-xs px-2 py-1 bg-muted/50 rounded flex items-center gap-1"
                                      >
                                        <span className="truncate">{p.label}</span>
                                        {p.isRequired && <span className="text-destructive">*</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {childPanels.length === 0 && (
                            <p className="text-xs text-muted-foreground">Žiadne panely v tejto sekcii</p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
              {topLevelSections.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Žiadne sekcie pre vybraný typ</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => { setEditTemplate(null); setIsTemplateDialogOpen(true); }}
              data-testid="button-add-template"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nová šablóna
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map(tmpl => (
                  <Card
                    key={tmpl.id}
                    className={`cursor-pointer transition-colors ${bindingTemplateId === tmpl.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setBindingTemplateId(bindingTemplateId === tmpl.id ? null : tmpl.id)}
                    data-testid={`card-template-${tmpl.id}`}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-semibold">{tmpl.name}</CardTitle>
                        {tmpl.isDefault && (
                          <Badge className="text-[10px]">Predvolená</Badge>
                        )}
                        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => { setEditTemplate(tmpl); setIsTemplateDialogOpen(true); }}
                            data-testid={`button-edit-template-${tmpl.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {(() => {
                            const deps = templateDeps[tmpl.id];
                            const isLocked = deps && deps.parameterCount > 0;
                            if (isLocked) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground cursor-not-allowed"
                                        disabled
                                        data-testid={`button-lock-template-${tmpl.id}`}
                                      >
                                        <Lock className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-xs">Túto šablónu nie je možné vymazať, pretože obsahuje {deps.parameterCount} naviazaných parametrov.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => setDeleteConfirm({ type: "template", id: tmpl.id, name: tmpl.name })}
                                data-testid={`button-delete-template-${tmpl.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-4">
                      <p className="text-xs text-muted-foreground mb-2">{tmpl.description || "Bez popisu"}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Kód: {tmpl.code}
                        </Badge>
                        <div className={`w-2 h-2 rounded-full ${tmpl.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {templates.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-8">
                    Žiadne šablóny
                  </p>
                )}
              </div>

              {bindingTemplateId && (() => {
                const groupedByPanel = new Map<string, { panelName: string; items: typeof templateParams }>();
                templateParams.forEach(tp => {
                  const param = parameters.find(p => p.id === tp.parameterId);
                  const panel = param?.panelId ? sections.find(s => s.id === param.panelId) : null;
                  const key = panel ? String(panel.id) : "unassigned";
                  const panelName = panel?.name || "Nepriradené";
                  if (!groupedByPanel.has(key)) {
                    groupedByPanel.set(key, { panelName, items: [] });
                  }
                  groupedByPanel.get(key)!.items.push(tp);
                });

                return (
                <Card data-testid="template-bindings-panel">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">
                      Parametre šablóny: {templates.find(t => t.id === bindingTemplateId)?.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {templateParams.length} parametrov v {groupedByPanel.size} paneloch
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3 px-4 space-y-4">
                    {Array.from(groupedByPanel.entries()).map(([panelKey, group], gIdx) => (
                      <div key={panelKey} className={gIdx > 0 ? "border-t-2 border-border pt-4" : ""} data-testid={`panel-group-${panelKey}`}>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-muted-foreground/30">
                          <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{group.panelName}</h4>
                          <Badge variant="outline" className="text-[9px] ml-auto">{group.items.length} param.</Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Parameter</TableHead>
                              <TableHead className="text-xs">Kód</TableHead>
                              <TableHead className="text-xs">Platné od</TableHead>
                              <TableHead className="text-xs">Platné do</TableHead>
                              <TableHead className="text-xs w-20">Akcie</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map(tp => {
                              const param = parameters.find(p => p.id === tp.parameterId);
                              return (
                                <TableRow key={tp.id} data-testid={`row-binding-${tp.id}`}>
                                  <TableCell className="text-xs">{param?.label || `ID ${tp.parameterId}`}</TableCell>
                                  <TableCell className="text-xs font-mono text-muted-foreground">{param?.code || "-"}</TableCell>
                                  <TableCell className="text-xs">
                                    <Input
                                      type="date"
                                      className="h-7 text-xs w-32"
                                      defaultValue={tp.validFrom?.split("T")[0] || ""}
                                      onBlur={(e) => {
                                        updateTemplateParamMutation.mutate({
                                          id: tp.id,
                                          validFrom: e.target.value || null,
                                        });
                                      }}
                                      data-testid={`input-valid-from-${tp.id}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <Input
                                      type="date"
                                      className="h-7 text-xs w-32"
                                      defaultValue={tp.validTo?.split("T")[0] || ""}
                                      onBlur={(e) => {
                                        updateTemplateParamMutation.mutate({
                                          id: tp.id,
                                          validTo: e.target.value || null,
                                        });
                                      }}
                                      data-testid={`input-valid-to-${tp.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => removeTemplateParamMutation.mutate(tp.id)}
                                      data-testid={`button-remove-binding-${tp.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                    {templateParams.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Žiadne parametre priradené</p>
                    )}

                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">Pridať parameter do šablóny</Label>
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(val) => {
                            addTemplateParamMutation.mutate({
                              templateId: bindingTemplateId,
                              parameterId: parseInt(val),
                            });
                          }}
                          data-testid="select-add-param-to-template"
                        >
                          <SelectTrigger className="w-64 h-8 text-xs" data-testid="trigger-add-param-to-template">
                            <SelectValue placeholder="Vybrať parameter..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parameters
                              .filter(p => !templateParams.some(tp => tp.parameterId === p.id))
                              .map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.label} ({p.code})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="unknown" className="space-y-4">
          <UnknownFieldsTab sections={sections} parameters={parameters} onDeleteConfirm={(id, name) => setDeleteConfirm({ type: "unknown", id, name })} />
        </TabsContent>

        <TabsContent value="extraction" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI Extrakcia polí z dokumentu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Text dokumentu</Label>
                  <Textarea
                    value={extractionText}
                    onChange={e => setExtractionText(e.target.value)}
                    placeholder="Vložte text z dokumentu (napr. občiansky preukaz, technický preukaz, zmluva)..."
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-extraction-input"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Typ klienta</Label>
                    <Select value={extractionClientType} onValueChange={setExtractionClientType}>
                      <SelectTrigger data-testid="select-extraction-client-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">FO (Fyzická osoba)</SelectItem>
                        <SelectItem value="3">SZČO</SelectItem>
                        <SelectItem value="4">PO (Právnická osoba)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => extractFieldsMutation.mutate({ text: extractionText, clientTypeId: extractionClientType })}
                    disabled={!extractionText.trim() || extractFieldsMutation.isPending}
                    className="w-full"
                    data-testid="button-run-extraction"
                  >
                    {extractFieldsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-2" />
                    )}
                    Extrahovať polia
                  </Button>
                  {extractionResults && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {extractionResults.confirmedCount} automaticky potvrdené
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {extractionResults.needsConfirmationCount} na potvrdenie
                        </Badge>
                      </div>
                      {extractionResults.proposalCount > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                            <Brain className="w-3 h-3 mr-1" />
                            {extractionResults.proposalCount} návrhy (učiace sa)
                          </Badge>
                        </div>
                      )}
                      {extractionResults.unmatchedCount > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                            <Brain className="w-3 h-3 mr-1" />
                            {extractionResults.unmatchedCount} neznáme
                          </Badge>
                        </div>
                      )}
                      {extractionResults.detectedDocumentType && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Detekovaný typ: {extractionResults.detectedDocumentType}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {extractionResults?.extracted && extractionResults.extracted.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Výsledky extrakcie</Label>
                    <div className="text-xs text-muted-foreground">
                      Potvrdené: {confirmedFields.size} | Zamietnuté: {rejectedFields.size} | Celkom: {extractionResults.extracted.length}
                    </div>
                  </div>
                  <div className="border rounded overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Parameter</TableHead>
                          <TableHead>Hodnota</TableHead>
                          <TableHead className="w-[100px]">Istota</TableHead>
                          <TableHead className="w-[80px]">Zdroj</TableHead>
                          <TableHead className="w-[80px]">Stav</TableHead>
                          <TableHead className="w-[120px] text-right">Akcie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractionResults.extracted.map((result: any, idx: number) => {
                          const isConfirmed = confirmedFields.has(idx);
                          const isRejected = rejectedFields.has(idx);
                          const confidencePercent = Math.round(result.confidence || 0);
                          const confidenceColor = confidencePercent >= 95
                            ? "text-green-400"
                            : confidencePercent >= 75
                              ? "text-amber-400"
                              : "text-red-400";
                          return (
                            <TableRow
                              key={`extraction-${idx}`}
                              className={isRejected ? "opacity-40 line-through" : isConfirmed ? "bg-green-500/5" : result.needsConfirmation ? "bg-amber-500/5" : ""}
                            >
                              <TableCell className="font-medium text-sm">
                                {result.label || result.fieldKey}
                              </TableCell>
                              <TableCell className="font-mono text-sm max-w-[250px] truncate">
                                {result.matchedValue || "-"}
                              </TableCell>
                              <TableCell>
                                <span className={`font-mono text-sm font-bold ${confidenceColor}`}>
                                  {confidencePercent}%
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {result.matchType === "regex" ? "Regex" : result.matchType === "synonym" ? "Synonymum" : "Label"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isConfirmed && !result.needsConfirmation && !isRejected && !result.isProposal ? (
                                  <Badge className="bg-green-600 text-xs">Auto</Badge>
                                ) : isConfirmed && result.isProposal ? (
                                  <Badge className="bg-green-600 text-xs">OK</Badge>
                                ) : isConfirmed ? (
                                  <Badge className="bg-green-600 text-xs">OK</Badge>
                                ) : isRejected ? (
                                  <Badge variant="destructive" className="text-xs">Zamietnuté</Badge>
                                ) : result.isProposal ? (
                                  <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                                    <Brain className="w-3 h-3 mr-0.5" />
                                    Návrh {result.synonymConfirmationCount}/{extractionResults?.confirmationThreshold || 5}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-0.5" />
                                    Čaká
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {result.isProposal && !isConfirmed && !isRejected && result.synonymId ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-purple-500/30 text-purple-400 text-xs"
                                      disabled={confirmSynonymMutation.isPending}
                                      onClick={() => {
                                        confirmSynonymMutation.mutate({
                                          synonymId: result.synonymId!,
                                          documentName: extractionResults?.detectedDocumentType || undefined,
                                          sourceText: result.matchedValue || undefined,
                                        });
                                        setConfirmedFields(prev => { const n = new Set(Array.from(prev)); n.add(idx); return n; });
                                      }}
                                      data-testid={`button-confirm-proposal-${idx}`}
                                    >
                                      <ThumbsUp className="w-3 h-3 mr-1" />
                                      Potvrdiť
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setRejectedFields(prev => { const n = new Set(Array.from(prev)); n.add(idx); return n; })}
                                      data-testid={`button-reject-${idx}`}
                                    >
                                      <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                  </div>
                                ) : result.needsConfirmation && !isConfirmed && !isRejected ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setConfirmedFields(prev => { const n = new Set(Array.from(prev)); n.add(idx); return n; })}
                                      data-testid={`button-confirm-${idx}`}
                                    >
                                      <ThumbsUp className="w-3.5 h-3.5 text-green-400" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setRejectedFields(prev => { const n = new Set(Array.from(prev)); n.add(idx); return n; })}
                                      data-testid={`button-reject-${idx}`}
                                    >
                                      <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                  </div>
                                ) : isRejected ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const next = new Set(rejectedFields);
                                      next.delete(idx);
                                      setRejectedFields(next);
                                    }}
                                    data-testid={`button-undo-reject-${idx}`}
                                  >
                                    Vrátiť
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ParameterDialog
        open={isParamDialogOpen}
        onOpenChange={setIsParamDialogOpen}
        editParam={editParam}
        sections={sections}
        allParameters={parameters}
        onSave={(data) => saveParamMutation.mutate(data)}
        isPending={saveParamMutation.isPending}
        resetKey={paramFormResetKey}
      />

      <SectionDialog
        open={isSectionDialogOpen}
        onOpenChange={setIsSectionDialogOpen}
        editSection={editSection}
        sections={sections}
        onSave={(data) => saveSectionMutation.mutate(data)}
        isPending={saveSectionMutation.isPending}
      />

      <TemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        editTemplate={editTemplate}
        onSave={(data) => saveTemplateMutation.mutate(data)}
        isPending={saveTemplateMutation.isPending}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open && !isDeletePending) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Potvrdenie vymazania
            </AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vymazať {deleteConfirm ? ({ parameter: "tento parameter", section: "túto sekciu", panel: "tento panel", template: "túto šablónu", unknown: "toto neznáme pole" } as const)[deleteConfirm.type] : ""} <strong>„{deleteConfirm?.name}"</strong>? Táto akcia je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete" disabled={isDeletePending}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
              disabled={isDeletePending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteConfirm) return;
                const onDone = { onSuccess: () => setDeleteConfirm(null), onError: () => {} };
                if (deleteConfirm.type === "parameter") {
                  deleteParamMutation.mutate(deleteConfirm.id, onDone);
                } else if (deleteConfirm.type === "section" || deleteConfirm.type === "panel") {
                  deleteSectionMutation.mutate(deleteConfirm.id, onDone);
                } else if (deleteConfirm.type === "template") {
                  deleteTemplateMutation.mutate(deleteConfirm.id, onDone);
                } else if (deleteConfirm.type === "unknown") {
                  unknownDeleteMutation.mutate(deleteConfirm.id, onDone);
                }
              }}
            >
              {isDeletePending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SynonymManager({ parameterId, parameterLabel }: { parameterId: number; parameterLabel: string }) {
  const [newSynonym, setNewSynonym] = useState("");
  const { toast } = useToast();

  const { data: synonyms = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/subject-parameters", parameterId, "synonyms"],
    queryFn: async () => {
      const res = await fetch(`/api/subject-parameters/${parameterId}/synonyms`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (synonym: string) => {
      await apiRequest("POST", `/api/subject-parameters/${parameterId}/synonyms`, { synonym });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters", parameterId, "synonyms"] });
      setNewSynonym("");
      toast({ title: "Synonymum pridané" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/parameter-synonyms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters", parameterId, "synonyms"] });
      toast({ title: "Synonymum odstránené" });
    },
  });

  const handleAdd = () => {
    if (!newSynonym.trim()) return;
    addMutation.mutate(newSynonym.trim());
  };

  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Brain className="w-4 h-4 text-purple-400" />
        <span>AI Synonymá</span>
        <span className="text-muted-foreground text-xs">({synonyms.length})</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Alternatívne názvy pre automatické rozpoznanie z dokumentov
      </p>
      <div className="flex gap-2">
        <Input
          value={newSynonym}
          onChange={e => setNewSynonym(e.target.value)}
          placeholder="napr. r.č., rodné č., birth number..."
          className="text-sm"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          data-testid="input-new-synonym"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newSynonym.trim() || addMutation.isPending}
          data-testid="button-add-synonym"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Načítavam...</div>
      ) : synonyms.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {synonyms.map((syn: any) => (
            <Badge key={syn.id} variant="secondary" className={`text-xs gap-1 pr-1 ${syn.origin === "registry" ? "border-orange-500/40" : ""}`}>
              {syn.synonym}
              {syn.origin === "registry" && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 ml-0.5" data-testid={`badge-registry-origin-${syn.id}`}>Z registra</span>
              )}
              {syn.status === "learning" && (
                <span className="text-[9px] text-muted-foreground ml-0.5" data-testid={`text-learning-${syn.id}`}>Učí sa ({syn.confirmationCount || 0}/5)</span>
              )}
              {syn.status === "confirmed" && (
                <CheckCircle2 className="w-3 h-3 text-green-500 ml-0.5" />
              )}
              <button
                onClick={() => deleteMutation.mutate(syn.id)}
                className="ml-0.5 hover:text-destructive"
                data-testid={`button-delete-synonym-${syn.id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Zatiaľ žiadne synonymá</div>
      )}
    </div>
  );
}

const TRANSACTIONAL_KEYWORDS = [
  "splatnost", "splátka", "splátky", "suma_zmluvy", "suma_poistenia", "poistné",
  "provízia", "odmena", "platba", "faktúra", "inkaso", "dátum_platby",
  "datum_splatnosti", "celková_suma", "mesačná_splátka", "ročná_splátka",
  "poistna_suma", "výška_provície", "výška_odmeny", "zmluvná_suma",
  "datum_uzavretia", "datum_ukonenia", "datum_zaciatku", "platnost_od",
  "platnost_do", "trvanie_zmluvy", "frekvencia_platby",
];

function isTransactionalField(fieldKey: string, label: string): boolean {
  const lowerKey = fieldKey.toLowerCase();
  const lowerLabel = label.toLowerCase();
  return TRANSACTIONAL_KEYWORDS.some(kw =>
    lowerKey.includes(kw) || lowerLabel.includes(kw)
  );
}

function ParameterDialog({
  open,
  onOpenChange,
  editParam,
  sections,
  allParameters,
  onSave,
  isPending,
  resetKey = 0,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editParam: SubjectParameter | null;
  sections: SubjectParamSection[];
  allParameters: SubjectParameter[];
  onSave: (data: any) => void;
  isPending: boolean;
  resetKey?: number;
}) {
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [fieldType, setFieldType] = useState("short_text");
  const [isRequired, setIsRequired] = useState(false);
  const [isCollection, setIsCollection] = useState(false);
  const [isObjectKey, setIsObjectKey] = useState(false);
  const [parameterScope, setParameterScope] = useState("subject");
  const [clientTypeId, setClientTypeId] = useState("1");
  const [sectionId, setSectionId] = useState<string>("");
  const [panelId, setPanelId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [rowNumber, setRowNumber] = useState("0");
  const [widthPercent, setWidthPercent] = useState("100");
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [unit, setUnit] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [hintRegex, setHintRegex] = useState("");
  const [hintFormat, setHintFormat] = useState("");

  const resetForm = () => {
    if (editParam) {
      setFieldKey(editParam.fieldKey);
      setLabel(editParam.label);
      setShortLabel(editParam.shortLabel || "");
      setFieldType(editParam.fieldType);
      setIsRequired(editParam.isRequired);
      setIsCollection((editParam as any).isCollection || false);
      setIsObjectKey((editParam as any).isObjectKey || false);
      setParameterScope((editParam as any).parameterScope || "subject");
      setClientTypeId(String(editParam.clientTypeId));
      setSectionId(editParam.sectionId ? String(editParam.sectionId) : "");
      setPanelId(editParam.panelId ? String(editParam.panelId) : "");
      setSortOrder(String(editParam.sortOrder));
      setRowNumber(String(editParam.rowNumber));
      setWidthPercent(String(editParam.widthPercent));
      setOptionsList(editParam.options || []);
      setNewOption("");
      setUnit(editParam.unit || "");
      setDecimalPlaces(String(editParam.decimalPlaces));
      const hints = (editParam as any).extractionHints;
      setHintRegex(hints?.regex || "");
      setHintFormat(hints?.format || "");
    } else {
      setFieldKey("");
      setLabel("");
      setShortLabel("");
      setFieldType("short_text");
      setIsRequired(false);
      setIsCollection(false);
      setIsObjectKey(false);
      setParameterScope("subject");
      setClientTypeId("1");
      setSectionId("");
      setPanelId("");
      setSortOrder("0");
      setRowNumber("0");
      setWidthPercent("100");
      setOptionsList([]);
      setNewOption("");
      setUnit("");
      setDecimalPlaces("2");
      setHintRegex("");
      setHintFormat("");
    }
  };

  useEffect(() => {
    if (resetKey > 0 && !editParam) {
      resetForm();
      setDuplicateWarning(null);
      setDuplicateAcknowledged(false);
      setTransactionalWarning(false);
      setTransactionalAcknowledged(false);
    }
  }, [resetKey]);

  const handleOpenChange = (v: boolean) => {
    if (v) resetForm();
    setDuplicateWarning(null);
    setDuplicateAcknowledged(false);
    setTransactionalWarning(false);
    setTransactionalAcknowledged(false);
    onOpenChange(v);
  };

  const [duplicateWarning, setDuplicateWarning] = useState<{ existingParam: SubjectParameter; existingSection: SubjectParamSection | undefined } | null>(null);
  const [transactionalWarning, setTransactionalWarning] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [transactionalAcknowledged, setTransactionalAcknowledged] = useState(false);

  const checkDuplicate = (currentFieldKey: string, currentLabel: string, currentSectionId: string) => {
    if (!currentFieldKey && !currentLabel) { setDuplicateWarning(null); return; }
    const lowerKey = currentFieldKey.toLowerCase();
    const lowerLabel = currentLabel.toLowerCase();
    const existing = allParameters.find(p => {
      if (editParam && p.id === editParam.id) return false;
      const keyMatch = lowerKey && p.fieldKey.toLowerCase() === lowerKey;
      const labelMatch = lowerLabel && p.label.toLowerCase() === lowerLabel;
      if (!keyMatch && !labelMatch) return false;
      if (currentSectionId && p.sectionId === Number(currentSectionId)) return false;
      return true;
    });
    if (existing) {
      const sec = sections.find(s => s.id === existing.sectionId);
      setDuplicateWarning({ existingParam: existing, existingSection: sec });
      setDuplicateAcknowledged(false);
    } else {
      setDuplicateWarning(null);
    }
  };

  const checkTransactional = (currentFieldKey: string, currentLabel: string) => {
    const isTx = isTransactionalField(currentFieldKey, currentLabel);
    setTransactionalWarning(isTx);
    if (!isTx) setTransactionalAcknowledged(false);
  };

  const filteredSections = sections.filter(s => s.clientTypeId === Number(clientTypeId) && !s.isPanel);
  const filteredPanels = sections.filter(s => s.clientTypeId === Number(clientTypeId) && s.isPanel && (!sectionId || s.parentSectionId === Number(sectionId)));
  const allPanelsForType = sections.filter(s => s.clientTypeId === Number(clientTypeId) && s.isPanel);
  const selectedPanel = panelId ? allPanelsForType.find(p => p.id === Number(panelId)) : null;
  const panelParentSection = selectedPanel ? filteredSections.find(s => s.id === selectedPanel.parentSectionId) : null;
  const resolvedFieldCategory = panelParentSection?.folderCategory || (sectionId ? filteredSections.find(s => s.id === Number(sectionId))?.folderCategory : null) || "povinne";
  const paramMissingPanel = !panelId || panelId === "none";

  const handleSubmit = () => {
    if (!label) return;
    if (paramMissingPanel) return;
    if (duplicateWarning && !duplicateAcknowledged) return;
    if (transactionalWarning && !transactionalAcknowledged) {
      setParameterScope("contract");
    }
    const resolvedSectionId = selectedPanel?.parentSectionId || (sectionId ? Number(sectionId) : null);
    const data: any = {
      label,
      shortLabel: shortLabel || null,
      fieldType,
      isRequired,
      isCollection,
      isObjectKey,
      parameterScope,
      clientTypeId: Number(clientTypeId),
      sectionId: resolvedSectionId,
      panelId: Number(panelId),
      sortOrder: Number(sortOrder),
      rowNumber: Number(rowNumber),
      widthPercent: Number(widthPercent),
      options: (fieldType === "jedna_moznost" || fieldType === "viac_moznosti") ? optionsList.filter(Boolean) : [],
      unit: unit || null,
      decimalPlaces: Number(decimalPlaces),
      isHidden: false,
      fieldCategory: resolvedFieldCategory,
      defaultValue: null,
      visibilityRule: null,
      categoryCode: null,
      extractionHints: (hintRegex || hintFormat) ? { regex: hintRegex || undefined, format: hintFormat || undefined } : null,
    };
    if (editParam) data.id = editParam.id;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editParam ? "Upraviť parameter" : "Nový parameter"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Názov parametra *</Label>
            <Input
              value={label}
              onChange={e => { setLabel(e.target.value); checkDuplicate(fieldKey, e.target.value, sectionId); checkTransactional(fieldKey, e.target.value); }}
              placeholder="napr. Rodné číslo, Meno klienta..."
              data-testid="input-field-label"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Skrátený názov</Label>
            <Input
              value={shortLabel}
              onChange={e => setShortLabel(e.target.value)}
              placeholder="voliteľné"
              data-testid="input-field-short-label"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Typ poľa</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map(ft => (
                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Typ klienta</Label>
            <Select value={clientTypeId} onValueChange={setClientTypeId}>
              <SelectTrigger data-testid="select-client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">FO</SelectItem>
                <SelectItem value="3">SZČO</SelectItem>
                <SelectItem value="4">PO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sekcia (priečinok)</Label>
            <Select value={sectionId} onValueChange={(val) => { setSectionId(val); checkDuplicate(fieldKey, label, val); }}>
              <SelectTrigger data-testid="select-section">
                <SelectValue placeholder="Vybrať sekciu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Žiadna</SelectItem>
                {filteredSections.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Panel *</Label>
            <Select value={panelId} onValueChange={setPanelId}>
              <SelectTrigger data-testid="select-panel" className={paramMissingPanel ? "border-red-500" : ""}>
                <SelectValue placeholder="Vybrať panel" />
              </SelectTrigger>
              <SelectContent>
                {filteredPanels.map(s => {
                  const parentSec = filteredSections.find(sec => sec.id === s.parentSectionId);
                  return (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {parentSec ? `${parentSec.name} → ` : ""}{s.name}
                    </SelectItem>
                  );
                })}
                {filteredPanels.length === 0 && (
                  <SelectItem value="__empty" disabled>Žiadne panely{sectionId ? " v tejto sekcii" : ""}</SelectItem>
                )}
              </SelectContent>
            </Select>
            {paramMissingPanel && (
              <p className="text-xs text-red-500 flex items-center gap-1" data-testid="error-missing-panel">
                <AlertTriangle className="w-3 h-3" /> Parameter musí patriť do panelu
              </p>
            )}
            {selectedPanel && (
              <p className="text-xs text-muted-foreground" data-testid="param-category-info">
                Kategória: <strong>{resolvedFieldCategory}</strong> (zdedená z nadradenej sekcie)
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={isRequired}
              onCheckedChange={setIsRequired}
              data-testid="switch-required"
            />
            <Label>Povinné pole</Label>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={isCollection}
              onCheckedChange={setIsCollection}
              data-testid="switch-collection"
            />
            <Label className="flex flex-col">
              <span>Kolekcia (viac hodnôt)</span>
              <span className="text-xs text-muted-foreground font-normal">napr. telefóny, emaily, adresy</span>
            </Label>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={isObjectKey}
              onCheckedChange={setIsObjectKey}
              data-testid="switch-object-key"
            />
            <Label className="flex flex-col">
              <span>Kľúč objektu</span>
              <span className="text-xs text-muted-foreground font-normal">ŠPZ, VIN, č. LV - zlučuje dáta v Module B</span>
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label>Rozsah parametra</Label>
            <Select value={parameterScope} onValueChange={(val) => { setParameterScope(val); if (val === "contract") setTransactionalAcknowledged(true); }}>
              <SelectTrigger data-testid="select-parameter-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subject">Profil subjektu (trvalý)</SelectItem>
                <SelectItem value="contract">Portfólio zmlúv (transakčný)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Poradie (sortOrder)</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              data-testid="input-sort-order"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Číslo riadku</Label>
            <Input
              type="number"
              value={rowNumber}
              onChange={e => setRowNumber(e.target.value)}
              data-testid="input-row-number"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Šírka (%)</Label>
            <Input
              type="number"
              value={widthPercent}
              onChange={e => setWidthPercent(e.target.value)}
              data-testid="input-width-percent"
            />
          </div>
          {(fieldType === "jedna_moznost" || fieldType === "viac_moznosti") && (
            <div className="col-span-2 space-y-2">
              <Label>Možnosti výberu *</Label>
              {optionsList.length > 0 && (
                <div className="space-y-1.5">
                  {optionsList.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={e => {
                          const updated = [...optionsList];
                          updated[idx] = e.target.value;
                          setOptionsList(updated);
                        }}
                        className="h-8 text-sm"
                        data-testid={`input-option-${idx}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600"
                        onClick={() => setOptionsList(prev => prev.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-option-${idx}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newOption.trim()) {
                      e.preventDefault();
                      setOptionsList(prev => [...prev, newOption.trim()]);
                      setNewOption("");
                    }
                  }}
                  placeholder="Zadajte novú možnosť..."
                  className="h-8 text-sm"
                  data-testid="input-new-option"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8"
                  disabled={!newOption.trim()}
                  onClick={() => {
                    if (newOption.trim()) {
                      setOptionsList(prev => [...prev, newOption.trim()]);
                      setNewOption("");
                    }
                  }}
                  data-testid="button-add-option"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Pridať
                </Button>
              </div>
              {optionsList.length === 0 && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Zadajte aspoň jednu možnosť
                </p>
              )}
            </div>
          )}
          {(fieldType === "desatinne_cislo" || fieldType === "number") && (
            <>
              <div className="space-y-1.5">
                <Label>Jednotka</Label>
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="napr. €, %, ks"
                  data-testid="input-unit"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Desatinné miesta</Label>
                <Input
                  type="number"
                  value={decimalPlaces}
                  onChange={e => setDecimalPlaces(e.target.value)}
                  data-testid="input-decimal-places"
                />
              </div>
            </>
          )}
        </div>

        <div className="border border-border rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Brain className="w-4 h-4 text-blue-400" />
            <span>Extrakčné pravidlá</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Regex vzor a formát pre automatickú extrakciu z dokumentov
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Regex vzor</Label>
              <Input
                value={hintRegex}
                onChange={e => setHintRegex(e.target.value)}
                placeholder="napr. \d{6}/\d{3,4}"
                className="text-xs font-mono"
                data-testid="input-hint-regex"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Formát</Label>
              <Input
                value={hintFormat}
                onChange={e => setHintFormat(e.target.value)}
                placeholder="napr. XXXXXX/XXXX"
                className="text-xs"
                data-testid="input-hint-format"
              />
            </div>
          </div>
        </div>

        {duplicateWarning && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2" data-testid="duplicate-warning">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-sm font-medium text-amber-500">Duplicitný parameter</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Tento údaj už existuje v sekcii <strong>{duplicateWarning.existingSection?.name || "Bez sekcie"}</strong> ako <strong>"{duplicateWarning.existingParam.label}"</strong> (kód: {duplicateWarning.existingParam.fieldKey}).
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                onClick={() => { setDuplicateAcknowledged(true); }}
                data-testid="btn-duplicate-allow"
              >
                <Copy className="w-3 h-3 mr-1" />
                Duplikovať
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => { setDuplicateWarning(null); setDuplicateAcknowledged(false); }}
                data-testid="btn-duplicate-cancel"
              >
                Zrušiť
              </Button>
            </div>
            {duplicateAcknowledged && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Duplikácia povolená
              </p>
            )}
          </div>
        )}

        {transactionalWarning && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 space-y-2" data-testid="transactional-warning">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm font-medium text-red-500">Transakčný parameter</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Tento parameter vyzerá ako transakčný údaj (dátumy splatnosti, sumy zmluvy, provízie). Transakčné parametre patria do Modulu A (Portfólio zmlúv), nie do šablón subjektu (B).
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-red-500/40 text-red-500 hover:bg-red-500/20"
                onClick={() => { setParameterScope("contract"); setTransactionalAcknowledged(true); }}
                data-testid="btn-transactional-redirect"
              >
                Presmerovať do Modulu A
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => { setTransactionalAcknowledged(true); }}
                data-testid="btn-transactional-override"
              >
                Ponechať v (B)
              </Button>
            </div>
            {transactionalAcknowledged && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Smerovanie potvrdené — rozsah: {parameterScope === "contract" ? "Portfólio zmlúv (A)" : "Profil subjektu (B)"}
              </p>
            )}
          </div>
        )}

        {editParam && (
          <SynonymManager parameterId={editParam.id} parameterLabel={editParam.label} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-param">
            Zrušiť
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !label || paramMissingPanel || (duplicateWarning !== null && !duplicateAcknowledged) || (transactionalWarning && !transactionalAcknowledged)}
            data-testid="button-save-param"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editParam ? "Uložiť zmeny" : "Vytvoriť"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({
  open,
  onOpenChange,
  editSection,
  sections,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editSection: SubjectParamSection | null;
  sections: SubjectParamSection[];
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [clientTypeId, setClientTypeId] = useState("1");
  const [folderCategory, setFolderCategory] = useState("povinne");
  const [isPanel, setIsPanel] = useState(false);
  const [parentSectionId, setParentSectionId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [gridColumns, setGridColumns] = useState("2");
  const [icon, setIcon] = useState("");

  const resetForm = () => {
    if (editSection) {
      setName(editSection.name);
      setCode(editSection.code);
      setClientTypeId(String(editSection.clientTypeId));
      setFolderCategory(editSection.folderCategory || "povinne");
      setIsPanel(editSection.isPanel);
      setParentSectionId(editSection.parentSectionId ? String(editSection.parentSectionId) : "");
      setSortOrder(String(editSection.sortOrder));
      setGridColumns(String(editSection.gridColumns));
      setIcon(editSection.icon || "");
    } else {
      setName("");
      setCode("");
      setClientTypeId("1");
      setFolderCategory("povinne");
      setIsPanel(false);
      setParentSectionId("");
      setSortOrder("0");
      setGridColumns("2");
      setIcon("");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (v) resetForm();
    onOpenChange(v);
  };

  const folderSections = sections.filter(s => !s.isPanel && s.clientTypeId === Number(clientTypeId));

  const parentSection = parentSectionId ? folderSections.find(s => s.id === Number(parentSectionId)) : null;
  const inheritedCategory = isPanel && parentSection ? parentSection.folderCategory : null;
  const panelMissingParent = isPanel && !parentSectionId;

  const handleSubmit = () => {
    if (!name) return;
    if (isPanel && !parentSectionId) return;
    const resolvedCategory = isPanel ? (inheritedCategory || "povinne") : folderCategory;
    const data: any = {
      name,
      clientTypeId: Number(clientTypeId),
      folderCategory: resolvedCategory,
      isPanel,
      parentSectionId: isPanel && parentSectionId ? Number(parentSectionId) : null,
      sortOrder: Number(sortOrder),
      gridColumns: Number(gridColumns),
      icon: icon || null,
      isActive: true,
    };
    if (editSection) data.id = editSection.id;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editSection ? "Upraviť sekciu/panel" : "Nová sekcia/panel"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Názov *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="napr. Osobné údaje, Kontaktné údaje..." data-testid="input-section-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Typ klienta</Label>
            <Select value={clientTypeId} onValueChange={setClientTypeId}>
              <SelectTrigger data-testid="select-section-dialog-client-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">FO</SelectItem>
                <SelectItem value="3">SZČO</SelectItem>
                <SelectItem value="4">PO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Poradie</Label>
            <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} data-testid="input-section-sort" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={isPanel} onCheckedChange={setIsPanel} data-testid="switch-is-panel" />
            <Label>Je panel (vnorený v sekcii)</Label>
          </div>
          {!isPanel && (
            <div className="col-span-2 space-y-1.5">
              <Label>Priečinková kategória (Accordion v profile)</Label>
              <Select value={folderCategory} onValueChange={setFolderCategory}>
                <SelectTrigger data-testid="select-folder-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="povinne">Povinné údaje</SelectItem>
                  <SelectItem value="osobne">Osobné údaje</SelectItem>
                  <SelectItem value="doplnkove">Doplnkové údaje</SelectItem>
                  <SelectItem value="volitelne">Voliteľné údaje</SelectItem>
                  <SelectItem value="ine">Iné údaje</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isPanel && (
            <div className="col-span-2 space-y-1.5">
              <Label>Nadradená sekcia *</Label>
              <Select value={parentSectionId} onValueChange={setParentSectionId}>
                <SelectTrigger data-testid="select-parent-section" className={panelMissingParent ? "border-red-500" : ""}>
                  <SelectValue placeholder="Vybrať sekciu..." />
                </SelectTrigger>
                <SelectContent>
                  {folderSections.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.folderCategory})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {panelMissingParent && (
                <p className="text-xs text-red-500 flex items-center gap-1" data-testid="error-missing-parent">
                  <AlertTriangle className="w-3 h-3" /> Panel musí patriť do sekcie
                </p>
              )}
              {inheritedCategory && (
                <p className="text-xs text-muted-foreground" data-testid="inherited-category-info">
                  Kategória automaticky zdedená: <strong>{inheritedCategory}</strong>
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Grid stĺpce</Label>
            <Input type="number" value={gridColumns} onChange={e => setGridColumns(e.target.value)} data-testid="input-grid-columns" />
          </div>
          <div className="space-y-1.5">
            <Label>Ikona</Label>
            <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="napr. user, building" data-testid="input-section-icon" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-section">Zrušiť</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name || panelMissingParent} data-testid="button-save-section">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editSection ? "Uložiť zmeny" : "Vytvoriť"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  editTemplate,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTemplate: SubjectTemplate | null;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    if (editTemplate) {
      setName(editTemplate.name);
      setCode(editTemplate.code);
      setDescription(editTemplate.description || "");
      setIsDefault(editTemplate.isDefault);
      setIsActive(editTemplate.isActive);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setIsDefault(false);
      setIsActive(true);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (v) resetForm();
    onOpenChange(v);
  };

  const handleSubmit = () => {
    if (!name) return;
    const data: any = { name, description: description || null, isDefault, isActive };
    if (editTemplate) data.id = editTemplate.id;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Upraviť šablónu" : "Nová šablóna"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Názov *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="napr. Základná FO šablóna..." data-testid="input-template-name" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Popis</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} data-testid="input-template-description" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} data-testid="switch-template-default" />
            <Label>Predvolená</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-template-active" />
            <Label>Aktívna</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-template">Zrušiť</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name} data-testid="button-save-template">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editTemplate ? "Uložiť zmeny" : "Vytvoriť"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UnknownField = {
  id: number;
  sourceText: string;
  extractedKey: string;
  extractedValue: string | null;
  documentName: string | null;
  clientTypeId: number | null;
  subjectId: number | null;
  contractId: number | null;
  status: string;
  assignedParameterId: number | null;
  resolvedByUserId: number | null;
  resolvedAt: string | null;
  createdAt: string;
};

function UnknownFieldsTab({ sections, parameters, onDeleteConfirm }: { sections: SubjectParamSection[]; parameters: SubjectParameter[]; onDeleteConfirm: (id: number, name: string) => void }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("new");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<UnknownField | null>(null);
  const [assignParamId, setAssignParamId] = useState<string>("");
  const [searchAssign, setSearchAssign] = useState("");

  const { data: unknownFields = [], isLoading } = useQuery<UnknownField[]>({
    queryKey: ["/api/unknown-extracted-fields", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" ? "/api/unknown-extracted-fields" : `/api/unknown-extracted-fields?status=${statusFilter}`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Chyba pri načítaní");
      return resp.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, parameterId }: { id: number; parameterId: number }) => {
      await apiRequest("PATCH", `/api/unknown-extracted-fields/${id}`, {
        status: "assigned",
        assignedParameterId: parameterId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unknown-extracted-fields"] });
      setAssignDialogOpen(false);
      setSelectedField(null);
      toast({ title: "Priradené k parametru" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/unknown-extracted-fields/${id}`, { status: "dismissed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unknown-extracted-fields"] });
      toast({ title: "Pole zamietnuté" });
    },
  });

  const filteredAssignParams = parameters.filter(p =>
    !searchAssign || p.label.toLowerCase().includes(searchAssign.toLowerCase()) || p.fieldKey.toLowerCase().includes(searchAssign.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    new: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    assigned: "bg-green-500/20 text-green-400 border-green-500/30",
    dismissed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    created: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Neznáme extrahované polia
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8" data-testid="select-unknown-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Nové</SelectItem>
                  <SelectItem value="assigned">Priradené</SelectItem>
                  <SelectItem value="dismissed">Zamietnuté</SelectItem>
                  <SelectItem value="all">Všetky</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : unknownFields.length === 0 ? (
            <div className="text-center text-muted-foreground py-8" data-testid="text-no-unknown-fields">
              Žiadne neznáme polia
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kľúč</TableHead>
                  <TableHead>Hodnota</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead className="w-[160px]">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unknownFields.map((field) => (
                  <TableRow
                    key={field.id}
                    className={field.status === "new" ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""}
                    data-testid={`row-unknown-field-${field.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      {field.status === "new" && <AlertTriangle className="w-3 h-3 text-amber-400 inline mr-1" />}
                      {field.extractedKey}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{field.extractedValue || "-"}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">{field.sourceText}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[field.status] || ""}>
                        {field.status === "new" ? "Nové" : field.status === "assigned" ? "Priradené" : field.status === "dismissed" ? "Zamietnuté" : field.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {field.status === "new" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setSelectedField(field); setAssignDialogOpen(true); }}
                              data-testid={`button-assign-unknown-${field.id}`}
                            >
                              <ChevronRight className="w-3 h-3 mr-1" />
                              Priradiť
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => dismissMutation.mutate(field.id)}
                              data-testid={`button-dismiss-unknown-${field.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive"
                          onClick={() => onDeleteConfirm(field.id, field.extractedKey)}
                          data-testid={`button-delete-unknown-${field.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Priradiť k parametru</DialogTitle>
          </DialogHeader>
          {selectedField && (
            <div className="space-y-3">
              <div className="p-2 bg-muted/50 rounded text-sm">
                <span className="text-muted-foreground">Kľúč:</span> <strong>{selectedField.extractedKey}</strong>
                {selectedField.extractedValue && (
                  <><br /><span className="text-muted-foreground">Hodnota:</span> {selectedField.extractedValue}</>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Hľadať parameter</Label>
                <Input
                  value={searchAssign}
                  onChange={e => setSearchAssign(e.target.value)}
                  placeholder="Hľadať podľa názvu alebo kódu..."
                  data-testid="input-search-assign-param"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded">
                {filteredAssignParams.slice(0, 30).map(p => (
                  <button
                    key={p.id}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center justify-between ${assignParamId === String(p.id) ? "bg-primary/10" : ""}`}
                    onClick={() => setAssignParamId(String(p.id))}
                    data-testid={`button-select-param-${p.id}`}
                  >
                    <span>{p.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Zrušiť</Button>
            <Button
              onClick={() => {
                if (selectedField && assignParamId) {
                  assignMutation.mutate({ id: selectedField.id, parameterId: Number(assignParamId) });
                }
              }}
              disabled={!assignParamId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Priradiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
