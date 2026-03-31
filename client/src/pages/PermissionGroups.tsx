import { useState, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, ShieldCheck, RefreshCw, Search, Lock, Users, Link2, KeyRound, Eye, EyeOff } from "lucide-react";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { ConditionalDelete } from "@/components/conditional-delete";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import type { PermissionGroup, Permission, ClientGroup } from "@shared/schema";
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

const GROUP_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Nazov", type: "text" },
  { key: "description", label: "Popis", type: "text" },
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
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Skupina uspesne vytvorena a pridana do zoznamu skupin klientov." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
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

function SectionHeader({
  icon: Icon,
  title,
  count,
  colorClass,
  bgClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${bgClass}`}>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <span className={`font-semibold text-sm ${colorClass}`}>{title}</span>
      <Badge variant="outline" className={`ml-auto text-xs ${colorClass} border-current`}>
        {count}
      </Badge>
    </div>
  );
}

function GroupCard({
  group,
  linkedClientGroup,
  isSystem,
  isSelected,
  userCount,
  onSelect,
  onEdit,
  onDelete,
}: {
  group: PermissionGroup;
  linkedClientGroup: ClientGroup | null;
  isSystem: boolean;
  isSelected: boolean;
  userCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors border-2 ${isSelected ? "ring-2 ring-primary border-primary" : ""} ${isSystem ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : ""}`}
      onClick={onSelect}
      data-testid={`card-group-${group.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate" data-testid={`text-group-name-${group.id}`}>
                {group.name}
              </h3>
              {isSystem && (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700" data-testid={`badge-system-${group.id}`}>
                  <Lock className="w-3 h-3 mr-1" />
                  Systémová
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-group-desc-${group.id}`}>
              {group.description || "Bez popisu"}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs" data-testid={`badge-group-timeout-${group.id}`}>
                {Math.floor((group.sessionTimeoutSeconds ?? 180) / 60)} min {(group.sessionTimeoutSeconds ?? 180) % 60} sek
              </Badge>
              {linkedClientGroup ? (
                <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950/30" data-testid={`badge-client-group-${group.id}`}>
                  <Link2 className="w-3 h-3 mr-1" />
                  {linkedClientGroup.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-no-client-group-${group.id}`}>
                  Bez skupiny klientov
                </Badge>
              )}
              {isSelected && (
                <Badge variant="secondary" className="text-xs">Vybrana</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={e => { e.stopPropagation(); onEdit(); }}
              data-testid={`button-edit-group-${group.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {!isSystem && (
              <div onClick={e => e.stopPropagation()}>
                <ConditionalDelete canDelete={userCount === 0} onClick={onDelete} testId={`button-delete-group-${group.id}`} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PinField({ userId, currentPin }: { userId: number; currentPin: string | null | undefined }) {
  const { toast } = useToast();
  const [value, setValue] = useState(currentPin ?? "");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = value !== (currentPin ?? "");

  async function handleSave() {
    if (value && !/^\d{4}$/.test(value)) {
      toast({ title: "Chyba", description: "PIN musí mať presne 4 číslice (0-9)", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/app-users/${userId}`, { kokpitPin: value || null });
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
      toast({ title: "Uložené", description: "PIN bol aktualizovaný" });
    } catch (err: any) {
      toast({ title: "Chyba", description: err?.message || "Uloženie zlyhalo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          placeholder="0000"
          className="w-24 h-8 text-sm pr-7 font-mono"
          data-testid={`input-pin-${userId}`}
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          data-testid={`button-pin-toggle-${userId}`}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {isDirty && (
        <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving} data-testid={`button-pin-save-${userId}`}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Uložiť"}
        </Button>
      )}
    </div>
  );
}

function BackOfficeMembersPanel({ groupId }: { groupId: number }) {
  const { toast } = useToast();

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/app-users"],
  });

  const members = allUsers.filter((u: any) => u.permissionGroupId === groupId);

  const updateMutation = useMutation({
    mutationFn: ({ id, kokpitAccess }: { id: number; kokpitAccess: boolean }) =>
      apiRequest("PATCH", `/api/app-users/${id}`, { kokpitAccess }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-semibold" data-testid="text-bo-members-title">Prístup do Kokpitu — Kancelária Back Office</h3>
        <Badge variant="outline" className="text-xs">{members.length} členov</Badge>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Žiadni členovia v tejto skupine. Priraďte používateľov cez správu používateľov.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Používateľ</TableHead>
                  <TableHead className="text-center w-40">Prístup do kokpitu</TableHead>
                  <TableHead className="w-52">PIN kód (4 číslice)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((u: any) => {
                  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
                  return (
                    <TableRow key={u.id} data-testid={`row-bo-member-${u.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm" data-testid={`text-bo-member-name-${u.id}`}>{fullName}</div>
                          <div className="text-xs text-muted-foreground">{u.username}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={!!u.kokpitAccess}
                          onCheckedChange={(checked) => updateMutation.mutate({ id: u.id, kokpitAccess: checked })}
                          disabled={updateMutation.isPending}
                          data-testid={`switch-kokpit-access-${u.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <PinField userId={u.id} currentPin={u.kokpitPin} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PermissionGroupsPage() {
  const { toast } = useToast();
  const { data: groups, isLoading: groupsLoading } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const { data: clientGroups, isLoading: clientGroupsLoading } = useQuery<ClientGroup[]>({
    queryKey: ["/api/client-groups"],
  });

  const isLoading = groupsLoading || clientGroupsLoading;

  const { data: appUsers } = useQuery<any[]>({
    queryKey: ["/api/app-users"],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const matrixColumnVisibility = useColumnVisibility("permission-matrix", PERMISSION_MATRIX_COLUMNS);
  const tableFilter = useSmartFilter(groups || [], GROUP_FILTER_COLUMNS, "permission-groups-filter");

  function getLinkedClientGroup(pgId: number): ClientGroup | null {
    return clientGroups?.find(cg => cg.permissionGroupId === pgId) ?? null;
  }

  function isSystemGroup(pgId: number): boolean {
    return getLinkedClientGroup(pgId)?.isSystem === true;
  }

  function isBackOfficeGroup(pgId: number): boolean {
    return getLinkedClientGroup(pgId)?.groupCode === "kancelaria_back_office";
  }

  const systemGroups = tableFilter.filteredData.filter(g => isSystemGroup(g.id));
  const customGroups = tableFilter.filteredData.filter(g => !isSystemGroup(g.id));

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

  function renderGroupGrid(list: PermissionGroup[]) {
    if (list.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(group => {
          const linked = getLinkedClientGroup(group.id);
          const isSystem = linked?.isSystem === true;
          const userCount = (appUsers || []).filter((u: any) => u.permissionGroupId === group.id).length;
          return (
            <GroupCard
              key={group.id}
              group={group}
              linkedClientGroup={linked}
              isSystem={isSystem}
              isSelected={selectedGroupId === group.id}
              userCount={userCount}
              onSelect={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
              onEdit={() => openEdit(group)}
              onDelete={() => setDeleteGroupId(group.id)}
            />
          );
        })}
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
          <SmartFilterBar filter={tableFilter} />
          <Button onClick={openCreate} data-testid="button-add-group">
            <Plus className="w-4 h-4 mr-2" />
            Pridat skupinu
          </Button>
        </div>
      </div>

      {tableFilter.filteredData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Ziadne skupiny pravomoci
        </div>
      ) : (
        <div className="space-y-6">
          {systemGroups.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                icon={Lock}
                title="Systémové skupiny"
                count={systemGroups.length}
                colorClass="text-amber-700 dark:text-amber-400"
                bgClass="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
              />
              {renderGroupGrid(systemGroups)}
            </div>
          )}

          {customGroups.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                icon={Users}
                title="Vlastné skupiny"
                count={customGroups.length}
                colorClass="text-blue-700 dark:text-blue-400"
                bgClass="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
              />
              {renderGroupGrid(customGroups)}
            </div>
          )}
        </div>
      )}

      {selectedGroupId && isBackOfficeGroup(selectedGroupId) && (
        <BackOfficeMembersPanel groupId={selectedGroupId} />
      )}

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
