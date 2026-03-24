import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatUid, isArchitekt } from "@/lib/utils";
import {
  Building2, User, Briefcase, Shield, Network,
  ChevronRight, ChevronDown, Search, Loader2,
  Link2, Unlink, RefreshCw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ATK_ROOT_ID = 235;

interface TreeNode {
  id: number;
  uid: string | null;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  isActive: boolean;
  contractCount: number;
  totalAnnualPremium: number;
  children: TreeNode[];
}

interface ConsolidatedStats {
  totalSubjects: number;
  totalContracts: number;
  totalAnnualPremium: number;
  byType: Record<string, number>;
  byLifecyclePhase: Record<string, number>;
}

function getSubjectName(node: TreeNode): string {
  if (node.companyName) return node.companyName;
  return [node.firstName, node.lastName].filter(Boolean).join(" ") || `Subjekt #${node.id}`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "company": case "organization": return <Building2 className="w-3.5 h-3.5 shrink-0" />;
    case "szco": return <Briefcase className="w-3.5 h-3.5 shrink-0" />;
    case "system": return <Shield className="w-3.5 h-3.5 shrink-0" />;
    default: return <User className="w-3.5 h-3.5 shrink-0" />;
  }
}

function getTypeBadgeLabel(type: string): string {
  switch (type) {
    case "company": return "PO";
    case "szco": return "SZČO";
    case "organization": return "NS/VS";
    case "system": return "SYS";
    default: return "FO";
  }
}

function nodeMatchesSearch(node: TreeNode, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  const name = getSubjectName(node).toLowerCase();
  const uid = (node.uid || "").toLowerCase();
  return name.includes(q) || uid.includes(q);
}

function nodeOrDescendantMatches(node: TreeNode, search: string): boolean {
  if (!search) return true;
  if (nodeMatchesSearch(node, search)) return true;
  return node.children.some(c => nodeOrDescendantMatches(c, search));
}

interface AttachDialogState {
  parentId: number;
  parentName: string;
}

interface DetachDialogState {
  subjectId: number;
  subjectName: string;
}

interface SubjectSearchResult {
  id: number;
  uid: string | null;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  parentSubjectId: number | null;
}

function TreeNodeRow({
  node,
  depth,
  search,
  canManipulate,
  onAttach,
  onDetach,
  isRoot,
}: {
  node: TreeNode;
  depth: number;
  search: string;
  canManipulate: boolean;
  onAttach: (parentId: number, parentName: string) => void;
  onDetach: (subjectId: number, subjectName: string) => void;
  isRoot: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const matches = nodeMatchesSearch(node, search);
  const anyChildMatches = node.children.some(c => nodeOrDescendantMatches(c, search));

  if (search && !matches && !anyChildMatches) return null;

  const name = getSubjectName(node);
  const indent = depth * 20;

  return (
    <div data-testid={`tree-node-${node.id}`}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors group",
          !node.isActive && "opacity-60",
          search && matches && "bg-yellow-500/10"
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <button
          className={cn("w-4 h-4 shrink-0 flex items-center justify-center", !hasChildren && "invisible")}
          onClick={() => setExpanded(!expanded)}
          data-testid={`btn-toggle-${node.id}`}
        >
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        <span className="text-muted-foreground shrink-0">{getTypeIcon(node.type)}</span>

        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 h-4 shrink-0 border-border"
          data-testid={`badge-type-${node.id}`}
        >
          {getTypeBadgeLabel(node.type)}
        </Badge>

        <Link href={`/subjects?open=${node.id}`}>
          <span
            className="text-sm font-medium hover:underline cursor-pointer truncate max-w-[200px]"
            data-testid={`link-subject-${node.id}`}
          >
            {name}
          </span>
        </Link>

        {node.uid && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0" data-testid={`uid-${node.id}`}>
            {formatUid(node.uid)}
          </span>
        )}

        {node.contractCount > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0" data-testid={`badge-contracts-${node.id}`}>
            {node.contractCount} zml.
          </Badge>
        )}

        {node.totalAnnualPremium > 0 && (
          <span className="text-[10px] text-emerald-500 shrink-0" data-testid={`premium-${node.id}`}>
            {node.totalAnnualPremium.toFixed(0)} €/r
          </span>
        )}

        {!node.isActive && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">Neakt.</Badge>
        )}

        {canManipulate && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-emerald-600 hover:text-emerald-500"
              onClick={() => onAttach(node.id, name)}
              data-testid={`btn-attach-${node.id}`}
            >
              <Link2 className="w-3 h-3 mr-1" />
              Pripojiť
            </Button>
            {!isRoot && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-red-500 hover:text-red-400"
                onClick={() => onDetach(node.id, name)}
                data-testid={`btn-detach-${node.id}`}
              >
                <Unlink className="w-3 h-3 mr-1" />
                Odpojiť
              </Button>
            )}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              search={search}
              canManipulate={canManipulate}
              onAttach={onAttach}
              onDetach={onDetach}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HoldingTree() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [attachState, setAttachState] = useState<AttachDialogState | null>(null);
  const [detachState, setDetachState] = useState<DetachDialogState | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");

  const canManipulate = isArchitekt(appUser);

  const { data: tree, isLoading: treeLoading, refetch: refetchTree } = useQuery<TreeNode>({
    queryKey: ["/api/subjects", ATK_ROOT_ID, "full-tree"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${ATK_ROOT_ID}/full-tree`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tree");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ConsolidatedStats>({
    queryKey: ["/api/subjects", ATK_ROOT_ID, "consolidated-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${ATK_ROOT_ID}/consolidated-stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<SubjectSearchResult[]>({
    queryKey: ["/api/subjects", "search", subjectSearch],
    queryFn: async () => {
      if (!subjectSearch || subjectSearch.length < 2) return [];
      const res = await fetch(`/api/subjects?limit=500`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const all: SubjectSearchResult[] = data.subjects || data || [];
      const q = subjectSearch.toLowerCase();
      return all.filter((s: SubjectSearchResult) => {
        const name = [s.firstName, s.lastName, s.companyName].filter(Boolean).join(" ").toLowerCase();
        const uid = (s.uid || "").toLowerCase();
        return name.includes(q) || uid.includes(q);
      });
    },
    enabled: !!attachState && subjectSearch.length >= 2,
  });

  const attachMutation = useMutation({
    mutationFn: async ({ subjectId, parentId }: { subjectId: number; parentId: number }) => {
      const res = await apiRequest("PATCH", `/api/subjects/${subjectId}`, { parentSubjectId: parentId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Subjekt pripojený", description: "Hierarchia bola aktualizovaná." });
      setAttachState(null);
      setSubjectSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", ATK_ROOT_ID, "full-tree"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", ATK_ROOT_ID, "consolidated-stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa pripojiť subjekt.", variant: "destructive" });
    },
  });

  const detachMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      const res = await apiRequest("PATCH", `/api/subjects/${subjectId}`, { parentSubjectId: null });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Subjekt odpojený", description: "Subjekt bol odpojený od rodiča." });
      setDetachState(null);
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", ATK_ROOT_ID, "full-tree"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", ATK_ROOT_ID, "consolidated-stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa odpojiť subjekt.", variant: "destructive" });
    },
  });

  const formatPremium = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} M€`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)} k€`;
    return `${val.toFixed(0)} €`;
  };

  return (
    <div className="p-6 space-y-6 max-w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="page-title-holding-tree">ATK Holding Strom</h1>
            <p className="text-xs text-muted-foreground">Majetkový dáždnik – hierarchická štruktúra subjektov</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchTree(); refetchStats(); }}
          data-testid="btn-refresh-tree"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Obnoviť
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="kpi-total-subjects">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Celkovo subjektov</p>
            <p className="text-2xl font-bold">{statsLoading ? "–" : (stats?.totalSubjects ?? 0)}</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-total-contracts">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Celkovo zmlúv</p>
            <p className="text-2xl font-bold">{statsLoading ? "–" : (stats?.totalContracts ?? 0)}</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-total-premium">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Ročné poistné (celkom)</p>
            <p className="text-2xl font-bold text-emerald-500">
              {statsLoading ? "–" : formatPremium(stats?.totalAnnualPremium ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v strome (meno, UID)..."
            className="pl-8"
            data-testid="input-tree-search"
          />
          {search && (
            <button
              className="absolute right-2.5 top-2.5"
              onClick={() => setSearch("")}
              data-testid="btn-clear-search"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {canManipulate && (
          <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
            <Shield className="w-3 h-3 mr-1" /> Superadmin – manipulácia povolená
          </Badge>
        )}
      </div>

      <div className="border border-border rounded-lg bg-background">
        {treeLoading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Načítavam strom...</span>
          </div>
        ) : !tree ? (
          <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-tree-empty">
            Strom sa nepodarilo načítať.
          </div>
        ) : (
          <div className="p-2">
            <TreeNodeRow
              node={tree}
              depth={0}
              search={search}
              canManipulate={canManipulate}
              onAttach={(parentId, parentName) => { setAttachState({ parentId, parentName }); setSubjectSearch(""); }}
              onDetach={(subjectId, subjectName) => setDetachState({ subjectId, subjectName })}
              isRoot={true}
            />
          </div>
        )}
      </div>

      {attachState && (
        <Dialog open onOpenChange={() => setAttachState(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pripojiť subjekt pod „{attachState.parentName}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Hľadať subjekt (min. 2 znaky)..."
                  className="pl-8"
                  autoFocus
                  data-testid="input-subject-search-attach"
                />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {searchLoading && (
                  <div className="flex items-center gap-2 justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs text-muted-foreground">Hľadám...</span>
                  </div>
                )}
                {!searchLoading && subjectSearch.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-search-results">
                    Žiadne výsledky
                  </p>
                )}
                {searchResults.map((s) => {
                  const name = [s.firstName, s.lastName, s.companyName].filter(Boolean).join(" ") || `#${s.id}`;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        if (!attachMutation.isPending) {
                          attachMutation.mutate({ subjectId: s.id, parentId: attachState.parentId });
                        }
                      }}
                      data-testid={`attach-result-${s.id}`}
                    >
                      {getTypeIcon(s.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {s.uid && <p className="text-[10px] text-muted-foreground font-mono">{formatUid(s.uid)}</p>}
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{getTypeBadgeLabel(s.type)}</Badge>
                      {s.parentSubjectId != null && (
                        <Badge variant="secondary" className="text-[9px] shrink-0">Má rodiča</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttachState(null)} data-testid="btn-cancel-attach">
                Zrušiť
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {detachState && (
        <AlertDialog open onOpenChange={() => setDetachState(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odpojiť od rodiča?</AlertDialogTitle>
              <AlertDialogDescription>
                Subjekt <strong>{detachState.subjectName}</strong> bude odpojený zo stromovej hierarchie.
                Táto akcia sa zaznamená do histórie zmien.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-detach">Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => detachMutation.mutate(detachState.subjectId)}
                disabled={detachMutation.isPending}
                data-testid="btn-confirm-detach"
                className="bg-destructive hover:bg-destructive/90"
              >
                {detachMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Odpojiť
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
