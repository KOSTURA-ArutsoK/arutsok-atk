import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PermissionGroup, Permission } from "@shared/schema";
import { ProcessingSaveButton } from "@/components/processing-save-button";

const MODULES = [
  { key: "dashboard", label: "Prehlad" },
  { key: "spolocnosti", label: "Spolocnosti" },
  { key: "partneri", label: "Partneri" },
  { key: "produkty", label: "Produkty" },
  { key: "provizie", label: "Provizie" },
  { key: "subjekty", label: "Subjekty" },
  { key: "nastavenia", label: "Nastavenia" },
  { key: "historia", label: "Historia" },
  { key: "pouzivatelia", label: "Pouzivatelia" },
  { key: "skupiny_pravomoci", label: "Skupiny pravomoci" },
];

const ACTION_COLUMNS = [
  { key: "canRead", label: "Citanie" },
  { key: "canCreate", label: "Vytvorenie" },
  { key: "canEdit", label: "Uprava" },
  { key: "canPublish", label: "Publikovanie" },
  { key: "canDelete", label: "Vymazanie" },
];

function GroupFormDialog({
  open,
  onOpenChange,
  editingGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: PermissionGroup | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionTimeoutSeconds, setSessionTimeoutSeconds] = useState(180);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingGroup) {
        setName(editingGroup.name);
        setDescription(editingGroup.description || "");
        setSessionTimeoutSeconds(editingGroup.sessionTimeoutSeconds ?? 180);
      } else {
        setName("");
        setDescription("");
        setSessionTimeoutSeconds(180);
      }
    }
  }, [open, editingGroup]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/permission-groups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups"] });
      toast({ title: "Uspech", description: "Skupina vytvorena" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/permission-groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups"] });
      toast({ title: "Uspech", description: "Skupina aktualizovana" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    if (sessionTimeoutSeconds < 60) {
      toast({ title: "Chyba", description: "Minimalna doba prihlasenia je 60 sekund.", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = { name, description: description || null, sessionTimeoutSeconds, processingTimeSec };
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-group-dialog-title">
            {editingGroup ? "Upravit skupinu" : "Pridat skupinu"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nazov *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="input-group-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Popis</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              data-testid="input-group-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Doba prihlasenia (sekundy)</Label>
            <Input
              type="number"
              min={60}
              value={sessionTimeoutSeconds}
              onChange={e => {
                const v = parseInt(e.target.value);
                setSessionTimeoutSeconds(isNaN(v) ? 60 : v);
              }}
              data-testid="input-group-timeout"
            />
            <p className="text-xs text-muted-foreground">
              Cas automatickeho odhlasenia pre pouzivatelov v tejto skupine ({Math.floor(sessionTimeoutSeconds / 60)} min {sessionTimeoutSeconds % 60} sek). Minimum: 60 sek.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-group-cancel">
              Zrusit
            </Button>
          </div>

          <ProcessingSaveButton isPending={isPending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrix({ groupId }: { groupId: number }) {
  const { toast } = useToast();

  const { data: permissions, isLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permission-groups", groupId, "permissions"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/permissions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups", groupId, "permissions"] });
      toast({ title: "Uspech", description: "Opravnenie aktualizovane" });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/permissions/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups", groupId, "permissions"] });
      toast({ title: "Uspech", description: "Moduly synchronizovane" });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  function getPermission(module: string): Permission | undefined {
    return permissions?.find(p => p.module === module);
  }

  function handleToggle(module: string, actionKey: string, currentValue: boolean) {
    const perm = getPermission(module);
    const payload: any = {
      groupId,
      module,
      canRead: perm?.canRead || false,
      canCreate: perm?.canCreate || false,
      canEdit: perm?.canEdit || false,
      canPublish: perm?.canPublish || false,
      canDelete: perm?.canDelete || false,
    };
    payload[actionKey] = !currentValue;
    updateMutation.mutate(payload);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold" data-testid="text-matrix-title">Matica opravneni</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-permissions"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Synchronizovat
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modul</TableHead>
                {ACTION_COLUMNS.map(col => (
                  <TableHead key={col.key} className="text-center">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map(mod => {
                const perm = getPermission(mod.key);
                return (
                  <TableRow key={mod.key} data-testid={`row-perm-${mod.key}`}>
                    <TableCell className="font-medium" data-testid={`text-module-${mod.key}`}>
                      {mod.label}
                    </TableCell>
                    {ACTION_COLUMNS.map(col => {
                      const val = perm ? !!(perm as any)[col.key] : false;
                      return (
                        <TableCell key={col.key} className="text-center">
                          <Checkbox
                            checked={val}
                            onCheckedChange={() => handleToggle(mod.key, col.key, val)}
                            disabled={updateMutation.isPending}
                            data-testid={`checkbox-${mod.key}-${col.key}`}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PermissionGroupsPage() {
  const { toast } = useToast();
  const { data: groups, isLoading } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/permission-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups"] });
      toast({ title: "Uspech", description: "Skupina vymazana" });
      if (selectedGroupId === deleteGroupId) setSelectedGroupId(null);
      setDeleteGroupId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
      setDeleteGroupId(null);
    },
  });

  function openCreate() {
    setEditingGroup(null);
    setDialogOpen(true);
  }

  function openEdit(group: PermissionGroup) {
    setEditingGroup(group);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-groups-title">Skupiny pravomoci</h1>
            <p className="text-sm text-muted-foreground">Sprava skupin opravneni a matica pristupov</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-add-group">
          <Plus className="w-4 h-4 mr-2" />
          Pridat skupinu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups && groups.length > 0 ? (
          groups.map(group => (
            <Card
              key={group.id}
              className={`cursor-pointer transition-colors ${selectedGroupId === group.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
              data-testid={`card-group-${group.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate" data-testid={`text-group-name-${group.id}`}>
                      {group.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-group-desc-${group.id}`}>
                      {group.description || "Bez popisu"}
                    </p>
                    <Badge variant="outline" className="mt-2" data-testid={`badge-group-timeout-${group.id}`}>
                      {Math.floor((group.sessionTimeoutSeconds ?? 180) / 60)} min {(group.sessionTimeoutSeconds ?? 180) % 60} sek
                    </Badge>
                    {selectedGroupId === group.id && (
                      <Badge variant="secondary" className="mt-2 ml-2">Vybrana</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); openEdit(group); }}
                      data-testid={`button-edit-group-${group.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setDeleteGroupId(group.id); }}
                      data-testid={`button-delete-group-${group.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Ziadne skupiny pravomoci
          </div>
        )}
      </div>

      {selectedGroupId && (
        <PermissionMatrix groupId={selectedGroupId} />
      )}

      <GroupFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingGroup={editingGroup}
      />

      <AlertDialog open={deleteGroupId !== null} onOpenChange={open => { if (!open) setDeleteGroupId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat skupinu?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akcia je nevratna. Skupina a vsetky jej opravnenia budu vymazane.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteMutation.mutate(deleteGroupId)}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? "Mazem..." : "Vymazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
