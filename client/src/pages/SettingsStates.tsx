import { useState, useRef, useCallback, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Clock, Upload, Image, Globe } from "lucide-react";
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
    if (file) {
      uploadMutation.mutate(file);
    }
  }

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-upload-title">Nahrat vlajku - {state.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Aktualna vlajka</label>
            <div className="flex items-center justify-center p-4 border rounded-md">
              <FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="max-h-24 object-contain" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Vyberte novu vlajku</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-flag-file"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="button-select-flag-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahravam..." : "Vybrat subor"}
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

  const { data: allStates, isLoading } = useQuery<State[]>({
    queryKey: ["/api/hierarchy/states"],
  });

  const { data: continents } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/hierarchy/continents"],
  });

  const tableFilter = useSmartFilter(allStates || [], STATE_FILTER_COLUMNS, "settings-states-filter");
  const { sortedData: sortedStates, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
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

  function getContinentName(id: number) {
    return continents?.find(c => c.id === id)?.name || `${id}`;
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
                  {columnVisibility.isVisible("id") && <TableHead sortKey="id" sortDirection={sortKey === "id" ? sortDirection : null} onSort={requestSort}>ID</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov</TableHead>}
                  {columnVisibility.isVisible("code") && <TableHead sortKey="code" sortDirection={sortKey === "code" ? sortDirection : null} onSort={requestSort}>Skratka</TableHead>}
                  {columnVisibility.isVisible("currency") && <TableHead>Mena</TableHead>}
                  {columnVisibility.isVisible("continentId") && <TableHead sortKey="continentId" sortDirection={sortKey === "continentId" ? sortDirection : null} onSort={requestSort}>Kontinent</TableHead>}
                  {columnVisibility.isVisible("flagUrl") && <TableHead>Vlajka</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStates.map(state => (
                  <TableRow key={state.id} data-testid={`row-state-${state.id}`} onRowClick={() => { setEditingState(state); setFormOpen(true); }}>
                    {columnVisibility.isVisible("id") && <TableCell>
                      <Badge variant="outline">{state.id}</Badge>
                    </TableCell>}
                    {columnVisibility.isVisible("name") && <TableCell className="font-medium" data-testid={`text-state-name-${state.id}`}>
                      {state.name}
                    </TableCell>}
                    {columnVisibility.isVisible("code") && <TableCell data-testid={`text-state-code-${state.id}`}>
                      {state.code}
                    </TableCell>}
                    {columnVisibility.isVisible("currency") && <TableCell data-testid={`text-state-currency-${state.id}`}>
                      <Badge variant="outline">{(state as any).currency || "EUR"}</Badge>
                    </TableCell>}
                    {columnVisibility.isVisible("continentId") && <TableCell>{getContinentName(state.continentId)}</TableCell>}
                    {columnVisibility.isVisible("flagUrl") && <TableCell>
                      <FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="h-6 object-contain" />
                    </TableCell>}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setFlagUploadState(state)}
                          data-testid={`button-upload-flag-${state.id}`}
                          title="Nahrat vlajku"
                        >
                          <Image className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setFlagHistoryState(state)}
                          data-testid={`button-flag-history-${state.id}`}
                          title="Historia vlajok statu"
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setEditingState(state); setFormOpen(true); }}
                          data-testid={`button-edit-state-${state.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteState(state)}
                              data-testid={`button-delete-state-${state.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
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
