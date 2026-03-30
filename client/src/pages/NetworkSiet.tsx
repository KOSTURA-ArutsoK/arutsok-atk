import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeSlovak, formatUid } from "@/lib/utils";
import { RelationGraph } from "@/components/RelationGraph";
import {
  Network, Users, Shield, Snowflake, ArrowRightLeft,
  Check, X, Clock, Search, ChevronDown, ChevronRight,
  UserCheck, AlertTriangle, Eye, Loader2, Link2, Plus, Archive, GitBranch
} from "lucide-react";

type NetworkSubject = {
  id: number;
  uid: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string | null;
  registrationStatus?: string | null;
  lifecycleStatus?: string | null;
  isActive?: boolean;
  isOfficer?: boolean;
};

type NetworkLink = {
  id: number;
  subjectId: number;
  guarantorSubjectId: number;
  linkType: string;
  phase: string;
  sourceContractId: number | null;
  roleOnContract: string | null;
  isFrozenAt: string | null;
  frozenReason: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  isActive: boolean;
  createdAt: string;
};

type TransferRequest = {
  id: number;
  subjectId: number;
  currentGuarantorId: number;
  requestedGuarantorId: number;
  status: string;
  reason: string;
  requestedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

function getSubjectName(s: NetworkSubject | undefined): string {
  if (!s) return "—";
  if (s.type === "system") return s.companyName || "ArutsoK - ATK";
  if (s.type === "company" || s.type === "mycompany" || s.type === "partner") return s.companyName || "—";
  return `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—";
}

function subjectTypeBadge(type: string | null) {
  switch (type) {
    case "person":
      return <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0">FO</Badge>;
    case "szco":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">SZČO</Badge>;
    case "company":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">PO</Badge>;
    case "mycompany":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">MC</Badge>;
    case "partner":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5 py-0">PTN</Badge>;
    case "ts":
      return <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 text-[10px] px-1.5 py-0">TS</Badge>;
    case "vs":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">VS</Badge>;
    case "system":
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px] px-1.5 py-0">SYS</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{type || "?"}</Badge>;
  }
}


function linkTypeBadge(linkType: string) {
  switch (linkType) {
    case "active":
      return <Badge data-testid="badge-link-active" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Aktívny</Badge>;
    case "frozen":
      return <Badge data-testid="badge-link-frozen" className="bg-sky-500/20 text-sky-400 border-sky-500/30"><Snowflake className="w-3 h-3 mr-1" />Zamrznutý</Badge>;
    case "historical":
      return <Badge data-testid="badge-link-historical" className="bg-muted text-muted-foreground border-border">Historický</Badge>;
    default:
      return <Badge>{linkType}</Badge>;
  }
}

function phaseBadge(phase: string) {
  switch (phase) {
    case "klient":
      return <Badge data-testid="badge-phase-klient" variant="outline" className="text-amber-400 border-amber-500/30">Klient</Badge>;
    case "tiper":
      return <Badge data-testid="badge-phase-tiper" variant="outline" className="text-purple-400 border-purple-500/30">Tipér</Badge>;
    case "specialist":
      return <Badge data-testid="badge-phase-specialist" variant="outline" className="text-blue-400 border-blue-500/30">Špecialista</Badge>;
    default:
      return <Badge variant="outline">{phase}</Badge>;
  }
}

function transferStatusBadge(status: string) {
  switch (status) {
    case "pending_all_approvals":
      return <Badge data-testid="badge-transfer-pending" className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Čaká na schválenie</Badge>;
    case "approved":
      return <Badge data-testid="badge-transfer-approved" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Check className="w-3 h-3 mr-1" />Schválený</Badge>;
    case "rejected":
      return <Badge data-testid="badge-transfer-rejected" className="bg-red-500/20 text-red-400 border-red-500/30"><X className="w-3 h-3 mr-1" />Zamietnutý</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

type EnrichedEntityLink = {
  id: number;
  sourceId: number;
  targetId: number;
  relationType: string;
  label: string | null;
  validFrom: string | null;
  validTo: string | null;
  isArchived: boolean;
  source: { id: number; uid: string | null; type: string | null; firstName: string | null; lastName: string | null; companyName: string | null } | null;
  target: { id: number; uid: string | null; type: string | null; firstName: string | null; lastName: string | null; companyName: string | null } | null;
};

const RELATION_TYPES = [
  { value: "digital_portal_for", label: "Digitálny portál pre" },
  { value: "official_owner", label: "Officiálny vlastník" },
  { value: "sponsor_guardian", label: "Sponzor / Opatrovník" },
  { value: "beneficiary_owner", label: "Konečný vlastník" },
  { value: "parent_child", label: "Rodič / Dieťa" },
  { value: "employer_employee", label: "Zamestnávateľ / Zamestnanec" },
  { value: "shareholder", label: "Akcionár" },
  { value: "statutory_officer", label: "Štatutár" },
  { value: "contract_manager", label: "Správca zmluvy" },
  { value: "referrer_primary", label: "Primárny odporúčateľ" },
  { value: "referrer_stack", label: "Reťazec odporúčateľov" },
  { value: "responsible_specialist", label: "Zodpovedný špecialista" },
  { value: "referral_source", label: "Zdroj odporúčania" },
  { value: "custom", label: "Vlastný typ" },
];

export default function NetworkSiet() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [linkTypeFilter, setLinkTypeFilter] = useState<string>("all");
  const [transferTab, setTransferTab] = useState("pending_all_approvals");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({ subjectId: "", currentGuarantorId: "", requestedGuarantorId: "", reason: "" });
  const [showGuarantorDialog, setShowGuarantorDialog] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({ subjectId: 0, chosenGuarantorId: 0 });
  const [reviewDialog, setReviewDialog] = useState<{ id: number; action: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  const [graphSelectedNodeId, setGraphSelectedNodeId] = useState<number | null>(null);
  const [graphRelationTypeFilter, setGraphRelationTypeFilter] = useState("all");
  const [graphArchivedFilter, setGraphArchivedFilter] = useState("active");
  const [graphSubjectSearch, setGraphSubjectSearch] = useState("");
  const [showAddLinkPanel, setShowAddLinkPanel] = useState(false);
  const [addLinkForm, setAddLinkForm] = useState({
    sourceSearch: "",
    targetSearch: "",
    sourceId: null as number | null,
    targetId: null as number | null,
    relationType: "custom",
    label: "",
    validFrom: "",
    validTo: "",
  });
  const [sourceResults, setSourceResults] = useState<NetworkSubject[]>([]);
  const [targetResults, setTargetResults] = useState<NetworkSubject[]>([]);
  const [sourceDropdown, setSourceDropdown] = useState(false);
  const [targetDropdown, setTargetDropdown] = useState(false);

  const { data: networkData, isLoading: loadingTree } = useQuery<{ root: any; links: NetworkLink[]; subjects: NetworkSubject[]; personalSubjectId?: number | null; officerSubjectIds?: number[] }>({
    queryKey: ["/api/network/tree", appUser?.id, appUser?.activeKtoCompanyId, appUser?.activeCompanyId],
    queryFn: () => fetch("/api/network/tree", { credentials: "include" }).then(r => r.json()),
    enabled: !!appUser,
  });

  // Auto-expand the path from the tree root to the logged-in user's personal node
  useEffect(() => {
    if (!networkData?.links || !networkData.personalSubjectId) return;
    const pid = networkData.personalSubjectId;
    const parentMap = new Map<number, number>();
    for (const link of networkData.links) {
      parentMap.set(link.subjectId, link.guarantorSubjectId);
    }
    const ancestorIds = new Set<number>();
    let cur = pid;
    while (parentMap.has(cur)) {
      const parent = parentMap.get(cur)!;
      ancestorIds.add(parent);
      cur = parent;
    }
    if (ancestorIds.size > 0) {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        ancestorIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [networkData?.personalSubjectId, networkData?.links]);

  const { data: transferData, isLoading: loadingTransfers } = useQuery<{ requests: TransferRequest[]; subjects: NetworkSubject[] }>({
    queryKey: ["/api/network/transfer-requests", transferTab],
    queryFn: () => fetch(`/api/network/transfer-requests?status=${transferTab}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: acquirerData } = useQuery<{ subjectId: number; contracts: any[]; acquirers: NetworkSubject[] }>({
    queryKey: ["/api/network/subject-acquirers", selectedSubjectId],
    queryFn: () => fetch(`/api/network/subject-acquirers/${selectedSubjectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedSubjectId && showGuarantorDialog,
  });

  const confirmGuarantorMutation = useMutation({
    mutationFn: (data: { subjectId: number; chosenGuarantorId: number }) =>
      apiRequest("POST", "/api/network/confirm-guarantor", data),
    onSuccess: () => {
      toast({ title: "Garant potvrdený", description: "Prepojenie bolo zamrznuté pre ostatných získateľov" });
      queryClient.invalidateQueries({ queryKey: ["/api/network/tree"] });
      setShowGuarantorDialog(false);
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/network/transfer-requests", data),
    onSuccess: () => {
      toast({ title: "Žiadosť odoslaná", description: "Prestupový protokol bol vytvorený" });
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      setShowTransferDialog(false);
      setTransferForm({ subjectId: "", currentGuarantorId: "", requestedGuarantorId: "", reason: "" });
    },
  });

  const reviewTransferMutation = useMutation({
    mutationFn: (data: { id: number; status: string; reviewNote: string }) =>
      apiRequest("PATCH", `/api/network/transfer-requests/${data.id}`, { status: data.status, reviewNote: data.reviewNote }),
    onSuccess: () => {
      toast({ title: "Žiadosť spracovaná" });
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/tree"] });
      setReviewDialog(null);
      setReviewNote("");
    },
  });

  const entityLinksQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (graphRelationTypeFilter !== "all") params.set("relationType", graphRelationTypeFilter);
    if (graphArchivedFilter !== "all") params.set("isArchived", graphArchivedFilter === "archived" ? "true" : "false");
    return params.toString();
  }, [graphRelationTypeFilter, graphArchivedFilter]);

  const { data: entityLinksData, isLoading: loadingEntityLinks } = useQuery<EnrichedEntityLink[]>({
    queryKey: ["/api/entity-links", graphRelationTypeFilter, graphArchivedFilter],
    queryFn: () => fetch(`/api/entity-links?${entityLinksQueryParams}`, { credentials: "include" }).then(r => r.json()),
  });

  const createEntityLinkMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/entity-links", data),
    onSuccess: () => {
      toast({ title: "Prepojenie vytvorené" });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-links"] });
      setShowAddLinkPanel(false);
      setAddLinkForm({ sourceSearch: "", targetSearch: "", sourceId: null, targetId: null, relationType: "custom", label: "", validFrom: "", validTo: "" });
      setSourceResults([]);
      setTargetResults([]);
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvoriť prepojenie", variant: "destructive" });
    },
  });

  const archiveEntityLinkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/entity-links/${id}`, { isArchived: true }),
    onSuccess: () => {
      toast({ title: "Prepojenie archivované" });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-links"] });
    },
  });

  const searchSubjectsForGraph = useCallback(async (term: string, which: "source" | "target") => {
    if (!term || term.length < 2) {
      if (which === "source") setSourceResults([]);
      else setTargetResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/subjects?search=${encodeURIComponent(term)}&limit=8`, { credentials: "include" });
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.subjects || data.data || []);
      if (which === "source") { setSourceResults(items); setSourceDropdown(true); }
      else { setTargetResults(items); setTargetDropdown(true); }
    } catch { /* ignore */ }
  }, []);

  const filteredEntityLinks = useMemo(() => {
    if (!entityLinksData) return [];
    if (!graphSubjectSearch) return entityLinksData;
    const term = graphSubjectSearch.toLowerCase();
    return entityLinksData.filter(l => {
      const sn = l.source ? `${l.source.firstName || ""} ${l.source.lastName || ""} ${l.source.companyName || ""}`.toLowerCase() : "";
      const tn = l.target ? `${l.target.firstName || ""} ${l.target.lastName || ""} ${l.target.companyName || ""}`.toLowerCase() : "";
      return sn.includes(term) || tn.includes(term);
    });
  }, [entityLinksData, graphSubjectSearch]);

  const graphSelectedNode = useMemo(() => {
    if (!graphSelectedNodeId || !entityLinksData) return null;
    const allLinks = entityLinksData.filter(l => l.sourceId === graphSelectedNodeId || l.targetId === graphSelectedNodeId);
    const subject = allLinks[0]?.source?.id === graphSelectedNodeId ? allLinks[0]?.source : allLinks[0]?.target;
    return { subject, links: allLinks };
  }, [graphSelectedNodeId, entityLinksData]);

  const subjectMap = useMemo(() => {
    const map = new Map<number, NetworkSubject>();
    networkData?.subjects?.forEach(s => map.set(s.id, s));
    return map;
  }, [networkData?.subjects]);

  const treeData = useMemo(() => {
    if (!networkData?.links) return { childrenMap: new Map(), linkedSubjectIds: new Set<number>(), orphanRootIds: [] as number[] };
    const links = networkData.links;

    const childrenMap = new Map<number, { link: NetworkLink; subject: NetworkSubject }[]>();
    const linkedSubjectIds = new Set<number>();
    const guarantorIds = new Set<number>();

    links.forEach(link => {
      linkedSubjectIds.add(link.subjectId);
      guarantorIds.add(link.guarantorSubjectId);
      const guarantorId = link.guarantorSubjectId;
      const subject = subjectMap.get(link.subjectId);
      if (!subject) return;
      if (!childrenMap.has(guarantorId)) childrenMap.set(guarantorId, []);
      childrenMap.get(guarantorId)!.push({ link, subject });
    });

    // Orphan root: guarantor that is not itself a child in any link (not in linkedSubjectIds)
    // and is not the system root — these are disconnected subtree roots
    const rootId = networkData?.root?.id;
    const orphanRootIds = [...guarantorIds].filter(gid =>
      gid !== rootId && !linkedSubjectIds.has(gid)
    );

    return { childrenMap, linkedSubjectIds, orphanRootIds };
  }, [networkData?.links, networkData?.root?.id, subjectMap]);

  const unlinkedSubjects = useMemo(() => {
    if (!networkData?.subjects) return [];
    return networkData.subjects.filter(s =>
      s.id !== networkData?.root?.id &&
      !treeData.linkedSubjectIds?.has(s.id) &&
      !treeData.orphanRootIds?.includes(s.id)
    );
  }, [networkData?.subjects, networkData?.root?.id, treeData]);

  const filteredLinks = useMemo(() => {
    if (!networkData?.links) return [];
    let links = networkData.links;
    if (linkTypeFilter !== "all") {
      links = links.filter(l => l.linkType === linkTypeFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      links = links.filter(l => {
        const s = subjectMap.get(l.subjectId);
        const g = subjectMap.get(l.guarantorSubjectId);
        return getSubjectName(s).toLowerCase().includes(term) || getSubjectName(g).toLowerCase().includes(term);
      });
    }
    return links;
  }, [networkData?.links, linkTypeFilter, searchTerm, subjectMap]);

  const stats = useMemo(() => {
    if (!networkData?.links) return { active: 0, frozen: 0, total: 0, subjects: 0 };
    return {
      active: networkData.links.filter(l => l.linkType === "active").length,
      frozen: networkData.links.filter(l => l.linkType === "frozen").length,
      total: networkData.links.length,
      subjects: networkData.subjects?.length || 0,
    };
  }, [networkData]);

  const toggleNode = useCallback((id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const personalSubjectId = networkData?.personalSubjectId ?? null;

  const renderTreeNode = useCallback((subjectId: number, depth: number = 0, link?: NetworkLink): JSX.Element | null => {
    const subject = subjectMap.get(subjectId);
    if (!subject) return null;
    const children = treeData.childrenMap?.get(subjectId) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(subjectId);
    const isPersonal = personalSubjectId != null && subjectId === personalSubjectId;

    return (
      <div key={subjectId} className="select-none" style={{ marginLeft: depth * 24 }}>
        <div
          className={`flex items-center gap-3 py-1 px-2 rounded cursor-pointer group ${isPersonal ? "bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15" : "hover:bg-accent/50"}`}
          onClick={() => hasChildren && toggleNode(subjectId)}
          data-testid={`tree-node-${subjectId}`}
        >
          {/* expand chevron */}
          <div className="w-4 shrink-0">
            {hasChildren
              ? (isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />)
              : null}
          </div>
          {/* status dot */}
          <div className={`w-2 h-2 rounded-full shrink-0 ${subject.registrationStatus === "klient" ? "bg-amber-400" : subject.registrationStatus === "tiper" ? "bg-purple-400" : "bg-muted-foreground"}`} />
          {/* name */}
          <span className={`text-sm min-w-[180px] ${isPersonal ? "font-bold text-blue-600 dark:text-blue-400" : "font-medium text-foreground"}`}>{getSubjectName(subject)}</span>
          {/* uid – fixed width mono so columns align */}
          <span className="text-xs font-mono text-muted-foreground w-[148px] shrink-0">{formatUid(subject.uid)}</span>
          {/* badges from parent link */}
          {link && <div className="flex items-center gap-1.5 shrink-0">{linkTypeBadge(link.linkType)}{phaseBadge(link.phase)}</div>}
          {/* personal indicator */}
          {isPersonal && <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 ml-1">Ja</Badge>}
          {/* children count */}
          {hasChildren && <span className="text-xs text-muted-foreground/50 ml-auto">{children.length}</span>}
        </div>
        {isExpanded && children.map(({ link: childLink, subject: child }) => (
          renderTreeNode(child.id, depth + 1, childLink)
        ))}
      </div>
    );
  }, [subjectMap, treeData, expandedNodes, toggleNode, personalSubjectId]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="page-title-siet">Sieť (ATK)</h1>
            <p className="text-sm text-muted-foreground">Pavúk prepojení pod koreňom 421 000 000 000 000</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransferDialog(true)}
            data-testid="btn-new-transfer"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            Prestupový protokol
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Subjekty v sieti</span>
            </div>
            <p className="text-2xl font-bold text-foreground" data-testid="stat-subjects">{stats.subjects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Aktívne prepojenia</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400" data-testid="stat-active">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Snowflake className="w-4 h-4 text-sky-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Zamrznuté</span>
            </div>
            <p className="text-2xl font-bold text-sky-400" data-testid="stat-frozen">{stats.frozen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Celkom prepojení</span>
            </div>
            <p className="text-2xl font-bold text-foreground" data-testid="stat-total">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="tree" data-testid="tab-tree">
            <Network className="w-4 h-4 mr-1" />Strom siete
          </TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">
            <Users className="w-4 h-4 mr-1" />Zoznam prepojení
          </TabsTrigger>
          <TabsTrigger value="uids" data-testid="tab-uids">
            <Shield className="w-4 h-4 mr-1" />Register entít
          </TabsTrigger>
          <TabsTrigger value="transfers" data-testid="tab-transfers">
            <ArrowRightLeft className="w-4 h-4 mr-1" />Prestupové protokoly
          </TabsTrigger>
          <TabsTrigger value="relation-graph" data-testid="tab-relation-graph">
            <GitBranch className="w-4 h-4 mr-1" />Sieť vzťahov
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Hierarchia siete — koreň 421 000 000 000 000
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTree ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : networkData?.root ? (
                <div className="font-mono text-sm space-y-1">
                  {renderTreeNode(networkData.root.id)}
                  {(!treeData.childrenMap || treeData.childrenMap.size === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Sieť zatiaľ nemá žiadne prepojenia</p>
                      <p className="text-xs mt-1">Prepojenia vznikajú automaticky z Dátovej linky alebo manuálne</p>
                    </div>
                  )}
                  {/* Sirotské podstromy — garantori bez napojenia na koreň */}
                  {treeData.orphanRootIds && treeData.orphanRootIds.length > 0 && (
                    <div className="mt-4 border-t border-dashed border-amber-500/20 pt-3">
                      <div className="flex items-center gap-2 px-2 py-1 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Odpojené podstromy</span>
                      </div>
                      {treeData.orphanRootIds.map(oid => renderTreeNode(oid, 1))}
                    </div>
                  )}
                  {/* Nepripojení — subjekty bez akejkoľvek linky */}
                  {unlinkedSubjects.length > 0 && (
                    <div className="mt-4 border-t border-dashed border-muted/30 pt-3">
                      <div className="flex items-center gap-2 px-2 py-1 mb-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Nepripojení ({unlinkedSubjects.length})</span>
                      </div>
                      {unlinkedSubjects.map(s => (
                        <div key={s.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-accent/50" style={{ marginLeft: 24 }}>
                          <div className="w-4 shrink-0" />
                          <div className={`w-2 h-2 rounded-full shrink-0 ${s.registrationStatus === "klient" ? "bg-amber-400" : s.registrationStatus === "tiper" ? "bg-purple-400" : "bg-muted-foreground"}`} />
                          <span className="text-sm font-medium text-foreground min-w-[180px]">{getSubjectName(s)}</span>
                          <span className="text-xs font-mono text-muted-foreground w-[148px] shrink-0">{formatUid(s.uid)}</span>
                          <div className="flex items-center gap-1">{subjectTypeBadge(s.type)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Koreňový subjekt 421 000 000 000 000 nenájdený</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">Všetky prepojenia</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Hľadať..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64 text-sm"
                      data-testid="input-search-links"
                    />
                  </div>
                  <Select value={linkTypeFilter} onValueChange={setLinkTypeFilter}>
                    <SelectTrigger className="w-40 text-sm" data-testid="select-link-type-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky typy</SelectItem>
                      <SelectItem value="active">Aktívne</SelectItem>
                      <SelectItem value="frozen">Zamrznuté</SelectItem>
                      <SelectItem value="historical">Historické</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Žiadne prepojenia</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <div className="col-span-3">Subjekt</div>
                    <div className="col-span-3">Garant/Získateľ</div>
                    <div className="col-span-1">Typ</div>
                    <div className="col-span-1">Fáza</div>
                    <div className="col-span-1">Rola</div>
                    <div className="col-span-2">Dátum</div>
                    <div className="col-span-1">Akcie</div>
                  </div>
                  {filteredLinks.map(link => {
                    const subject = subjectMap.get(link.subjectId);
                    const guarantor = subjectMap.get(link.guarantorSubjectId);
                    return (
                      <div
                        key={link.id}
                        className="grid grid-cols-12 gap-2 px-3 py-2 text-sm rounded hover:bg-accent/50 items-center"
                        data-testid={`link-row-${link.id}`}
                      >
                        <div className="col-span-3">
                          <span className="text-foreground">{getSubjectName(subject)}</span>
                          <span className="text-xs text-muted-foreground ml-1">{formatUid(subject?.uid || null)}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-foreground">{getSubjectName(guarantor)}</span>
                          <span className="text-xs text-muted-foreground ml-1">{formatUid(guarantor?.uid || null)}</span>
                        </div>
                        <div className="col-span-1">{linkTypeBadge(link.linkType)}</div>
                        <div className="col-span-1">{phaseBadge(link.phase)}</div>
                        <div className="col-span-1 text-xs text-muted-foreground">{link.roleOnContract || "—"}</div>
                        <div className="col-span-2 text-xs text-muted-foreground">{formatDateTimeSlovak(link.createdAt)}</div>
                        <div className="col-span-1">
                          {link.linkType === "frozen" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-amber-400 hover:text-amber-300"
                              onClick={() => {
                                setTransferForm({
                                  subjectId: String(link.subjectId),
                                  currentGuarantorId: String(link.guarantorSubjectId),
                                  requestedGuarantorId: "",
                                  reason: "",
                                });
                                setShowTransferDialog(true);
                              }}
                              data-testid={`btn-unfreeze-${link.id}`}
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </Button>
                          )}
                          {link.linkType === "active" && link.phase === "klient" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-400 hover:text-emerald-300"
                              onClick={() => {
                                setSelectedSubjectId(link.subjectId);
                                setGuarantorForm({ subjectId: link.subjectId, chosenGuarantorId: 0 });
                                setShowGuarantorDialog(true);
                              }}
                              data-testid={`btn-confirm-guarantor-${link.id}`}
                            >
                              <UserCheck className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uids">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Register entít — subjekty, partneri, vlastné spoločnosti
                </CardTitle>
                <span className="text-xs text-muted-foreground">{networkData?.subjects?.length ?? 0} záznamov</span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTree ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
<div className="space-y-1">
                  <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-card">
                    <div className="col-span-4">UID</div>
                    <div className="col-span-2">Typ</div>
                    <div className="col-span-3">Meno / Názov</div>
                    <div className="col-span-3">Štítky</div>
                  </div>

                  {(() => {
                    type S = NonNullable<typeof networkData>["subjects"][0];
                    const sorted = [...(networkData?.subjects || [])].sort((a: S, b: S) => {
                      const ua = a.uid || "zzz";
                      const ub = b.uid || "zzz";
                      return ua.localeCompare(ub);
                    });
                    // group consecutive rows by uid; null uid = individual row
                    const groups: { uid: string | null; items: S[] }[] = [];
                    sorted.forEach((s: S) => {
                      if (!s.uid) { groups.push({ uid: null, items: [s] }); return; }
                      const last = groups[groups.length - 1];
                      if (last && last.uid === s.uid) last.items.push(s);
                      else groups.push({ uid: s.uid, items: [s] });
                    });

                    return groups.map((group, gi) => {
                      const isShared = group.items.length > 1;
                      // collect unique types and all badges across group
                      const uniqueTypes = [...new Set(group.items.map((s: S) => s.type))];
                      const names = [...new Set(group.items.map((s: S) => getSubjectName(s)).filter(Boolean))];
                      const hasKlient = group.items.some((s: S) => s.registrationStatus === "klient");
                      const hasTiper = group.items.some((s: S) => s.registrationStatus === "tiper");
                      const hasPotenc = group.items.some((s: S) => s.registrationStatus === "potencialny");
                      const hasOfficer = group.items.some((s: S) => s.isOfficer);
                      const hasMyCompany = uniqueTypes.includes("mycompany");
                      const hasPartner = uniqueTypes.includes("partner");
                      const hasSystem = uniqueTypes.includes("system");

                      return (
                        <div
                          key={`g-${gi}`}
                          className="grid grid-cols-12 gap-2 px-3 py-2 text-sm rounded hover:bg-accent/50 items-center"
                          data-testid={isShared ? `uid-group-${group.uid}` : `uid-row-${group.items[0].id}`}
                        >
                          {/* UID — first */}
                          <div className="col-span-4 font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                            {group.uid
                              ? formatUid(group.uid)
                              : <span className="text-muted-foreground/40 italic">bez UID</span>}
                            {isShared && <Link2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                          </div>
                          {/* Type(s) */}
                          <div className="col-span-2 flex flex-wrap gap-1">
                            {uniqueTypes.map((t: string) => <span key={t}>{subjectTypeBadge(t)}</span>)}
                          </div>
                          {/* Name(s) */}
                          <div className="col-span-3 font-medium text-foreground text-xs">
                            {names.join(" / ") || "—"}
                          </div>
                          {/* Badges — all combined */}
                          <div className="col-span-3 flex flex-wrap gap-1">
                            {hasKlient && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">Klient</Badge>}
                            {hasTiper && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0">Tipér</Badge>}
                            {hasPotenc && <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] px-1.5 py-0">Potenciálny</Badge>}
                            {hasOfficer && <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[10px] px-1.5 py-0">Štatutár</Badge>}
                            {hasMyCompany && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">Vlastná spol.</Badge>}
                            {hasPartner && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5 py-0">Partner</Badge>}
                            {hasSystem && <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px] px-1.5 py-0">Systém</Badge>}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {!networkData?.subjects?.length && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Žiadne záznamy</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">Prestupové protokoly</CardTitle>
                <div className="flex gap-1">
                  {["pending_all_approvals", "approved", "rejected"].map(s => (
                    <Button
                      key={s}
                      variant={transferTab === s ? "default" : "ghost"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setTransferTab(s)}
                      data-testid={`btn-transfer-tab-${s}`}
                    >
                      {s === "pending_all_approvals" ? "Čakajúce" : s === "approved" ? "Schválené" : "Zamietnuté"}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs text-amber-400" asChild>
                    <Link href="/prestup">Detailný prehľad →</Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTransfers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !transferData?.requests?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Žiadne {transferTab === "pending_all_approvals" ? "čakajúce" : transferTab === "approved" ? "schválené" : "zamietnuté"} žiadosti</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transferData.requests.map(req => {
                    const transferSubjectMap = new Map<number, NetworkSubject>();
                    transferData.subjects?.forEach(s => transferSubjectMap.set(s.id, s));
                    const subj = transferSubjectMap.get(req.subjectId);
                    const curr = transferSubjectMap.get(req.currentGuarantorId);
                    const requested = transferSubjectMap.get(req.requestedGuarantorId);

                    return (
                      <div
                        key={req.id}
                        className="border border-border rounded-md p-4 space-y-2"
                        data-testid={`transfer-request-${req.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {transferStatusBadge(req.status)}
                            <span className="text-sm font-medium text-foreground">{getSubjectName(subj)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDateTimeSlovak(req.createdAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Aktuálny garant:</span>
                            <p className="text-foreground/80">{getSubjectName(curr)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Požadovaný garant:</span>
                            <p className="text-foreground/80">{getSubjectName(requested)}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Dôvod:</span>
                          <p className="text-sm text-foreground/70">{req.reason}</p>
                        </div>
                        {req.reviewNote && (
                          <div>
                            <span className="text-xs text-muted-foreground">Poznámka k rozhodnutiu:</span>
                            <p className="text-sm text-foreground/70">{req.reviewNote}</p>
                          </div>
                        )}
                        {req.reviewedByName && (
                          <p className="text-xs text-muted-foreground/60">Rozhodol: {req.reviewedByName} • {req.reviewedAt ? formatDateTimeSlovak(req.reviewedAt) : ""}</p>
                        )}
                        {req.status === "pending_all_approvals" && (
                          <div className="flex gap-2 pt-2 border-t border-border">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => setReviewDialog({ id: req.id, action: "approved" })}
                              data-testid={`btn-approve-${req.id}`}
                            >
                              <Check className="w-3 h-3 mr-1" />Schváliť
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setReviewDialog({ id: req.id, action: "rejected" })}
                              data-testid={`btn-reject-${req.id}`}
                            >
                              <X className="w-3 h-3 mr-1" />Zamietnuť
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relation-graph">
          <div className="flex gap-4">
            <div className="flex-1 min-w-0 space-y-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Graf vzťahov
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                        <Input
                          placeholder="Subjekt..."
                          value={graphSubjectSearch}
                          onChange={e => setGraphSubjectSearch(e.target.value)}
                          className="pl-7 w-40 text-xs h-8"
                          data-testid="input-graph-subject-search"
                        />
                      </div>
                      <Select value={graphRelationTypeFilter} onValueChange={setGraphRelationTypeFilter}>
                        <SelectTrigger className="w-44 text-xs h-8" data-testid="select-graph-relation-type">
                          <SelectValue placeholder="Typ vzťahu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Všetky typy</SelectItem>
                          {RELATION_TYPES.map(rt => (
                            <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={graphArchivedFilter} onValueChange={setGraphArchivedFilter}>
                        <SelectTrigger className="w-32 text-xs h-8" data-testid="select-graph-archived">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Všetky</SelectItem>
                          <SelectItem value="active">Aktívne</SelectItem>
                          <SelectItem value="archived">Archivované</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setShowAddLinkPanel(p => !p)}
                        data-testid="btn-add-link"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Pridať prepojenie
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {loadingEntityLinks ? (
                    <div className="flex items-center justify-center h-[500px]">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <RelationGraph
                      links={filteredEntityLinks}
                      onNodeClick={setGraphSelectedNodeId}
                      selectedNodeId={graphSelectedNodeId}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">Zoznam prepojení ({filteredEntityLinks.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredEntityLinks.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <GitBranch className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      Žiadne prepojenia
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredEntityLinks.map(link => {
                        const srcName = link.source ? `${link.source.firstName || ""} ${link.source.lastName || ""} ${link.source.companyName || ""}`.trim() : "?";
                        const tgtName = link.target ? `${link.target.firstName || ""} ${link.target.lastName || ""} ${link.target.companyName || ""}`.trim() : "?";
                        return (
                          <div
                            key={link.id}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm ${link.isArchived ? "opacity-50" : ""}`}
                            data-testid={`entity-link-row-${link.id}`}
                          >
                            <span className="text-foreground font-medium min-w-[120px] truncate">{srcName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">→</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                              {RELATION_TYPES.find(r => r.value === link.relationType)?.label || link.relationType}
                            </Badge>
                            <span className="text-xs text-muted-foreground shrink-0">→</span>
                            <span className="text-foreground min-w-[120px] truncate">{tgtName}</span>
                            {link.label && <span className="text-xs text-muted-foreground italic truncate">{link.label}</span>}
                            {link.isArchived && <Badge variant="outline" className="text-[10px] px-1.5 text-slate-400 border-slate-500/30 ml-auto shrink-0">Archív</Badge>}
                            {!link.isArchived && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground ml-auto shrink-0"
                                onClick={() => archiveEntityLinkMutation.mutate(link.id)}
                                disabled={archiveEntityLinkMutation.isPending}
                                data-testid={`btn-archive-link-${link.id}`}
                              >
                                <Archive className="w-3 h-3 mr-1" />
                                Archivovať
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {(showAddLinkPanel || graphSelectedNodeId) && (
              <div className="w-80 shrink-0 space-y-3">
                {showAddLinkPanel && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Plus className="w-4 h-4 text-indigo-400" />
                        Nové prepojenie
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Zdrojový subjekt</Label>
                        <div className="relative">
                          <Input
                            placeholder="Hľadať subjekt..."
                            value={addLinkForm.sourceSearch}
                            onChange={e => {
                              setAddLinkForm(p => ({ ...p, sourceSearch: e.target.value, sourceId: null }));
                              searchSubjectsForGraph(e.target.value, "source");
                            }}
                            className="text-xs"
                            data-testid="input-link-source"
                          />
                          {addLinkForm.sourceId && (
                            <div className="absolute right-2 top-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                          )}
                          {sourceDropdown && sourceResults.length > 0 && (
                            <div className="absolute z-20 w-full top-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                              {sourceResults.map((s: NetworkSubject) => (
                                <div
                                  key={s.id}
                                  className="px-3 py-2 text-xs hover:bg-accent cursor-pointer"
                                  onClick={() => {
                                    setAddLinkForm(p => ({ ...p, sourceId: s.id, sourceSearch: getSubjectName(s) }));
                                    setSourceDropdown(false);
                                  }}
                                  data-testid={`source-option-${s.id}`}
                                >
                                  {getSubjectName(s)}
                                  <span className="text-muted-foreground ml-1">{formatUid(s.uid)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Cieľový subjekt</Label>
                        <div className="relative">
                          <Input
                            placeholder="Hľadať subjekt..."
                            value={addLinkForm.targetSearch}
                            onChange={e => {
                              setAddLinkForm(p => ({ ...p, targetSearch: e.target.value, targetId: null }));
                              searchSubjectsForGraph(e.target.value, "target");
                            }}
                            className="text-xs"
                            data-testid="input-link-target"
                          />
                          {addLinkForm.targetId && (
                            <div className="absolute right-2 top-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                          )}
                          {targetDropdown && targetResults.length > 0 && (
                            <div className="absolute z-20 w-full top-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                              {targetResults.map((s: NetworkSubject) => (
                                <div
                                  key={s.id}
                                  className="px-3 py-2 text-xs hover:bg-accent cursor-pointer"
                                  onClick={() => {
                                    setAddLinkForm(p => ({ ...p, targetId: s.id, targetSearch: getSubjectName(s) }));
                                    setTargetDropdown(false);
                                  }}
                                  data-testid={`target-option-${s.id}`}
                                >
                                  {getSubjectName(s)}
                                  <span className="text-muted-foreground ml-1">{formatUid(s.uid)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Typ vzťahu</Label>
                        <Select
                          value={addLinkForm.relationType}
                          onValueChange={v => setAddLinkForm(p => ({ ...p, relationType: v }))}
                        >
                          <SelectTrigger className="text-xs" data-testid="select-link-relation-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATION_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Popis (voliteľný)</Label>
                        <Input
                          placeholder="Vlastný popis vzťahu..."
                          value={addLinkForm.label}
                          onChange={e => setAddLinkForm(p => ({ ...p, label: e.target.value }))}
                          className="text-xs"
                          data-testid="input-link-label"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Platné od</Label>
                          <Input
                            type="date"
                            value={addLinkForm.validFrom}
                            onChange={e => setAddLinkForm(p => ({ ...p, validFrom: e.target.value }))}
                            className="text-xs"
                            data-testid="input-link-valid-from"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Platné do</Label>
                          <Input
                            type="date"
                            value={addLinkForm.validTo}
                            onChange={e => setAddLinkForm(p => ({ ...p, validTo: e.target.value }))}
                            className="text-xs"
                            data-testid="input-link-valid-to"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setShowAddLinkPanel(false)}
                          data-testid="btn-link-cancel"
                        >
                          Zrušiť
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          disabled={!addLinkForm.sourceId || !addLinkForm.targetId || createEntityLinkMutation.isPending}
                          onClick={() => createEntityLinkMutation.mutate({
                            sourceId: addLinkForm.sourceId,
                            targetId: addLinkForm.targetId,
                            relationType: addLinkForm.relationType,
                            label: addLinkForm.label || null,
                            validFrom: addLinkForm.validFrom || undefined,
                            validTo: addLinkForm.validTo || undefined,
                          })}
                          data-testid="btn-link-submit"
                        >
                          {createEntityLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vytvoriť"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {graphSelectedNodeId && graphSelectedNode && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-400" />
                          Detail uzla
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGraphSelectedNodeId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {graphSelectedNode.subject && (
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getSubjectName(graphSelectedNode.subject as NetworkSubject)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatUid(graphSelectedNode.subject?.uid)}</p>
                          <p className="text-xs text-muted-foreground">{graphSelectedNode.subject?.type?.toUpperCase()}</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Prepojenia ({graphSelectedNode.links.length})</p>
                        {graphSelectedNode.links.map(link => {
                          const other = link.sourceId === graphSelectedNodeId ? link.target : link.source;
                          const isSource = link.sourceId === graphSelectedNodeId;
                          return (
                            <div key={link.id} className={`p-2 rounded border border-border text-xs ${link.isArchived ? "opacity-50" : ""}`} data-testid={`node-link-${link.id}`}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-muted-foreground">{isSource ? "→" : "←"}</span>
                                <span className="font-medium text-foreground">
                                  {other ? `${other.firstName || ""} ${other.lastName || ""} ${other.companyName || ""}`.trim() : "?"}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 mt-1">
                                {RELATION_TYPES.find(r => r.value === link.relationType)?.label || link.relationType}
                              </Badge>
                              {link.label && <p className="text-muted-foreground italic mt-1">{link.label}</p>}
                              {link.isArchived && <span className="text-slate-400"> — Archivované</span>}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              Prestupový protokol
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ID subjektu</label>
              <Input
                value={transferForm.subjectId}
                onChange={(e) => setTransferForm(p => ({ ...p, subjectId: e.target.value }))}
                placeholder="Zadajte ID subjektu"
                data-testid="input-transfer-subject"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ID aktuálneho garanta</label>
              <Input
                value={transferForm.currentGuarantorId}
                onChange={(e) => setTransferForm(p => ({ ...p, currentGuarantorId: e.target.value }))}
                placeholder="Zadajte ID garanta"
                data-testid="input-transfer-current"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ID požadovaného garanta</label>
              <Input
                value={transferForm.requestedGuarantorId}
                onChange={(e) => setTransferForm(p => ({ ...p, requestedGuarantorId: e.target.value }))}
                placeholder="Zadajte ID nového garanta"
                data-testid="input-transfer-requested"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dôvod zmeny</label>
              <Textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Popíšte dôvod žiadosti o zmenu garanta..."
                data-testid="input-transfer-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)} data-testid="btn-transfer-cancel">
              Zrušiť
            </Button>
            <Button
              onClick={() => createTransferMutation.mutate({
                subjectId: parseInt(transferForm.subjectId),
                currentGuarantorId: parseInt(transferForm.currentGuarantorId),
                requestedGuarantorId: parseInt(transferForm.requestedGuarantorId),
                reason: transferForm.reason,
              })}
              disabled={!transferForm.subjectId || !transferForm.currentGuarantorId || !transferForm.requestedGuarantorId || !transferForm.reason || createTransferMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="btn-transfer-submit"
            >
              {createTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Odoslať žiadosť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuarantorDialog} onOpenChange={setShowGuarantorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Potvrdenie garanta — Kariérna konverzia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Subjekt prechádza na Tipéra/Špecialistu. Vyberte jedného definitívneho garanta zo zoznamu získateľov, ktorí figurovali na doterajších zmluvách.
            </p>
            {acquirerData?.acquirers?.length ? (
              <div className="space-y-2">
                {acquirerData.acquirers.map(acq => (
                  <div
                    key={acq.id}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                      guarantorForm.chosenGuarantorId === acq.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-border hover:border-foreground/20"
                    }`}
                    onClick={() => setGuarantorForm(p => ({ ...p, chosenGuarantorId: acq.id }))}
                    data-testid={`guarantor-option-${acq.id}`}
                  >
                    <div>
                      <span className="text-sm text-foreground">{getSubjectName(acq)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{formatUid(acq.uid)}</span>
                    </div>
                    {guarantorForm.chosenGuarantorId === acq.id && (
                      <Check className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <Eye className="w-6 h-6 mx-auto mb-1 opacity-50" />
                Žiadni získatelia na zmluvách tohto subjektu
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuarantorDialog(false)} data-testid="btn-guarantor-cancel">
              Zrušiť
            </Button>
            <Button
              onClick={() => confirmGuarantorMutation.mutate(guarantorForm)}
              disabled={!guarantorForm.chosenGuarantorId || confirmGuarantorMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="btn-guarantor-confirm"
            >
              {confirmGuarantorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Potvrdiť garanta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approved" ? "Schváliť prestup" : "Zamietnuť prestup"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs text-muted-foreground mb-1 block">Poznámka (voliteľná)</label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Poznámka k rozhodnutiu..."
              data-testid="input-review-note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)} data-testid="btn-review-cancel">
              Zrušiť
            </Button>
            <Button
              onClick={() => reviewDialog && reviewTransferMutation.mutate({ id: reviewDialog.id, status: reviewDialog.action, reviewNote })}
              disabled={reviewTransferMutation.isPending}
              className={reviewDialog?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              data-testid="btn-review-submit"
            >
              {reviewTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : reviewDialog?.action === "approved" ? "Schváliť" : "Zamietnuť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
