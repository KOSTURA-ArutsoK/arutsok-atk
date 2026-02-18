import { useState, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, ShieldCheck, RefreshCw, Search } from "lucide-react";
import { useTableFilter } from "@/hooks/use-table-filter";
import { TableFilterBar } from "@/components/table-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { ConditionalDelete } from "@/components/conditional-delete";
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
import { HelpIcon, AdminNote } from "@/components/help-icon";

const PERMISSION_MATRIX_COLUMNS: ColumnDef[] = [
  { key: "canRead", label: "Citanie" },
  { key: "canCreate", label: "Vytvorenie" },
  { key: "canEdit", label: "Uprava" },
  { key: "canPublish", label: "Publikovanie" },
  { key: "canDelete", label: "Vymazanie" },
];

const MODULES = [
  { key: "dashboard", label: "Prehlad", group: "Zakladne" },
  { key: "spolocnosti", label: "Spolocnosti", group: "Zakladne" },
  { key: "staty", label: "Staty", group: "Zakladne" },
  { key: "partneri", label: "Partneri", group: "Obchod" },
  { key: "produkty", label: "Produkty", group: "Obchod" },
  { key: "subjekty", label: "Subjekty / Klienti", group: "Obchod" },
  { key: "zmluvy", label: "Zmluvy", group: "Obchod" },
  { key: "evidencia_zmluv", label: "Evidencia zmluv", group: "Obchod" },
  { key: "supisky", label: "Supisky", group: "Obchod" },
  { key: "sektory", label: "Sektory / Parametre", group: "Obchod" },
  { key: "provizie", label: "Provizie", group: "Financie" },
  { key: "odmeny", label: "Odmeny", group: "Financie" },
  { key: "sadzby", label: "Sadzby provizii", group: "Financie" },
  { key: "kalendar", label: "Kalendar", group: "Informacie" },
  { key: "novinky", label: "Novinky", group: "Informacie" },
  { key: "dokumenty", label: "Dokumenty na stiahnutie", group: "Informacie" },
  { key: "nastavenia", label: "Nastavenia", group: "Administracia" },
  { key: "historia", label: "Historia / Audit", group: "Administracia" },
  { key: "pouzivatelia", label: "Pouzivatelia", group: "Administracia" },
  { key: "skupiny_pravomoci", label: "Skupiny pravomoci", group: "Administracia" },
  { key: "archiv", label: "Archiv", group: "Administracia" },
  { key: "pravidla_typov", label: "Pravidla typov klientov", group: "Administracia" },
];

const ACTION_COLUMNS = [
  { key: "canRead", label: "Citanie" },
  { key: "canCreate", label: "Vytvorenie" },
  { key: "canEdit", label: "Uprava" },
  { key: "canPublish", label: "Publikovanie" },
  { key: "canDelete", label: "Vymazanie" },
];

const GROUP_FILTER_COLUMNS = [
  { key: "name", label: "Nazov" },
  { key: "description", label: "Popis" },
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
      <DialogContent size="md">
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
            <div className="flex items-center gap-1.5">
              <Label>Popis</Label>
              <AdminNote text="Skupina opravneni definuje casovy limit session a pristupove urovne. Zmenou ovplyvnite pristup vsetkych pouzivatelov v skupine." isAdmin={true} side="right" />
            </div>
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

const MODULE_GROUPS = Array.from(new Set(MODULES.map(m => m.group)));

function PermissionMatrix({ groupId, columnVisibility }: { groupId: number; columnVisibility: ReturnType<typeof useColumnVisibility> }) {
  const { toast } = useToast();

  const { data: permissions, isLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permission-groups", groupId, "permissions"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/permissions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups", groupId, "permissions"] });
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

  function handleToggleRow(moduleKey: string) {
    const perm = getPermission(moduleKey);
    const allChecked = ACTION_COLUMNS.every(col => perm ? !!(perm as any)[col.key] : false);
    const newVal = !allChecked;
    const payload: any = { groupId, module: moduleKey };
    ACTION_COLUMNS.forEach(col => { payload[col.key] = newVal; });
    updateMutation.mutate(payload);
  }

  function handleToggleColumn(actionKey: string) {
    const allChecked = MODULES.every(mod => {
      const perm = getPermission(mod.key);
      return perm ? !!(perm as any)[actionKey] : false;
    });
    const newVal = !allChecked;
    MODULES.forEach(mod => {
      const perm = getPermission(mod.key);
      const payload: any = {
        groupId,
        module: mod.key,
        canRead: perm?.canRead || false,
        canCreate: perm?.canCreate || false,
        canEdit: perm?.canEdit || false,
        canPublish: perm?.canPublish || false,
        canDelete: perm?.canDelete || false,
      };
      payload[actionKey] = newVal;
      updateMutation.mutate(payload);
    });
  }

  function handleToggleAll() {
    const allChecked = MODULES.every(mod => {
      const perm = getPermission(mod.key);
      return ACTION_COLUMNS.every(col => perm ? !!(perm as any)[col.key] : false);
    });
    const newVal = !allChecked;
    MODULES.forEach(mod => {
      const payload: any = { groupId, module: mod.key };
      ACTION_COLUMNS.forEach(col => { payload[col.key] = newVal; });
      updateMutation.mutate(payload);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const allGlobalChecked = MODULES.every(mod => {
    const perm = getPermission(mod.key);
    return ACTION_COLUMNS.every(col => perm ? !!(perm as any)[col.key] : false);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold" data-testid="text-matrix-title">Matica opravneni</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnManager columnVisibility={columnVisibility} />
          <Button
            variant={allGlobalChecked ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleAll}
            disabled={updateMutation.isPending}
            data-testid="button-toggle-all"
          >
            {allGlobalChecked ? "Odznacit vsetko" : "Oznacit vsetko"}
          </Button>
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
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Modul</TableHead>
                {ACTION_COLUMNS.filter(col => columnVisibility.isVisible(col.key)).map(col => {
                  const colAllChecked = MODULES.every(mod => {
                    const perm = getPermission(mod.key);
                    return perm ? !!(perm as any)[col.key] : false;
                  });
                  return (
                    <TableHead key={col.key} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>{col.label}</span>
                        <Checkbox
                          checked={colAllChecked}
                          onCheckedChange={() => handleToggleColumn(col.key)}
                          disabled={updateMutation.isPending}
                          data-testid={`checkbox-col-all-${col.key}`}
                        />
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead className="text-center w-[80px]">Vsetko</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_GROUPS.map(group => {
                const groupModules = MODULES.filter(m => m.group === group);
                return (
                  <Fragment key={`group-${group}`}>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={ACTION_COLUMNS.filter(col => columnVisibility.isVisible(col.key)).length + 2} className="py-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground" data-testid={`text-group-header-${group}`}>
                          {group}
                        </span>
                      </TableCell>
                    </TableRow>
                    {groupModules.map(mod => {
                      const perm = getPermission(mod.key);
                      const rowAllChecked = ACTION_COLUMNS.every(col => perm ? !!(perm as any)[col.key] : false);
                      return (
                        <TableRow key={mod.key} data-testid={`row-perm-${mod.key}`}>
                          <TableCell className="font-medium" data-testid={`text-module-${mod.key}`}>
                            {mod.label}
                          </TableCell>
                          {ACTION_COLUMNS.filter(col => columnVisibility.isVisible(col.key)).map(col => {
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={rowAllChecked}
                              onCheckedChange={() => handleToggleRow(mod.key)}
                              disabled={updateMutation.isPending}
                              data-testid={`checkbox-row-all-${mod.key}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
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

  const { data: appUsers } = useQuery<any[]>({
    queryKey: ["/api/app-users"],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const matrixColumnVisibility = useColumnVisibility("permission-matrix", PERMISSION_MATRIX_COLUMNS);
  const tableFilter = useTableFilter(groups || [], GROUP_FILTER_COLUMNS);

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
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold" data-testid="text-groups-title">Skupiny pravomoci</h1>
              <HelpIcon text="Nastavenie skupin opravneni pre rozne urovne pristupu." side="right" />
            </div>
            <p className="text-sm text-muted-foreground">Sprava skupin opravneni a matica pristupov</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TableFilterBar filter={tableFilter} />
          <Button onClick={openCreate} data-testid="button-add-group">
            <Plus className="w-4 h-4 mr-2" />
            Pridat skupinu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tableFilter.filteredData.length > 0 ? (
          tableFilter.filteredData.map(group => {
            const userCountForGroup = (appUsers || []).filter((u: any) => u.permissionGroupId === group.id).length;
            return (
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
                    <div onClick={e => e.stopPropagation()}>
                      <ConditionalDelete canDelete={userCountForGroup === 0} onClick={() => setDeleteGroupId(group.id)} testId={`button-delete-group-${group.id}`} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Ziadne skupiny pravomoci
          </div>
        )}
      </div>

      {selectedGroupId && (
        <PermissionMatrix groupId={selectedGroupId} columnVisibility={matrixColumnVisibility} />
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
