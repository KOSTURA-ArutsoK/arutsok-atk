import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import type { ClientGroup, Subject } from "@shared/schema";
import {
  Plus, Pencil, Trash2, Loader2, Check, X,
  Calculator, LogIn, UserPlus, UserMinus, Search, ChevronRight, Building2,
} from "lucide-react";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProcessingSaveButton } from "@/components/processing-save-button";

const PERMISSION_LEVELS = [
  { value: "1", label: "Level 1 - Klient" },
  { value: "2", label: "Level 2 - Spracovatel" },
  { value: "3", label: "Level 3 - Manazer" },
  { value: "4", label: "Level 4 - Riaditel" },
  { value: "5", label: "Level 5 - Administrator" },
];

type ClientGroupWithCount = ClientGroup & { memberCount: number };
type SubGroupWithCount = { id: number; groupId: number; name: string; sortOrder: number; createdAt: string | null; memberCount: number };
type MemberWithSubject = { id: number; groupId: number; subGroupId: number | null; subjectId: number; createdAt: string | null; subject?: Subject };

function GroupDetailDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroupWithCount | null;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("vseobecne");
  const [name, setName] = useState("");
  const [allowLogin, setAllowLogin] = useState(true);
  const [allowCalculators, setAllowCalculators] = useState(true);
  const [permissionLevel, setPermissionLevel] = useState("1");
  const [subGroupName, setSubGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  const isEditing = !!group;

  useEffect(() => {
    if (open) {
      if (group) {
        setName(group.name || "");
        setAllowLogin(group.allowLogin ?? true);
        setAllowCalculators(group.allowCalculators ?? true);
        setPermissionLevel(String(group.permissionLevel ?? 1));
      } else {
        setName("");
        setAllowLogin(true);
        setAllowCalculators(true);
        setPermissionLevel("1");
      }
      setActiveTab("vseobecne");
      setSubGroupName("");
      setSearchQuery("");
      startTimeRef.current = Date.now();
    }
  }, [open, group]);

  const { data: subGroups, isLoading: subGroupsLoading } = useQuery<SubGroupWithCount[]>({
    queryKey: ["/api/client-groups", group?.id, "sub-groups"],
    queryFn: async () => {
      if (!group?.id) return [];
      const res = await fetch(`/api/client-groups/${group.id}/sub-groups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!group?.id && open,
  });

  const { data: members, isLoading: membersLoading } = useQuery<MemberWithSubject[]>({
    queryKey: ["/api/client-groups", group?.id, "members"],
    queryFn: async () => {
      if (!group?.id) return [];
      const res = await fetch(`/api/client-groups/${group.id}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!group?.id && open,
  });

  const { data: searchResults } = useQuery<Subject[]>({
    queryKey: ["/api/subjects/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const res = await fetch(`/api/subjects/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2 && open,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/client-groups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Skupina vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit skupinu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/client-groups/${group?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Skupina aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat skupinu", variant: "destructive" }),
  });

  const createSubGroupMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/client-groups/${group?.id}/sub-groups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "sub-groups"] });
      toast({ title: "Uspech", description: "Podskupina vytvorena" });
      setSubGroupName("");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit podskupinu", variant: "destructive" }),
  });

  const deleteSubGroupMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-sub-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "sub-groups"] });
      toast({ title: "Uspech", description: "Podskupina vymazana" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/client-groups/${group?.id}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Klient pridany do skupiny" });
      setSearchQuery("");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat klienta", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-group-members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Klient odobrany zo skupiny" });
    },
  });

  const reorderSubGroupsMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/client-sub-groups/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "sub-groups"] });
    },
  });

  const handleSave = () => {
    const processingTimeSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const data: any = { name, allowLogin, allowCalculators, permissionLevel: parseInt(permissionLevel) };
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const existingMemberIds = new Set(members?.map(m => m.subjectId) || []);
  const filteredSearchResults = searchResults?.filter(s => !existingMemberIds.has(s.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col" data-testid="dialog-client-group">
        <DialogHeader>
          <DialogTitle data-testid="text-group-dialog-title">
            {isEditing ? `Uprava skupiny: ${group?.name}` : "Nova skupina klientov"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-group-detail">
            <TabsTrigger value="vseobecne" data-testid="tab-vseobecne">Vseobecne</TabsTrigger>
            <TabsTrigger value="podskupiny" disabled={!isEditing} data-testid="tab-podskupiny">Podskupiny</TabsTrigger>
            <TabsTrigger value="klienti" disabled={!isEditing} data-testid="tab-klienti">Zoznam klientov</TabsTrigger>
          </TabsList>

          <TabsContent value="vseobecne" className="flex-1 space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nazov skupiny</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zadajte nazov skupiny"
                data-testid="input-group-name"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-md border">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="allow-login">Povolene prihlasenie</Label>
              </div>
              <Switch
                id="allow-login"
                checked={allowLogin}
                onCheckedChange={setAllowLogin}
                data-testid="switch-allow-login"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-md border">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="allow-calculators">Povolit kalkulacky</Label>
              </div>
              <Switch
                id="allow-calculators"
                checked={allowCalculators}
                onCheckedChange={setAllowCalculators}
                data-testid="switch-allow-calculators"
              />
            </div>

            <div className="space-y-2">
              <Label>Uroven pravomoci</Label>
              <Select value={permissionLevel} onValueChange={setPermissionLevel}>
                <SelectTrigger data-testid="select-permission-level">
                  <SelectValue placeholder="Vyberte uroven" />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_LEVELS.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <ProcessingSaveButton
                onClick={handleSave}
                isPending={createMutation.isPending || updateMutation.isPending}
              />
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("podskupiny")}
                  data-testid="button-dalej"
                >
                  Dalej <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="podskupiny" className="flex-1 space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Input
                value={subGroupName}
                onChange={(e) => setSubGroupName(e.target.value)}
                placeholder="Nazov podskupiny"
                data-testid="input-subgroup-name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subGroupName.trim()) {
                    createSubGroupMutation.mutate({ name: subGroupName.trim() });
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (subGroupName.trim()) {
                    createSubGroupMutation.mutate({ name: subGroupName.trim() });
                  }
                }}
                disabled={!subGroupName.trim() || createSubGroupMutation.isPending}
                data-testid="button-save-subgroup"
              >
                {createSubGroupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ulozit"}
              </Button>
            </div>

            {subGroupsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nazov podskupiny</TableHead>
                    <TableHead className="w-32 text-center">Pocet clenov</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext_Wrapper
                  items={subGroups || []}
                  onReorder={(items) => reorderSubGroupsMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })))}
                >
                  <TableBody>
                    {(subGroups || []).map((sg) => (
                      <SortableTableRow
                        key={sg.id}
                        id={sg.id}
                        data-testid={`row-subgroup-${sg.id}`}
                      >
                        <TableCell className="font-medium">{sg.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{sg.memberCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSubGroupMutation.mutate(sg.id)}
                            data-testid={`button-delete-subgroup-${sg.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </SortableTableRow>
                    ))}
                    {(!subGroups || subGroups.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Ziadne podskupiny
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </SortableContext_Wrapper>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="klienti" className="flex-1 space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Vyhladat klienta podla mena alebo KIK ID..."
                className="pl-9"
                data-testid="input-search-client"
              />
            </div>

            {searchQuery.length >= 2 && filteredSearchResults.length > 0 && (
              <Card>
                <CardContent className="p-2">
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredSearchResults.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer"
                        onClick={() => addMemberMutation.mutate({ subjectId: s.id })}
                        data-testid={`search-result-${s.id}`}
                      >
                        <div>
                          <span className="font-medium">
                            {s.firstName} {s.lastName} {s.companyName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">{s.uid}</span>
                        </div>
                        <UserPlus className="w-4 h-4 text-primary" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {membersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meno</TableHead>
                    <TableHead>KIK ID</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(members || []).map((m) => (
                    <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                      <TableCell className="font-medium">
                        {m.subject?.firstName} {m.subject?.lastName} {m.subject?.companyName}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{m.subject?.uid || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeMemberMutation.mutate(m.id)}
                          data-testid={`button-remove-member-${m.id}`}
                        >
                          <UserMinus className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!members || members.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Ziadni clenovia v skupine
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientGroups() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ClientGroupWithCount | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<ClientGroupWithCount | null>(null);

  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();

  const { data: groups, isLoading } = useQuery<ClientGroupWithCount[]>({
    queryKey: ["/api/client-groups"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/client-groups/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      toast({ title: "Uspech", description: "Skupina vymazana" });
      setDeletingGroup(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat skupinu", variant: "destructive" }),
  });

  // Find the active company name
  const activeCompanyName = appUser?.activeCompanyId
    ? companies?.find(c => c.id === appUser.activeCompanyId)?.name
    : undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Skupiny klientov</h1>
        <Button
          onClick={() => { setEditingGroup(null); setDialogOpen(true); }}
          data-testid="button-add-group"
        >
          <Plus className="w-4 h-4 mr-2" />
          Pridat skupinu
        </Button>
      </div>

      {activeCompanyName && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md border border-border" data-testid="header-active-company">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filtrovane podla firmy:</span>
          <span className="text-sm font-medium" data-testid="text-active-company-name">{activeCompanyName}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nazov skupiny</TableHead>
                  <TableHead className="w-36 text-center">Uroven pravomoci</TableHead>
                  <TableHead className="w-32 text-center">Povolenie prihlasenia</TableHead>
                  <TableHead className="w-32 text-center">Povolene kalkulacky</TableHead>
                  <TableHead className="w-32 text-center">Pocet klientov</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext_Wrapper
                items={groups || []}
                onReorder={(items) => reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })))}
              >
                <TableBody>
                  {(groups || []).map((group) => (
                    <SortableTableRow
                      key={group.id}
                      id={group.id}
                      data-testid={`row-group-${group.id}`}
                    >
                      <TableCell
                        className="font-medium cursor-pointer hover-elevate"
                        onClick={() => { setEditingGroup(group); setDialogOpen(true); }}
                      >
                        {group.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" data-testid={`badge-level-${group.id}`}>
                          {PERMISSION_LEVELS.find(l => l.value === String(group.permissionLevel))?.label || `Level ${group.permissionLevel}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {group.allowLogin ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" data-testid={`icon-login-${group.id}`} />
                        ) : (
                          <X className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-login-${group.id}`} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {group.allowCalculators ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" data-testid={`icon-calc-${group.id}`} />
                        ) : (
                          <X className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-calc-${group.id}`} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" data-testid={`badge-count-${group.id}`}>{group.memberCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingGroup(group); setDialogOpen(true); }}
                            data-testid={`button-edit-group-${group.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingGroup(group)}
                            data-testid={`button-delete-group-${group.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </SortableTableRow>
                  ))}
                  {(!groups || groups.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Ziadne skupiny klientov
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </SortableContext_Wrapper>
            </Table>
          )}
        </CardContent>
      </Card>

      <GroupDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editingGroup}
      />

      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat skupinu?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vymazat skupinu "{deletingGroup?.name}"? Vsetci clenovia budu odobrani.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGroup && deleteMutation.mutate(deletingGroup.id)}
              className="bg-destructive text-destructive-foreground"
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
