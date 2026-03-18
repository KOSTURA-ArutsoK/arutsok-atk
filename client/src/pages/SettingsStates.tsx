import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateTimeSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { Plus, Pencil, Trash2, Clock, Upload, Image, Globe, ChevronDown, ChevronRight, Download, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { State, StateFlagHistory } from "@shared/schema";

const STATE_COLUMNS: ColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nazov" },
  { key: "code", label: "Skratka" },
  { key: "currency", label: "Mena" },
  { key: "continentId", label: "Kontinent" },
  { key: "flagUrl", label: "Vlajka" },
];

const STATE_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "id", label: "ID", type: "number" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "code", label: "Skratka", type: "text" },
  { key: "continentId", label: "Kontinent", type: "number" },
];

function FlagImage({
  src,
  alt,
  code,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  code?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted border border-border ${className || "w-6 h-6"}`}
        title={alt}
        data-testid={`flag-fallback-${code || "unknown"}`}
      >
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{code || "?"}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className || "h-6 object-contain"}
      onError={() => setFailed(true)}
    />
  );
}

function StateFormDialog({
  open,
  onOpenChange,
  editingState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingState: State | null;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [continentId, setContinentId] = useState("1");

  const { data: continents } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/hierarchy/continents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hierarchy/states", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Stat vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit stat", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/states/${editingState?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Stat aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat stat", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingState) {
        setName(editingState.name);
        setCode(editingState.code);
        setCurrency((editingState as any).currency || "EUR");
        setContinentId(editingState.continentId.toString());
      } else {
        setName("");
        setCode("");
        setCurrency("EUR");
        setContinentId("1");
      }
    }
  }, [open, editingState]);

  function handleSubmit() {
    if (!name || !code) {
      toast({ title: "Chyba", description: "Nazov a skratka su povinne", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = { name, code, currency, continentId: parseInt(continentId), processingTimeSec };

    if (editingState) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-state-dialog-title">
            {editingState ? "Upravit stat" : "Pridat stat"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. Slovensko"
              data-testid="input-state-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Skratka (Kod)</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="napr. 421"
              data-testid="input-state-code"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mena</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger data-testid="select-state-currency">
                <SelectValue placeholder="Vyberte menu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="CZK">CZK</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="PLN">PLN</SelectItem>
                <SelectItem value="HUF">HUF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Kontinent</label>
            <Select value={continentId} onValueChange={setContinentId}>
              <SelectTrigger data-testid="select-state-continent">
                <SelectValue placeholder="Vyberte kontinent" />
              </SelectTrigger>
              <SelectContent>
                {continents?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-state">
              Zrusit
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-save-processing"
            >
              {isPending ? "Uklada sa..." : "Ulozit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type WikiFlag = { title: string; thumbUrl: string; descriptionUrl: string };

async function searchWikipediaFlag(countryName: string): Promise<WikiFlag | null> {
  // 1. Primárne: sk.wikipedia.org — hľadáme článok "Vlajka [krajina]"
  try {
    const skSearchUrl = `https://sk.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent("Vlajka " + countryName)}&srnamespace=0&srlimit=6&format=json&origin=*`;
    const skSearchRes = await fetch(skSearchUrl);
    const skSearchData = await skSearchRes.json();
    const skResults: Array<{ title: string }> = skSearchData?.query?.search || [];
    const skBest = skResults.find(r => /vlajka/i.test(r.title)) || skResults[0];

    if (skBest) {
      const skImgUrl = `https://sk.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(skBest.title)}&prop=pageimages&pithumbsize=640&pilicense=any&format=json&origin=*`;
      const skImgRes = await fetch(skImgUrl);
      const skImgData = await skImgRes.json();
      const skPages = skImgData?.query?.pages || {};
      const skPage = Object.values(skPages)[0] as any;
      const thumbUrl: string | undefined = skPage?.thumbnail?.source;
      if (thumbUrl) {
        return {
          title: skBest.title,
          thumbUrl,
          descriptionUrl: `https://sk.wikipedia.org/wiki/${encodeURIComponent(skBest.title)}`,
        };
      }
    }
  } catch {}

  // 2. Záloha: Wikimedia Commons — "Flag of [krajina]"
  try {
    const query = `Flag of ${countryName}`;
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=8&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const results: Array<{ title: string }> = searchData?.query?.search || [];
    const flagResult = results.find(r => /flag/i.test(r.title) && !/historical|naval|state|civil|war|variant|coat|arm/i.test(r.title)) || results[0];
    if (!flagResult) return null;

    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(flagResult.title)}&prop=imageinfo&iiprop=url|descriptionurl&iiurlwidth=640&format=json&origin=*`;
    const infoRes = await fetch(infoUrl);
    const infoData = await infoRes.json();
    const pages = infoData?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl) return null;
    return { title: flagResult.title, thumbUrl: info.thumburl, descriptionUrl: info.descriptionurl || "" };
  } catch {}

  return null;
}

function FlagUploadDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: State | null;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [wikiSearching, setWikiSearching] = useState(false);
  const [wikiFlag, setWikiFlag] = useState<WikiFlag | null>(null);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [wikiDownloading, setWikiDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setWikiFlag(null);
      setWikiError(null);
      setWikiSearching(false);
      setWikiDownloading(false);
    }
  }, [open]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/states/${state?.id}/flag`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Vlajka nahrana" });
      setUploading(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrat vlajku", variant: "destructive" });
      setUploading(false);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  async function handleWikiSearch() {
    if (!state) return;
    setWikiSearching(true);
    setWikiFlag(null);
    setWikiError(null);
    try {
      const result = await searchWikipediaFlag(state.name);
      if (result) {
        setWikiFlag(result);
      } else {
        setWikiError("Vlajka nenájdená na Wikimedia Commons");
      }
    } catch {
      setWikiError("Chyba pri vyhľadávaní na Wikimedia");
    } finally {
      setWikiSearching(false);
    }
  }

  async function handleWikiDownload() {
    if (!state || !wikiFlag) return;
    setWikiDownloading(true);
    try {
      const res = await fetch(`/api/states/${state.id}/flag-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl: wikiFlag.thumbUrl }),
      });
      if (!res.ok) throw new Error("Download failed");
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Úspech", description: `Vlajka stiahnutá z Wikipedie` });
      onOpenChange(false);
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa stiahnuť vlajku", variant: "destructive" });
    } finally {
      setWikiDownloading(false);
    }
  }

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-upload-title">Vlajka — {state.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Aktuálna vlajka</label>
            <div className="flex items-center justify-center p-4 border rounded-md bg-muted/20">
              <FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="max-h-24 object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Stiahnuť z internetu</label>
            <p className="text-xs text-muted-foreground -mt-1">Primárne sk.wikipedia.org, záloha Wikimedia Commons</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleWikiSearch}
              disabled={wikiSearching || wikiDownloading}
              data-testid="button-wiki-search-flag"
            >
              {wikiSearching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {wikiSearching ? "Hľadám na sk.wikipedia.org..." : `Nájsť vlajku pre „${state.name}"`}
            </Button>

            {wikiError && (
              <div className="flex items-center gap-2 text-sm text-destructive p-2 rounded bg-destructive/10">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {wikiError}
              </div>
            )}

            {wikiFlag && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="truncate">
                    Nájdené: <span className="font-medium text-foreground">{wikiFlag.title.replace("File:", "")}</span>
                  </span>
                </div>
                {wikiFlag.descriptionUrl && (
                  <a href={wikiFlag.descriptionUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">
                    {wikiFlag.descriptionUrl.replace("https://", "").split("/wiki/")[0]}
                  </a>
                )}
                <div className="flex items-center justify-center p-3 border rounded-md bg-muted/20">
                  <img src={wikiFlag.thumbUrl} alt="Wikipedia vlajka" className="max-h-28 object-contain" />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleWikiDownload}
                  disabled={wikiDownloading}
                  data-testid="button-wiki-download-flag"
                >
                  {wikiDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {wikiDownloading ? "Sťahujem..." : "Uložiť túto vlajku"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <label className="text-sm font-semibold">Alebo nahrať vlastný súbor</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-flag-file"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || wikiDownloading}
              data-testid="button-select-flag-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahrávam..." : "Vybrať súbor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FlagHistoryDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: State | null;
}) {
  const { data: history, isLoading } = useQuery<StateFlagHistory[]>({
    queryKey: ["/api/states", state?.id, "flag-history"],
    queryFn: async () => {
      if (!state) return [];
      const res = await fetch(`/api/states/${state.id}/flag-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open && !!state,
  });

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-history-title">Historia vlajok statu - {state.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Nacitavam...</div>
        ) : !history || history.length === 0 ? (
          <div className="text-sm text-muted-foreground">Ziadna historia vlajok</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vlajka</TableHead>
                <TableHead>Nahradena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <FlagImage src={entry.flagUrl} alt="Stara vlajka" code={state?.code} className="max-h-12 object-contain" />
                  </TableCell>
                  <TableCell>
                    {formatDateTimeSlovak(entry.replacedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsStates() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [flagUploadState, setFlagUploadState] = useState<State | null>(null);
  const [flagHistoryState, setFlagHistoryState] = useState<State | null>(null);
  const [deleteState, setDeleteState] = useState<State | null>(null);
  const [expandedContinents, setExpandedContinents] = useState<Set<number>>(new Set());

  const { data: allStates, isLoading } = useQuery<State[]>({
    queryKey: ["/api/hierarchy/states"],
  });

  const { data: continents } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/hierarchy/continents"],
  });

  const tableFilter = useSmartFilter(allStates || [], STATE_FILTER_COLUMNS, "settings-states-filter");
  const columnVisibility = useColumnVisibility("settings-states", STATE_COLUMNS);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/states/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Stat vymazany" });
      setDeleteState(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat stat", variant: "destructive" }),
  });

  function toggleContinent(id: number) {
    setExpandedContinents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredStates = tableFilter.filteredData;
  const isFiltered = filteredStates.length !== (allStates?.length ?? 0);

  const continentGroups = (continents || []).map(continent => ({
    continent,
    states: [...(filteredStates.filter(s => s.continentId === continent.id))].sort((a, b) => a.name.localeCompare(b.name, "sk")),
  })).filter(g => g.states.length > 0);

  const ungrouped = filteredStates.filter(s => !continents?.find(c => c.id === s.continentId));

  const colSpan = [
    columnVisibility.isVisible("id"),
    columnVisibility.isVisible("name"),
    columnVisibility.isVisible("code"),
    columnVisibility.isVisible("currency"),
    columnVisibility.isVisible("continentId"),
    columnVisibility.isVisible("flagUrl"),
  ].filter(Boolean).length + 1;

  function renderStateRow(state: State) {
    return (
      <TableRow key={state.id} data-testid={`row-state-${state.id}`} onRowClick={() => { setEditingState(state); setFormOpen(true); }} className="border-l-[3px] border-l-border/40 bg-background hover:bg-muted/30">
        {columnVisibility.isVisible("id") && <TableCell><Badge variant="outline">{state.id}</Badge></TableCell>}
        {columnVisibility.isVisible("name") && <TableCell className="font-medium pl-7" data-testid={`text-state-name-${state.id}`}>{state.name}</TableCell>}
        {columnVisibility.isVisible("code") && <TableCell data-testid={`text-state-code-${state.id}`}>{state.code}</TableCell>}
        {columnVisibility.isVisible("currency") && <TableCell data-testid={`text-state-currency-${state.id}`}><Badge variant="outline">{(state as any).currency || "EUR"}</Badge></TableCell>}
        {columnVisibility.isVisible("continentId") && <TableCell className="text-muted-foreground text-xs">{continents?.find(c => c.id === state.continentId)?.name || state.continentId}</TableCell>}
        {columnVisibility.isVisible("flagUrl") && <TableCell><FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="h-6 object-contain" /></TableCell>}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => setFlagUploadState(state)} data-testid={`button-upload-flag-${state.id}`} title="Nahrat vlajku"><Image className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setFlagHistoryState(state)} data-testid={`button-flag-history-${state.id}`} title="Historia vlajok statu"><Clock className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => { setEditingState(state); setFormOpen(true); }} data-testid={`button-edit-state-${state.id}`}><Pencil className="w-4 h-4" /></Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => setDeleteState(state)} data-testid={`button-delete-state-${state.id}`}><Trash2 className="w-4 h-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Staty</h1>
          <p className="text-sm text-muted-foreground">Sprava statov a vlajok</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button
            onClick={() => { setEditingState(null); setFormOpen(true); }}
            data-testid="button-add-state"
          >
            <Plus className="w-4 h-4 mr-2" />
            Pridat stat
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Nacitavam...</div>
          ) : !allStates || allStates.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Ziadne staty</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("id") && <TableHead>ID</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead>Nazov</TableHead>}
                  {columnVisibility.isVisible("code") && <TableHead>Skratka</TableHead>}
                  {columnVisibility.isVisible("currency") && <TableHead>Mena</TableHead>}
                  {columnVisibility.isVisible("continentId") && <TableHead>Kontinent</TableHead>}
                  {columnVisibility.isVisible("flagUrl") && <TableHead>Vlajka</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFiltered ? (
                  filteredStates.sort((a, b) => a.name.localeCompare(b.name, "sk")).map(renderStateRow)
                ) : (
                  <>
                    {continentGroups.map(({ continent, states }) => (
                      <Fragment key={`continent-group-${continent.id}`}>
                        <TableRow
                          key={`continent-${continent.id}`}
                          className="bg-muted border-t border-border hover:bg-muted/80 cursor-pointer select-none"
                          data-testid={`row-continent-${continent.id}`}
                          onClick={() => toggleContinent(continent.id)}
                        >
                          <TableCell colSpan={colSpan} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {expandedContinents.has(continent.id)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-xs uppercase tracking-wider">{continent.name}</span>
                              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{states.length}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedContinents.has(continent.id) && states.map(renderStateRow)}
                        {expandedContinents.has(continent.id) && <TableRow className="h-0 border-b border-border/60"><TableCell colSpan={colSpan} className="p-0" /></TableRow>}
                      </Fragment>
                    ))}
                    {ungrouped.length > 0 && (
                      <Fragment key="continent-group-none">
                        <TableRow
                          className="bg-muted border-t border-border hover:bg-muted/80 cursor-pointer select-none"
                          onClick={() => toggleContinent(-1)}
                        >
                          <TableCell colSpan={colSpan} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {expandedContinents.has(-1)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-xs uppercase tracking-wider">Nezaradené</span>
                              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{ungrouped.length}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedContinents.has(-1) && ungrouped.sort((a, b) => a.name.localeCompare(b.name, "sk")).map(renderStateRow)}
                        {expandedContinents.has(-1) && <TableRow className="h-0 border-b border-border/60"><TableCell colSpan={colSpan} className="p-0" /></TableRow>}
                      </Fragment>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingState={editingState}
      />

      <FlagUploadDialog
        open={!!flagUploadState}
        onOpenChange={(open) => { if (!open) setFlagUploadState(null); }}
        state={flagUploadState}
      />

      <FlagHistoryDialog
        open={!!flagHistoryState}
        onOpenChange={(open) => { if (!open) setFlagHistoryState(null); }}
        state={flagHistoryState}
      />

      <AlertDialog open={!!deleteState} onOpenChange={(open) => { if (!open) setDeleteState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat stat</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vymazat stat "{deleteState?.name}"? Tato akcia sa neda vratit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteState && deleteMutation.mutate(deleteState.id)}
              data-testid="button-confirm-delete"
            >
              Vymazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
