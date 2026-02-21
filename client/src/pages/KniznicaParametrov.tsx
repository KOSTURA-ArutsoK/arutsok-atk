import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  isActive: boolean;
};

type SubjectParameter = {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  panelId: number | null;
  fieldKey: string;
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
  const [activeTab, setActiveTab] = useState("parameters");
  const [selectedClientType, setSelectedClientType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editParam, setEditParam] = useState<SubjectParameter | null>(null);
  const [isParamDialogOpen, setIsParamDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [editSection, setEditSection] = useState<SubjectParamSection | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<SubjectTemplate | null>(null);
  const [bindingTemplateId, setBindingTemplateId] = useState<number | null>(null);

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SubjectParamSection[]>({
    queryKey: ["/api/subject-param-sections"],
  });

  const { data: parameters = [], isLoading: paramsLoading } = useQuery<SubjectParameter[]>({
    queryKey: ["/api/subject-parameters"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<SubjectTemplate[]>({
    queryKey: ["/api/subject-templates"],
  });

  const { data: templateParams = [] } = useQuery<{ id: number; templateId: number; parameterId: number; sortOrder: number; validFrom: string | null; validTo: string | null }[]>({
    queryKey: [`/api/subject-template-params/${bindingTemplateId}`],
    enabled: !!bindingTemplateId,
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

  const deleteParamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subject-parameters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      toast({ title: "Parameter vymazaný" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
    },
  });

  const saveParamMutation = useMutation({
    mutationFn: async (data: Partial<SubjectParameter> & { id?: number }) => {
      if (data.id) {
        await apiRequest("PATCH", `/api/subject-parameters/${data.id}`, data);
      } else {
        await apiRequest("POST", "/api/subject-parameters", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      setIsParamDialogOpen(false);
      setEditParam(null);
      toast({ title: "Parameter uložený" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    },
  });

  const filteredParams = parameters.filter(p => {
    if (selectedClientType !== "all" && p.clientTypeId !== Number(selectedClientType)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.label.toLowerCase().includes(q) || p.fieldKey.toLowerCase().includes(q);
    }
    return true;
  });

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
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Library className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">Knižnica parametrov</h1>
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
        <TabsList data-testid="tabs-kniznica">
          <TabsTrigger value="parameters" data-testid="tab-parameters">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Parametre
          </TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections">
            <Layers className="w-3.5 h-3.5 mr-1" />
            Sekcie & Panely
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <LayoutTemplate className="w-3.5 h-3.5 mr-1" />
            Šablóny
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parameters" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať parameter..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => { setEditParam(null); setIsParamDialogOpen(true); }}
              data-testid="button-add-param"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nový parameter
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
                              <div className={`w-2 h-2 rounded-full ${p.isActive ? "bg-green-500" : "bg-red-500"}`} />
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => {
                                    if (confirm("Naozaj vymazať tento parameter?")) {
                                      deleteParamMutation.mutate(p.id);
                                    }
                                  }}
                                  data-testid={`button-delete-param-${p.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
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
              data-testid="button-add-section"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nová sekcia/panel
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
                        <Badge variant="secondary" className="text-[10px]">
                          {childPanels.length} panelov
                        </Badge>
                        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => { setEditSection(folder); setIsSectionDialogOpen(true); }}
                            data-testid={`button-edit-section-${folder.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (confirm("Vymazať sekciu?")) deleteSectionMutation.mutate(folder.id);
                            }}
                            data-testid={`button-delete-section-${folder.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-3 px-4">
                        <div className="space-y-2 ml-6">
                          {childPanels.map(panel => {
                            const panelParams = parameters.filter(p => p.panelId === panel.id);
                            return (
                              <div key={panel.id} className="border rounded p-3" data-testid={`panel-${panel.id}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{panel.name}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {panelParams.length} polí
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    Grid: {panel.gridColumns} stĺpce
                                  </span>
                                  <div className="ml-auto flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => { setEditSection(panel); setIsSectionDialogOpen(true); }}
                                      data-testid={`button-edit-panel-${panel.id}`}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => {
                                        if (confirm("Vymazať panel?")) deleteSectionMutation.mutate(panel.id);
                                      }}
                                      data-testid={`button-delete-panel-${panel.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (confirm("Vymazať šablónu?")) deleteTemplateMutation.mutate(tmpl.id);
                            }}
                            data-testid={`button-delete-template-${tmpl.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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

              {bindingTemplateId && (
                <Card data-testid="template-bindings-panel">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">
                      Parametre šablóny: {templates.find(t => t.id === bindingTemplateId)?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3 px-4 space-y-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Parameter</TableHead>
                          <TableHead className="text-xs">Platné od</TableHead>
                          <TableHead className="text-xs">Platné do</TableHead>
                          <TableHead className="text-xs w-20">Akcie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templateParams.map(tp => {
                          const param = parameters.find(p => p.id === tp.parameterId);
                          return (
                            <TableRow key={tp.id} data-testid={`row-binding-${tp.id}`}>
                              <TableCell className="text-xs">{param?.label || `ID ${tp.parameterId}`}</TableCell>
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
                        {templateParams.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-xs text-muted-foreground text-center">
                              Žiadne parametre priradené
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

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
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ParameterDialog
        open={isParamDialogOpen}
        onOpenChange={setIsParamDialogOpen}
        editParam={editParam}
        sections={sections}
        onSave={(data) => saveParamMutation.mutate(data)}
        isPending={saveParamMutation.isPending}
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
    </div>
  );
}

function ParameterDialog({
  open,
  onOpenChange,
  editParam,
  sections,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editParam: SubjectParameter | null;
  sections: SubjectParamSection[];
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [fieldType, setFieldType] = useState("short_text");
  const [isRequired, setIsRequired] = useState(false);
  const [clientTypeId, setClientTypeId] = useState("1");
  const [sectionId, setSectionId] = useState<string>("");
  const [panelId, setPanelId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [rowNumber, setRowNumber] = useState("0");
  const [widthPercent, setWidthPercent] = useState("100");
  const [optionsStr, setOptionsStr] = useState("");
  const [unit, setUnit] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");

  const resetForm = () => {
    if (editParam) {
      setFieldKey(editParam.fieldKey);
      setLabel(editParam.label);
      setShortLabel(editParam.shortLabel || "");
      setFieldType(editParam.fieldType);
      setIsRequired(editParam.isRequired);
      setClientTypeId(String(editParam.clientTypeId));
      setSectionId(editParam.sectionId ? String(editParam.sectionId) : "");
      setPanelId(editParam.panelId ? String(editParam.panelId) : "");
      setSortOrder(String(editParam.sortOrder));
      setRowNumber(String(editParam.rowNumber));
      setWidthPercent(String(editParam.widthPercent));
      setOptionsStr(editParam.options?.join(", ") || "");
      setUnit(editParam.unit || "");
      setDecimalPlaces(String(editParam.decimalPlaces));
    } else {
      setFieldKey("");
      setLabel("");
      setShortLabel("");
      setFieldType("short_text");
      setIsRequired(false);
      setClientTypeId("1");
      setSectionId("");
      setPanelId("");
      setSortOrder("0");
      setRowNumber("0");
      setWidthPercent("100");
      setOptionsStr("");
      setUnit("");
      setDecimalPlaces("2");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (v) resetForm();
    onOpenChange(v);
  };

  const filteredSections = sections.filter(s => s.clientTypeId === Number(clientTypeId) && !s.isPanel);
  const filteredPanels = sections.filter(s => s.clientTypeId === Number(clientTypeId) && s.isPanel);

  const handleSubmit = () => {
    if (!fieldKey || !label) return;
    const data: any = {
      fieldKey,
      label,
      shortLabel: shortLabel || null,
      fieldType,
      isRequired,
      clientTypeId: Number(clientTypeId),
      sectionId: sectionId ? Number(sectionId) : null,
      panelId: panelId ? Number(panelId) : null,
      sortOrder: Number(sortOrder),
      rowNumber: Number(rowNumber),
      widthPercent: Number(widthPercent),
      options: optionsStr ? optionsStr.split(",").map(o => o.trim()).filter(Boolean) : [],
      unit: unit || null,
      decimalPlaces: Number(decimalPlaces),
      isHidden: false,
      fieldCategory: "povinne",
      defaultValue: null,
      visibilityRule: null,
      categoryCode: null,
    };
    if (editParam) data.id = editParam.id;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editParam ? "Upraviť parameter" : "Nový parameter"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Kľúč poľa *</Label>
            <Input
              value={fieldKey}
              onChange={e => setFieldKey(e.target.value)}
              placeholder="napr. meno, rodne_cislo"
              disabled={!!editParam}
              data-testid="input-field-key"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Názov (label) *</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Meno klienta"
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
            <Select value={sectionId} onValueChange={setSectionId}>
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
            <Label>Panel</Label>
            <Select value={panelId} onValueChange={setPanelId}>
              <SelectTrigger data-testid="select-panel">
                <SelectValue placeholder="Vybrať panel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Žiadny</SelectItem>
                {filteredPanels.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={isRequired}
              onCheckedChange={setIsRequired}
              data-testid="switch-required"
            />
            <Label>Povinné pole</Label>
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
            <div className="col-span-2 space-y-1.5">
              <Label>Možnosti (oddelené čiarkou)</Label>
              <Input
                value={optionsStr}
                onChange={e => setOptionsStr(e.target.value)}
                placeholder="Možnosť 1, Možnosť 2, ..."
                data-testid="input-options"
              />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-param">
            Zrušiť
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !fieldKey || !label}
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
      setIsPanel(editSection.isPanel);
      setParentSectionId(editSection.parentSectionId ? String(editSection.parentSectionId) : "");
      setSortOrder(String(editSection.sortOrder));
      setGridColumns(String(editSection.gridColumns));
      setIcon(editSection.icon || "");
    } else {
      setName("");
      setCode("");
      setClientTypeId("1");
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

  const handleSubmit = () => {
    if (!name || !code) return;
    const data: any = {
      name,
      code,
      clientTypeId: Number(clientTypeId),
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
          <div className="space-y-1.5">
            <Label>Názov *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-section-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Kód *</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} disabled={!!editSection} data-testid="input-section-code" />
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
          {isPanel && (
            <div className="col-span-2 space-y-1.5">
              <Label>Nadradená sekcia</Label>
              <Select value={parentSectionId} onValueChange={setParentSectionId}>
                <SelectTrigger data-testid="select-parent-section"><SelectValue placeholder="Vybrať..." /></SelectTrigger>
                <SelectContent>
                  {folderSections.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button onClick={handleSubmit} disabled={isPending || !name || !code} data-testid="button-save-section">
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
    if (!name || !code) return;
    const data: any = { name, code, description: description || null, isDefault, isActive };
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
          <div className="space-y-1.5">
            <Label>Názov *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-template-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Kód *</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} disabled={!!editTemplate} data-testid="input-template-code" />
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
          <Button onClick={handleSubmit} disabled={isPending || !name || !code} data-testid="button-save-template">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editTemplate ? "Uložiť zmeny" : "Vytvoriť"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
