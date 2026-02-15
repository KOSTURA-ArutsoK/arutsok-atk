import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import type { Supiska, Contract } from "@shared/schema";
import { Plus, Pencil, Trash2, Loader2, Send, Undo2, FileSpreadsheet, FileDown, Lock, Unlock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ProcessingSaveButton } from "@/components/processing-save-button";

const STATUSES = ["Nova", "Pripravena", "Odoslana"] as const;

function statusColor(status: string) {
  switch (status) {
    case "Nova": return "bg-blue-600 text-white";
    case "Pripravena": return "bg-amber-500 text-white";
    case "Odoslana": return "bg-emerald-600 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

function SupiskaFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supiska | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [formStartTime] = useState(() => Date.now());

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/supisky", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      toast({ title: "Uspech", description: "Supiska vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit supisku", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/supisky/${editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      toast({ title: "Uspech", description: "Supiska aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat supisku", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name || "");
        setNotes(editing.notes || "");
      } else {
        setName("");
        setNotes("");
      }
    }
  }, [open, editing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processingTimeSec = Math.round((Date.now() - formStartTime) / 1000);
    const data = { name, notes, processingTimeSec };
    if (editing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Upravit supisku" : "Nova supiska"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nazov</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="input-supiska-name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Poznamky</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              data-testid="input-supiska-notes"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
            <ProcessingSaveButton
              isPending={createMutation.isPending || updateMutation.isPending}
              type="submit"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SupiskaDetailDialog({
  open,
  onOpenChange,
  supiska,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supiska: Supiska | null;
}) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: linkedContracts = [], isLoading: contractsLoading } = useQuery<any[]>({
    queryKey: ["/api/supisky", supiska?.id, "contracts"],
    enabled: !!supiska && open,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    enabled: open,
  });

  const { data: partners = [] } = useQuery<any[]>({
    queryKey: ["/api/partners"],
    enabled: open,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const removeContractMutation = useMutation({
    mutationFn: (contractId: number) =>
      apiRequest("DELETE", `/api/supisky/${supiska?.id}/contracts/${contractId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiska?.id, "contracts"] });
      toast({ title: "Uspech", description: "Zmluva odobrana zo supisky" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message || "Nepodarilo sa odobrat zmluvu", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PUT", `/api/supisky/${supiska?.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiska?.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Stav supisky aktualizovany" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmenit stav", variant: "destructive" }),
  });

  if (!supiska) return null;

  const isSent = supiska.status === "Odoslana";

  const getSubjectName = (subjectId: number | null) => {
    if (!subjectId) return "";
    const s = subjects.find((s: any) => s.id === subjectId);
    return s ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : "";
  };

  const getPartnerName = (partnerId: number | null) => {
    if (!partnerId) return "";
    const p = partners.find((p: any) => p.id === partnerId);
    return p?.name || "";
  };

  const getProductName = (productId: number | null) => {
    if (!productId) return "";
    const p = products.find((p: any) => p.id === productId);
    return p?.name || "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{supiska.name}</span>
              <Badge className={statusColor(supiska.status)}>{supiska.status}</Badge>
              <span className="text-sm text-muted-foreground">{supiska.supId}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-2">
            <div className="flex items-center gap-2 flex-wrap">
              {!isSent && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddDialogOpen(true)}
                    data-testid="button-add-contracts"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Pridat zmluvy
                  </Button>
                  {supiska.status === "Nova" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate("Pripravena")}
                      disabled={statusMutation.isPending}
                      data-testid="button-status-pripravena"
                    >
                      Pripravena
                    </Button>
                  )}
                  {(supiska.status === "Nova" || supiska.status === "Pripravena") && linkedContracts.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => statusMutation.mutate("Odoslana")}
                      disabled={statusMutation.isPending}
                      data-testid="button-status-odoslana"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Odoslat
                    </Button>
                  )}
                </>
              )}
              {isSent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => statusMutation.mutate("Pripravena")}
                  disabled={statusMutation.isPending}
                  data-testid="button-status-unlock"
                >
                  <Undo2 className="w-4 h-4 mr-1" />
                  Vratit na Pripravena
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/supisky/${supiska.id}/export/excel`, "_blank")}
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/supisky/${supiska.id}/export/csv`, "_blank")}
                  data-testid="button-export-csv"
                >
                  <FileDown className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </div>
            </div>

            {supiska.notes && (
              <p className="text-sm text-muted-foreground">{supiska.notes}</p>
            )}

            {isSent && supiska.sentAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>Odoslana {new Date(supiska.sentAt).toLocaleDateString("sk-SK")} uzivatelom {supiska.sentBy}</span>
              </div>
            )}

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cislo kontraktu</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Stav</TableHead>
                    {!isSent && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractsLoading ? (
                    <TableRow>
                      <TableCell colSpan={isSent ? 5 : 6} className="text-center">
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      </TableCell>
                    </TableRow>
                  ) : linkedContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSent ? 5 : 6} className="text-center text-muted-foreground">
                        Ziadne zmluvy v supiske
                      </TableCell>
                    </TableRow>
                  ) : (
                    linkedContracts.map((c: any) => (
                      <TableRow key={c.id} data-testid={`row-contract-${c.id}`}>
                        <TableCell className="font-mono text-sm">{c.globalNumber || c.id}</TableCell>
                        <TableCell>{getSubjectName(c.subjectId)}</TableCell>
                        <TableCell>{getPartnerName(c.partnerId)}</TableCell>
                        <TableCell>{getProductName(c.productId)}</TableCell>
                        <TableCell>
                          {c.isLocked ? (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="w-3 h-3" />
                              Zamknuta
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Otvorena</Badge>
                          )}
                        </TableCell>
                        {!isSent && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeContractMutation.mutate(c.id)}
                              disabled={removeContractMutation.isPending}
                              data-testid={`button-remove-contract-${c.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">
              Pocet zmluv: {linkedContracts.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddContractsDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        supiskaId={supiska.id}
      />
    </>
  );
}

function AddContractsDialog({
  open,
  onOpenChange,
  supiskaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supiskaId: number;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: eligibleContracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/supisky", supiskaId, "eligible-contracts"],
    enabled: open,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    enabled: open,
  });

  const { data: partners = [] } = useQuery<any[]>({
    queryKey: ["/api/partners"],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (contractIds: number[]) =>
      apiRequest("POST", `/api/supisky/${supiskaId}/contracts`, { contractIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiskaId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiskaId, "eligible-contracts"] });
      toast({ title: "Uspech", description: "Zmluvy pridane do supisky" });
      setSelectedIds([]);
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat zmluvy", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open]);

  const toggleId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === eligibleContracts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleContracts.map((c: any) => c.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pridat zmluvy do supisky</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-2">
          <p className="text-sm text-muted-foreground">
            Zobrazene su iba podpisane a nezamknute zmluvy.
          </p>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === eligibleContracts.length && eligibleContracts.length > 0}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Cislo kontraktu</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Partner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : eligibleContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ziadne dostupne zmluvy
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleContracts.map((c: any) => {
                    const subject = subjects.find((s: any) => s.id === c.subjectId);
                    const partner = partners.find((p: any) => p.id === c.partnerId);
                    return (
                      <TableRow key={c.id} data-testid={`row-eligible-${c.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(c.id)}
                            onCheckedChange={() => toggleId(c.id)}
                            data-testid={`checkbox-contract-${c.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.globalNumber || c.id}</TableCell>
                        <TableCell>
                          {subject ? `${subject.firstName || ""} ${subject.lastName || ""}`.trim() : ""}
                        </TableCell>
                        <TableCell>{partner?.name || ""}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} vybratych
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
              <Button
                onClick={() => addMutation.mutate(selectedIds)}
                disabled={selectedIds.length === 0 || addMutation.isPending}
                data-testid="button-confirm-add-contracts"
              >
                {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Pridat ({selectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupiskyPage() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supiska | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSupiska, setSelectedSupiska] = useState<Supiska | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: supisky = [], isLoading } = useQuery<Supiska[]>({
    queryKey: ["/api/supisky"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/supisky/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      toast({ title: "Uspech", description: "Supiska vymazana" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat supisku", variant: "destructive" }),
  });

  const filteredSupisky = supisky.filter((s: Supiska) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.supId.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Supisky</h1>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          data-testid="button-create-supiska"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nova supiska
        </Button>
      </div>

      <Input
        placeholder="Hladat..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="max-w-xs"
        data-testid="input-search"
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SUP ID</TableHead>
                <TableHead>Nazov</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Vytvorene</TableHead>
                <TableHead>Vytvoril</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : filteredSupisky.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ziadne supisky
                  </TableCell>
                </TableRow>
              ) : (
                filteredSupisky.map((s: Supiska) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => { setSelectedSupiska(s); setDetailOpen(true); }}
                    data-testid={`row-supiska-${s.id}`}
                  >
                    <TableCell className="font-mono text-sm">{s.supId}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString("sk-SK") : ""}
                    </TableCell>
                    <TableCell className="text-sm">{s.createdBy || ""}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setEditing(s); setFormOpen(true); }}
                          disabled={s.status === "Odoslana"}
                          data-testid={`button-edit-${s.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Naozaj chcete vymazat tuto supisku?")) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          data-testid={`button-delete-${s.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SupiskaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <SupiskaDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        supiska={selectedSupiska}
      />
    </div>
  );
}