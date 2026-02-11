import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Users as UsersIcon, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { AppUser, PermissionGroup } from "@shared/schema";
import { WameSaveButton } from "@/components/wame-save-button";

const ROLES = ["superadmin", "admin", "backoffice", "manager", "user"] as const;

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  backoffice: "Backoffice",
  manager: "Manager",
  user: "Pouzivatel",
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
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  mfaType: string;
  securityLevel: number;
  permissionGroupId: number | null;
  adminCode: string;
}

const emptyForm: UserFormData = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "user",
  mfaType: "none",
  securityLevel: 1,
  permissionGroupId: null,
  adminCode: "",
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
  const [form, setForm] = useState<UserFormData>(emptyForm);

  const { data: permGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
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

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      if (editingUser) {
        setForm({
          username: editingUser.username,
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          email: editingUser.email || "",
          phone: editingUser.phone || "",
          role: editingUser.role || "user",
          mfaType: editingUser.mfaType || "none",
          securityLevel: editingUser.securityLevel || 1,
          permissionGroupId: editingUser.permissionGroupId || null,
          adminCode: editingUser.adminCode || "",
        });
      } else {
        setForm({ ...emptyForm });
      }
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim()) {
      toast({ title: "Chyba", description: "Pouzivatelske meno je povinne", variant: "destructive" });
      return;
    }

    const payload: any = {
      username: form.username,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role,
      mfaType: form.mfaType,
      securityLevel: form.securityLevel,
      permissionGroupId: form.permissionGroupId,
      adminCode: form.adminCode || null,
    };

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: { ...payload, changeReason: "User edit" } });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-user-dialog-title">
            {editingUser ? "Upravit pouzivatela" : "Pridat pouzivatela"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pouzivatelske meno *</Label>
            <Input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              data-testid="input-user-username"
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bezpecnostna uroven</Label>
              <Select
                value={form.securityLevel.toString()}
                onValueChange={val => setForm(f => ({ ...f, securityLevel: parseInt(val) }))}
              >
                <SelectTrigger data-testid="select-user-security-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skupina pravomoci</Label>
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
          </div>

          <div className="space-y-2">
            <Label>Admin kod (volitelne)</Label>
            <Input
              value={form.adminCode}
              onChange={e => setForm(f => ({ ...f, adminCode: e.target.value }))}
              data-testid="input-user-admin-code"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Zmeny su archivovane v historii (immutable history).
          </p>

          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-user-cancel">
              Zrusit
            </Button>
          </div>

          <WameSaveButton isPending={isPending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });

  const { data: permGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

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
            <h1 className="text-xl font-bold" data-testid="text-users-title">Pouzivatelia</h1>
            <p className="text-sm text-muted-foreground">Sprava pouzivatelov systemu</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-2" />
          Pridat pouzivatela
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meno</TableHead>
                <TableHead>Priezvisko</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Bezp. uroven</TableHead>
                <TableHead>Skupina</TableHead>
                <TableHead>Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.length > 0 ? (
                users.map(user => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell data-testid={`text-user-firstname-${user.id}`}>
                      {user.firstName || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-user-lastname-${user.id}`}>
                      {user.lastName || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-user-email-${user.id}`}>
                      {user.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-user-phone-${user.id}`}>
                      {user.phone || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`badge-user-role-${user.id}`}>
                        {ROLE_LABELS[user.role || "user"] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-user-mfa-${user.id}`}>
                      {MFA_LABELS[user.mfaType || "none"] || user.mfaType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-user-sl-${user.id}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        SL{user.securityLevel || 1}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-user-group-${user.id}`}>
                      {getGroupName(user.permissionGroupId)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
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
