import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import type { ContractInventory } from "@shared/schema";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProcessingSaveButton } from "@/components/processing-save-button";

function InventoryFormDialog({
  open,
  onOpenChange,
  editingInventory,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInventory: ContractInventory | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stateId, setStateId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isClosed, setIsClosed] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contract-inventories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Uspech", description: "Supiska vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit supisku", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-inventories/${editingInventory?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Uspech", description: "Supiska aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat supisku", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editingInventory) {
        setName(editingInventory.name || "");
        setDescription(editingInventory.description || "");
        setStateId(editingInventory.stateId?.toString() || "");
        setSortOrder(editingInventory.sortOrder?.toString() || "0");
        setIsClosed(editingInventory.isClosed ?? false);
      } else {
        setName("");
        setDescription("");
        setStateId(activeStateId?.toString() || "");
        setSortOrder("0");
        setIsClosed(false);
      }
    }
  }, [open, editingInventory, activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      description: description || null,
      stateId: stateId ? parseInt(stateId) : null,
      sortOrder: parseInt(sortOrder) || 0,
      isClosed,
    };

    if (editingInventory) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-inventory-dialog-title">
            {editingInventory ? "Upravit supisku" : "Pridat supisku"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nazov supisky"
              data-testid="input-inventory-name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Popis supisky"
              data-testid="input-inventory-description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Stat</label>
            <Select value={stateId} onValueChange={setStateId}>
              <SelectTrigger data-testid="select-inventory-state">
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
              data-testid="input-inventory-sort-order"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isClosed"
              checked={isClosed}
              onCheckedChange={(checked) => setIsClosed(checked === true)}
              data-testid="checkbox-inventory-is-closed"
            />
            <label htmlFor="isClosed" className="text-sm font-medium cursor-pointer">
              Uzavreta supiska
            </label>
          </div>

          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-inventory-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function DeleteInventoryDialog({
  inventory,
  open,
  onOpenChange,
}: {
  inventory: ContractInventory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contract-inventories/${inventory.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Uspech", description: "Supiska vymazana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat supisku", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat supisku</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat supisku <span className="font-semibold text-foreground">{inventory.name}</span>? Tuto akciu nie je mozne vratit.
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

export default function ContractInventories() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<ContractInventory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInventory, setDeletingInventory] = useState<ContractInventory | null>(null);

  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const { data: inventories, isLoading } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/contract-inventories/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmenit poradie", variant: "destructive" }),
  });

  const sorted = inventories ? [...inventories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];

  function handleDragStart(id: number, index: number) {
    dragItemRef.current = index;
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    dragOverItemRef.current = index;
  }

  function handleDrop() {
    if (dragItemRef.current === null || dragOverItemRef.current === null) return;
    if (dragItemRef.current === dragOverItemRef.current) return;

    const reordered = [...sorted];
    const [removed] = reordered.splice(dragItemRef.current, 1);
    reordered.splice(dragOverItemRef.current, 0, removed);

    const items = reordered.map((item, idx) => ({
      id: item.id,
      sortOrder: idx,
    }));

    reorderMutation.mutate(items);

    dragItemRef.current = null;
    dragOverItemRef.current = null;
    setDraggedId(null);
  }

  function handleDragEnd() {
    dragItemRef.current = null;
    dragOverItemRef.current = null;
    setDraggedId(null);
  }

  function openCreate() {
    setEditingInventory(null);
    setDialogOpen(true);
  }

  function openEdit(inventory: ContractInventory) {
    setEditingInventory(inventory);
    setDialogOpen(true);
  }

  function openDelete(inventory: ContractInventory) {
    setDeletingInventory(inventory);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Zoznam supisiek</h1>
        <Button onClick={openCreate} data-testid="button-create-inventory">
          <Plus className="w-4 h-4 mr-2" />
          Pridat supisku
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-inventories">
              Ziadne supisky
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-20">Poradie</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead className="w-32">Stav</TableHead>
                  <TableHead className="w-32 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inventory, index) => (
                  <TableRow
                    key={inventory.id}
                    draggable
                    onDragStart={() => handleDragStart(inventory.id, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`${draggedId === inventory.id ? "opacity-50" : ""}`}
                    data-testid={`row-inventory-${inventory.id}`}
                  >
                    <TableCell>
                      <GripVertical
                        className="w-4 h-4 text-muted-foreground cursor-grab"
                        data-testid={`drag-handle-${inventory.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm" data-testid={`text-sort-order-${inventory.id}`}>
                      {inventory.sortOrder}
                    </TableCell>
                    <TableCell data-testid={`text-inventory-name-${inventory.id}`}>
                      {inventory.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-inventory-description-${inventory.id}`}>
                      {inventory.description || "—"}
                    </TableCell>
                    <TableCell data-testid={`badge-inventory-status-${inventory.id}`}>
                      {inventory.isClosed ? (
                        <Badge variant="destructive" className="text-xs">Uzavreta</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white text-xs">Otvorena</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(inventory)}
                          data-testid={`button-edit-inventory-${inventory.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDelete(inventory)}
                          data-testid={`button-delete-inventory-${inventory.id}`}
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

      <InventoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingInventory={editingInventory}
        activeStateId={activeStateId}
      />

      {deletingInventory && (
        <DeleteInventoryDialog
          inventory={deletingInventory}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingInventory(null);
          }}
        />
      )}
    </div>
  );
}
