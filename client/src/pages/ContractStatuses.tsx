import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import type { ContractStatus } from "@shared/schema";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";

function StatusFormDialog({
  open,
  onOpenChange,
  editingStatus,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStatus: ContractStatus | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [stateId, setStateId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contract-statuses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      toast({ title: "Uspech", description: "Stav zmluvy vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit stav zmluvy", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-statuses/${editingStatus?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      toast({ title: "Uspech", description: "Stav zmluvy aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat stav zmluvy", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editingStatus) {
        setName(editingStatus.name || "");
        setColor(editingStatus.color || "#3b82f6");
        setStateId(editingStatus.stateId?.toString() || "");
        setSortOrder(editingStatus.sortOrder?.toString() || "0");
      } else {
        setName("");
        setColor("#3b82f6");
        setStateId(activeStateId?.toString() || "");
        setSortOrder("0");
      }
    }
  }, [open, editingStatus, activeStateId]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      color,
      stateId: stateId ? parseInt(stateId) : null,
      sortOrder: parseInt(sortOrder) || 0,
    };

    if (editingStatus) {
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
          <DialogTitle data-testid="text-status-dialog-title">
            {editingStatus ? "Upravit stav zmluvy" : "Pridat stav zmluvy"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nazov stavu"
              data-testid="input-status-name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Farba</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-md border border-border cursor-pointer"
                data-testid="input-status-color-picker"
              />
              <Input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="font-mono flex-1"
                data-testid="input-status-color-hex"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Stat</label>
            <Select value={stateId} onValueChange={setStateId}>
              <SelectTrigger data-testid="select-status-state">
                <SelectValue placeholder="Vyberte stat" />
              </SelectTrigger>
              <SelectContent>
                {allStates?.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poradie</label>
            <Input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="0"
              data-testid="input-status-sort-order"
            />
          </div>

          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-status-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function DeleteStatusDialog({
  status,
  open,
  onOpenChange,
}: {
  status: ContractStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contract-statuses/${status.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      toast({ title: "Uspech", description: "Stav zmluvy vymazany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat stav zmluvy", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat stav zmluvy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat stav zmluvy <span className="font-semibold text-foreground">{status.name}</span>? Tuto akciu nie je mozne vratit.
          </p>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
              Zrusit
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mazem...
                </>
              ) : (
                "Vymazat"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractStatuses() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<ContractStatus | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<ContractStatus | null>(null);

  const { data: statuses, isLoading } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/contract-statuses/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmenit poradie", variant: "destructive" }),
  });

  const sorted = statuses ? [...statuses].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];

  const handleReorder = (items: { id: number | string; sortOrder: number }[]) => {
    reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })));
  };

  function openCreate() {
    setEditingStatus(null);
    setDialogOpen(true);
  }

  function openEdit(status: ContractStatus) {
    setEditingStatus(status);
    setDialogOpen(true);
  }

  function openDelete(status: ContractStatus) {
    setDeletingStatus(status);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Stavy zmluv</h1>
        <Button onClick={openCreate} data-testid="button-create-status">
          <Plus className="w-4 h-4 mr-2" />
          Pridat stav
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-statuses">
              Ziadne stavy zmluv
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-20">Poradie</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead className="w-32">Farba</TableHead>
                  <TableHead className="w-32 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext_Wrapper items={sorted} onReorder={handleReorder}>
                <TableBody>
                  {sorted.map((status) => (
                    <SortableTableRow
                      key={status.id}
                      id={status.id}
                      data-testid={`row-status-${status.id}`}
                    >
                      <TableCell className="font-mono text-sm" data-testid={`text-sort-order-${status.id}`}>
                        {status.sortOrder}
                      </TableCell>
                      <TableCell data-testid={`text-status-name-${status.id}`}>
                        <Badge
                          variant="outline"
                          style={{ borderColor: status.color, color: status.color }}
                        >
                          {status.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="w-6 h-6 rounded-md border border-border"
                            style={{ backgroundColor: status.color }}
                            data-testid={`color-swatch-${status.id}`}
                          />
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-color-hex-${status.id}`}>
                            {status.color}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(status)}
                            data-testid={`button-edit-status-${status.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDelete(status)}
                            data-testid={`button-delete-status-${status.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </SortableTableRow>
                  ))}
                </TableBody>
              </SortableContext_Wrapper>
            </Table>
          )}
        </CardContent>
      </Card>

      <StatusFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingStatus={editingStatus}
        activeStateId={activeStateId}
      />

      {deletingStatus && (
        <DeleteStatusDialog
          status={deletingStatus}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingStatus(null);
          }}
        />
      )}
    </div>
  );
}
