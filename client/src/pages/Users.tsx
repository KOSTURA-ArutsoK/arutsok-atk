import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, formatUid } from "@/lib/utils";
const SECURITY_LEVEL_LABELS: Record<number, string> = {
  1: "Štandardná", 2: "Rozšírená", 3: "Plná",
};
const SECURITY_LEVEL_SHORT: Record<number, string> = {
  1: "Štd", 2: "Rozš", 3: "Plná",
};
import { Loader2, Plus, Pencil, Users as UsersIcon, Shield, LogIn, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppUser, PermissionGroup, ClientGroup } from "@shared/schema";
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { HelpIcon } from "@/components/help-icon";
import { useAppUser } from "@/hooks/use-app-user";
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
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";

const USER_COLUMNS: ColumnDef[] = [
  { key: "firstName", label: "Meno" },
  { key: "lastName", label: "Priezvisko" },
  { key: "uid", label: "UID" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefon" },
  { key: "role", label: "Rola" },
  { key: "mfaType", label: "MFA" },
  { key: "securityLevel", label: "Bezp. uroven" },
  { key: "permissionGroupId", label: "Skupina" },
];

const USER_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "firstName", label: "Meno", type: "text" },
  { key: "lastName", label: "Priezvisko", type: "text" },
  { key: "uid", label: "UID", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Telefon", type: "number" },
  { key: "role", label: "Rola", type: "text" },
  { key: "mfaType", label: "MFA", type: "text" },
  { key: "securityLevel", label: "Bezp. uroven", type: "number" },
];

const ROLES = ["architekt", "superadmin", "admin", "backoffice", "manager", "user"] as const;

const ROLE_LABELS: Record<string, string> = {
  architekt: "Architekt (L8)",
  auditor: "Audítor (L9)",
  prezident: "Prezident (L7)",
  superadmin: "Riaditeľ (L6)",
  admin: "Manažér (L5)",
  backoffice: "Backoffice",
  manager: "Manager",
  user: "Obchodník (L4)",
};

const MFA_OPTIONS = [
  { value: "none", label: "Ziadne" },
  { value: "email", label: "Email" },
  { value: "mobile", label: "Mobil" },
  { value: "both", label: "Obe" },
];

const MFA_LABELS: Record<string, string> = {
  none: "Ziadne",
  email: "Email",
  mobile: "Mobil",
  both: "Obe",
};

interface UserFormData {
  username: string;
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  mfaType: string;
  securityLevel: number;
  permissionGroupId: number | null;
  adminCode: string;
  allowedIps: string;
  institutionName: string;
  credentialNumber: string;
}

const emptyForm: UserFormData = {
  username: "",
  uid: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "user",
  mfaType: "none",
  securityLevel: 1,
  permissionGroupId: null,
  adminCode: "",
  allowedIps: "",
  institutionName: "",
  credentialNumber: "",
};

function UserFormDialog({
  open,
  onOpenChange,
  editingUser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: AppUser | null;
}) {
  const { toast } = useToast();
  const { data: currentUser } = useAppUser();
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const timerRef = useRef<number>(0);
  const canEditSecurity = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'architekt' || currentUser?.role === 'prezident';

  const { data: permGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const { data: allClientGroups } = useQuery<ClientGroup[]>({
    queryKey: ["/api/client-groups"],
  });

  const { data: userGroupMemberships } = useQuery<{ id: number; groupId: number; group?: ClientGroup }[]>({
    queryKey: ["/api/users", editingUser?.id, "client-groups"],
    queryFn: async () => {
      if (!editingUser?.id) return [];
      const res = await fetch(`/api/users/${editingUser.id}/client-groups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingUser?.id && open,
  });

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  useEffect(() => {
    if (userGroupMemberships) {
      setSelectedGroupIds(userGroupMemberships.map(m => m.groupId));
    } else {
      setSelectedGroupIds([]);
    }
  }, [userGroupMemberships]);

  const saveGroupsMutation = useMutation({
    mutationFn: (data: { userId: number; groupIds: number[] }) =>
      apiRequest("PUT", `/api/users/${data.userId}/client-groups`, { groupIds: data.groupIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", editingUser?.id, "client-groups"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/app-users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Uspech", description: "Pouzivatel vytvoreny" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/app-users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Uspech", description: "Pouzivatel aktualizovany" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingUser) {
        setForm({
          username: editingUser.username,
          uid: editingUser.uid || "",
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          email: editingUser.email || "",
          phone: editingUser.phone || "",
          role: editingUser.role || "user",
          mfaType: editingUser.mfaType || "none",
          securityLevel: editingUser.securityLevel || 1,
          permissionGroupId: editingUser.permissionGroupId || null,
          adminCode: editingUser.adminCode || "",
          allowedIps: editingUser.allowedIps || "",
          institutionName: (editingUser as any).institutionName || "",
          credentialNumber: (editingUser as any).credentialNumber || "",
        });
      } else {
        setForm({ ...emptyForm });
      }
    }
  }, [open, editingUser]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim()) {
      toast({ title: "Chyba", description: "Pouzivatelske meno je povinne", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);

    const payload: any = {
      username: form.username,
      uid: form.uid || null,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role,
      mfaType: form.mfaType,
      securityLevel: form.securityLevel,
      permissionGroupId: form.permissionGroupId,
      adminCode: form.adminCode || null,
      allowedIps: form.allowedIps || null,
      processingTimeSec,
    };
    if (form.role === "auditor") {
      payload.institutionName = form.institutionName || null;
      payload.credentialNumber = form.credentialNumber || null;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: { ...payload, changeReason: "User edit" } });
      saveGroupsMutation.mutate({ userId: editingUser.id, groupIds: selectedGroupIds });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-user-dialog-title">
            {editingUser ? "Upravit pouzivatela" : "Pridat pouzivatela"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pr-1">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1" data-testid="section-basic-info">Základné údaje</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pouzivatelske meno *</Label>
                <Input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  data-testid="input-user-username"
                />
              </div>
              <div className="space-y-2">
                <Label>UID (421...)</Label>
                <Input
                  value={form.uid}
                  onChange={e => setForm(f => ({ ...f, uid: e.target.value }))}
                  placeholder="01-KFS-421-..."
                  className="font-mono"
                  data-testid="input-user-uid"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meno</Label>
                <Input
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  data-testid="input-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label>Priezvisko</Label>
                <Input
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  data-testid="input-user-lastname"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="input-user-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  data-testid="input-user-phone"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rola</Label>
                <Select value={form.role} onValueChange={val => setForm(f => ({ ...f, role: val }))}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>MFA Typ</Label>
                <RadioGroup
                  value={form.mfaType}
                  onValueChange={val => setForm(f => ({ ...f, mfaType: val }))}
                  className="flex items-center gap-4 flex-wrap"
                  data-testid="radio-user-mfa"
                >
                  {MFA_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`mfa-${opt.value}`} data-testid={`radio-mfa-${opt.value}`} />
                      <Label htmlFor={`mfa-${opt.value}`} className="cursor-pointer text-sm">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 flex items-center gap-2" data-testid="section-security">
              <Shield className="w-3.5 h-3.5" />
              Správa prihlásenia a bezpečnosť
            </h4>
            <div className="space-y-2">
              <Label>Bezpečnostná úroveň</Label>
              <Select
                value={form.securityLevel.toString()}
                onValueChange={val => setForm(f => ({ ...f, securityLevel: parseInt(val) }))}
                disabled={!canEditSecurity}
              >
                <SelectTrigger data-testid="select-user-security-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SECURITY_LEVEL_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canEditSecurity && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Zmena vyžaduje admin oprávnenie</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                IP Locking
              </Label>
              <Textarea
                value={form.allowedIps}
                onChange={e => setForm(f => ({ ...f, allowedIps: e.target.value }))}
                placeholder="Jedna IP na riadok, napr.&#10;192.168.1.100&#10;10.0.0.50"
                rows={3}
                className="text-xs font-mono"
                disabled={!canEditSecurity}
                data-testid="input-user-allowed-ips"
              />
              <p className="text-[10px] text-muted-foreground">Ak je vyplnene, uzivatel sa moze prihlasit len z tychto IP adries. Prazdne = bez obmedzenia.</p>
            </div>
            <div className="space-y-2">
              <Label>Admin kód (voliteľné)</Label>
              <Input
                value={form.adminCode}
                onChange={e => setForm(f => ({ ...f, adminCode: e.target.value }))}
                disabled={!canEditSecurity}
                data-testid="input-user-admin-code"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1" data-testid="section-organization">Organizačné zaradenie</h4>
            <div className="space-y-2">
              <Label>Skupina pravomocí</Label>
              <Select
                value={form.permissionGroupId?.toString() || "none"}
                onValueChange={val => setForm(f => ({ ...f, permissionGroupId: val === "none" ? null : parseInt(val) }))}
              >
                <SelectTrigger data-testid="select-user-permission-group">
                  <SelectValue placeholder="Ziadna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ziadna</SelectItem>
                  {permGroups?.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2" style={{ display: editingUser ? 'block' : 'none' }}>
              <Label>Skupiny klientov (multi-priradenie)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto" data-testid="section-user-client-groups">
                {allClientGroups && allClientGroups.length > 0 ? (
                  allClientGroups.map(g => (
                    <div key={g.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`ucg-${g.id}`}
                        checked={selectedGroupIds.includes(g.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGroupIds(prev => [...prev, g.id]);
                          } else {
                            setSelectedGroupIds(prev => prev.filter(id => id !== g.id));
                          }
                        }}
                        data-testid={`checkbox-group-${g.id}`}
                      />
                      <Label htmlFor={`ucg-${g.id}`} className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                        {g.name}
                        <Badge variant="outline" className="text-xs">
                          {g.permissionGroupId
                            ? permGroups?.find(pg => pg.id === g.permissionGroupId)?.name || "—"
                            : "—"}
                        </Badge>
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Ziadne skupiny klientov</p>
                )}
              </div>
              <div style={{ display: selectedGroupIds.length > 0 ? 'flex' : 'none' }} className="items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Skupiny pravomoci:</span>
                {(() => {
                  const linkedPgIds = new Set<number>();
                  selectedGroupIds.forEach(id => {
                    const cg = allClientGroups?.find(g => g.id === id);
                    if (cg?.permissionGroupId) linkedPgIds.add(cg.permissionGroupId);
                  });
                  const pgNames = Array.from(linkedPgIds).map(pgId => permGroups?.find(pg => pg.id === pgId)?.name).filter(Boolean);
                  return pgNames.length > 0 ? pgNames.map((n, i) => (
                    <Badge key={i} variant="secondary" data-testid={`badge-perm-group-${i}`}>{n}</Badge>
                  )) : <Badge variant="secondary" data-testid="badge-effective-level">—</Badge>;
                })()}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Zmeny su archivovane v historii (immutable history).
          </p>

          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-user-cancel">
              Zrusit
            </Button>
          </div>

          <ProcessingSaveButton isPending={isPending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImpersonateButton({ targetUser, currentUser }: { targetUser: AppUser; currentUser: any }) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/impersonate/${targetUser.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Impersonation aktivovaná", description: `Vstupujete do kontextu: ${targetUser.firstName} ${targetUser.lastName}` });
      setTimeout(() => window.location.reload(), 500);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktivovať impersonation", variant: "destructive" }),
  });

  if (!currentUser || currentUser.role !== "architekt") return null;
  if (targetUser.id === currentUser.id) return null;

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        title="Vstúpiť ako..."
        data-testid={`button-impersonate-user-${targetUser.id}`}
      >
        <LogIn className="w-4 h-4 text-orange-500" />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vstúpiť ako...</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vstúpiť do kontextu používateľa <strong>{targetUser.firstName} {targetUser.lastName}</strong>?
              Uvidíte systém presne tak, ako ho vidí tento používateľ. Táto akcia bude zaznamenaná v auditnom logu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-impersonate-cancel">Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => impersonateMutation.mutate()}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-impersonate-confirm"
            >
              {impersonateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Vstúpiť ako {targetUser.firstName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function UsersPage() {
  const { data: currentAppUser } = useAppUser();
  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });

  const { data: permGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const tableFilter = useSmartFilter(users || [], USER_FILTER_COLUMNS, "users");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("users", USER_COLUMNS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  function openCreate() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  function getGroupName(groupId: number | null) {
    if (!groupId || !permGroups) return "-";
    const g = permGroups.find(p => p.id === groupId);
    return g?.name || "-";
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
            <UsersIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold" data-testid="text-users-title">Pouzivatelia</h1>
              <HelpIcon text="Sprava pouzivatelov systemu. Priradenie roli, pristupovych prav a aktivneho kontextu." side="right" />
            </div>
            <p className="text-sm text-muted-foreground">Sprava pouzivatelov systemu</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={openCreate} data-testid="button-add-user">
            <Plus className="w-4 h-4 mr-2" />
            Pridat pouzivatela
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("firstName") && <TableHead sortKey="firstName" sortDirection={sortKey === "firstName" ? sortDirection : null} onSort={requestSort}>Meno</TableHead>}
                {columnVisibility.isVisible("lastName") && <TableHead sortKey="lastName" sortDirection={sortKey === "lastName" ? sortDirection : null} onSort={requestSort}>Priezvisko</TableHead>}
                {columnVisibility.isVisible("uid") && <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>}
                {columnVisibility.isVisible("email") && <TableHead sortKey="email" sortDirection={sortKey === "email" ? sortDirection : null} onSort={requestSort}>Email</TableHead>}
                {columnVisibility.isVisible("phone") && <TableHead sortKey="phone" sortDirection={sortKey === "phone" ? sortDirection : null} onSort={requestSort}>Telefon</TableHead>}
                {columnVisibility.isVisible("role") && <TableHead sortKey="role" sortDirection={sortKey === "role" ? sortDirection : null} onSort={requestSort}>Rola</TableHead>}
                {columnVisibility.isVisible("mfaType") && <TableHead sortKey="mfaType" sortDirection={sortKey === "mfaType" ? sortDirection : null} onSort={requestSort}>MFA</TableHead>}
                {columnVisibility.isVisible("securityLevel") && <TableHead sortKey="securityLevel" sortDirection={sortKey === "securityLevel" ? sortDirection : null} onSort={requestSort}>Bezp. uroven</TableHead>}
                {columnVisibility.isVisible("permissionGroupId") && <TableHead>Skupina</TableHead>}
                <TableHead>Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData && sortedData.length > 0 ? (
                sortedData.map(user => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`} onRowClick={() => openEdit(user)}>
                    {columnVisibility.isVisible("firstName") && <TableCell data-testid={`text-user-firstname-${user.id}`}>
                      {user.firstName || "-"}
                    </TableCell>}
                    {columnVisibility.isVisible("lastName") && <TableCell data-testid={`text-user-lastname-${user.id}`}>
                      {user.lastName || "-"}
                    </TableCell>}
                    {columnVisibility.isVisible("uid") && <TableCell data-testid={`text-user-uid-${user.id}`}>
                      <span className="font-mono text-xs">{formatUid(user.uid) || "-"}</span>
                    </TableCell>}
                    {columnVisibility.isVisible("email") && <TableCell data-testid={`text-user-email-${user.id}`}>
                      {user.email || "-"}
                    </TableCell>}
                    {columnVisibility.isVisible("phone") && <TableCell data-testid={`text-user-phone-${user.id}`}>
                      {formatPhone(user.phone)}
                    </TableCell>}
                    {columnVisibility.isVisible("role") && <TableCell>
                      <Badge variant="secondary" data-testid={`badge-user-role-${user.id}`}>
                        {ROLE_LABELS[user.role || "user"] || user.role}
                      </Badge>
                    </TableCell>}
                    {columnVisibility.isVisible("mfaType") && <TableCell data-testid={`text-user-mfa-${user.id}`}>
                      {MFA_LABELS[user.mfaType || "none"] || user.mfaType}
                    </TableCell>}
                    {columnVisibility.isVisible("securityLevel") && <TableCell>
                      <Badge variant="outline" className={`${
                        (user.securityLevel ?? 1) >= 3 ? "border-amber-500/40 text-amber-400" :
                        (user.securityLevel ?? 1) >= 2 ? "border-blue-500/40 text-blue-400" :
                        "border-zinc-500/40 text-zinc-400"
                      }`} data-testid={`badge-user-sl-${user.id}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {SECURITY_LEVEL_SHORT[user.securityLevel ?? 1] || "Štd"}
                      </Badge>
                    </TableCell>}
                    {columnVisibility.isVisible("permissionGroupId") && <TableCell data-testid={`text-user-group-${user.id}`}>
                      {getGroupName(user.permissionGroupId)}
                    </TableCell>}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <ImpersonateButton targetUser={user} currentUser={currentAppUser} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Ziadni pouzivatelia
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUser={editingUser}
      />
    </div>
  );
}
