import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, Upload, Image } from "lucide-react";
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
import type { State, StateFlagHistory } from "@shared/schema";

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
        setContinentId(editingState.continentId.toString());
      } else {
        setName("");
        setCode("");
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
    const payload = { name, code, continentId: parseInt(continentId), processingTimeSec };

    if (editingState) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-upload-title">Nahrat vlajku - {state.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {state.flagUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Aktualna vlajka</label>
              <div className="flex items-center justify-center p-4 border rounded-md">
                <img src={state.flagUrl} alt={state.name} className="max-h-24 object-contain" />
              </div>
            </div>
          )}
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
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
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
                    {entry.flagUrl ? (
                      <img src={entry.flagUrl} alt="Stara vlajka" className="max-h-12 object-contain" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.replacedAt
                      ? new Date(entry.replacedAt).toLocaleString("sk-SK")
                      : "-"}
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
    return continents?.find(c => c.id === id)?.name || `#${id}`;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Staty</h1>
          <p className="text-sm text-muted-foreground">Sprava statov a vlajok</p>
        </div>
        <Button
          onClick={() => { setEditingState(null); setFormOpen(true); }}
          data-testid="button-add-state"
        >
          <Plus className="w-4 h-4 mr-2" />
          Pridat stat
        </Button>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Skratka</TableHead>
                  <TableHead>Kontinent</TableHead>
                  <TableHead>Vlajka</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStates.map(state => (
                  <TableRow key={state.id} data-testid={`row-state-${state.id}`}>
                    <TableCell>
                      <Badge variant="outline">{state.id}</Badge>
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-state-name-${state.id}`}>
                      {state.name}
                    </TableCell>
                    <TableCell data-testid={`text-state-code-${state.id}`}>
                      {state.code}
                    </TableCell>
                    <TableCell>{getContinentName(state.continentId)}</TableCell>
                    <TableCell>
                      {state.flagUrl ? (
                        <img src={state.flagUrl} alt={state.name} className="h-6 object-contain" />
                      ) : (
                        <span className="text-muted-foreground text-xs">Bez vlajky</span>
                      )}
                    </TableCell>
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
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteState(state)}
                          data-testid={`button-delete-state-${state.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
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
