import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatUid } from "@/lib/utils";
import { useTableSort } from "@/hooks/use-table-sort";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import type { ClientGroup, Subject, PermissionGroup } from "@shared/schema";
import {
  Plus, Pencil, Loader2, Check, X,
  Calculator, LogIn, UserPlus, UserMinus, Search, ChevronRight, Building2, Shield, Lock, Ban,
} from "lucide-react";
import { ConditionalDelete } from "@/components/conditional-delete";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Eye } from "lucide-react";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";


type ClientGroupWithCount = ClientGroup & { memberCount: number; isHoldingGroup?: boolean; linkedCompanyId?: number | null; isPartnerGroup?: boolean; linkedPartnerId?: number | null };
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
  const [entityType, setEntityType] = useState("fyzicka_osoba");
  const [allowLogin, setAllowLogin] = useState(true);
  const [allowCalculators, setAllowCalculators] = useState(true);
  const [permissionGroupId, setPermissionGroupId] = useState("");
  const [subGroupName, setSubGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [customFields, setCustomFields] = useState<Array<{ name: string; type: string }>>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  const isEditing = !!group;
  const isSystem = !!group?.isSystem;
  const isHolding = !!(group as ClientGroupWithCount)?.isHoldingGroup;
  const isPartner = !!(group as ClientGroupWithCount)?.isPartnerGroup;
  const isBlacklist = (group as any)?.groupCode === "group_cierny_zoznam";

  useEffect(() => {
    if (open) {
      if (group) {
        setName(group.name || "");
        setEntityType((group as any).entityType || "fyzicka_osoba");
        setAllowLogin(group.allowLogin ?? true);
        setAllowCalculators(group.allowCalculators ?? true);
        setPermissionGroupId(group.permissionGroupId ? String(group.permissionGroupId) : "");
        setCustomFields(Array.isArray((group as any).customFields) ? (group as any).customFields : []);
      } else {
        setName("");
        setEntityType("fyzicka_osoba");
        setAllowLogin(true);
        setAllowCalculators(true);
        setPermissionGroupId("");
        setCustomFields([]);
      }
      setActiveTab("vseobecne");
      setSubGroupName("");
      setSearchQuery("");
      setBlacklistReason("");
      setNewFieldName("");
      setNewFieldType("text");
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

  const { data: permissionGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
    enabled: open,
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
    mutationFn: (data: any) => {
      const body = isBlacklist ? { ...data, reason: blacklistReason } : data;
      return apiRequest("POST", `/api/client-groups/${group?.id}/members`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", group?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/black-list/recent"] });
      toast({ title: "Uspech", description: isBlacklist ? "Subjekt zaradený na čierny zoznam" : "Klient pridany do skupiny" });
      setSearchQuery("");
      if (isBlacklist) setBlacklistReason("");
    },
    onError: async (error: any) => {
      let msg = "Nepodarilo sa pridat klienta";
      try {
        if (error?.message) msg = error.message;
      } catch {}
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    },
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
    const data: any = { name, entityType, allowLogin, allowCalculators, permissionGroupId: permissionGroupId ? parseInt(permissionGroupId) : null, customFields };
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields([...customFields, { name: newFieldName.trim(), type: newFieldType }]);
    setNewFieldName("");
    setNewFieldType("text");
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const existingMemberIds = new Set(members?.map(m => m.subjectId) || []);
  const filteredSearchResults = searchResults?.filter(s => !existingMemberIds.has(s.id)) || [];
  const { sortedData: sortedMembers, sortKey: memberSortKey, sortDirection: memberSortDirection, requestSort: memberRequestSort } = useTableSort(members || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="flex flex-col" data-testid="dialog-client-group">
        <DialogHeader>
          <DialogTitle data-testid="text-group-dialog-title">
            <span className="inline-flex items-center gap-2">
              {isPartner ? <Lock className="w-4 h-4 text-red-500" /> : isHolding ? <Lock className="w-4 h-4 text-blue-500" /> : isSystem ? <Lock className="w-4 h-4 text-amber-500" /> : null}
              {isEditing ? `Uprava skupiny: ${group?.name}` : "Nova skupina klientov"}
              {isPartner ? <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">Partner</Badge>
                : isHolding ? <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-500">Holding</Badge>
                : isSystem ? <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">Systemova</Badge>
                : null}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-between" data-testid="tabs-group-detail">
            <TabsTrigger value="vseobecne" data-testid="tab-vseobecne">Vseobecne</TabsTrigger>
            <TabsTrigger value="podskupiny" disabled={!isEditing} data-testid="tab-podskupiny">Podskupiny</TabsTrigger>
            <TabsTrigger value="klienti" disabled={!isEditing} data-testid="tab-klienti">Klienti</TabsTrigger>
            <TabsTrigger value="polia" disabled={!isEditing} data-testid="tab-polia">Vlastné polia</TabsTrigger>
          </TabsList>

          <TabsContent value="vseobecne" className="flex-1 space-y-4 mt-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="space-y-4">
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

            <div className="space-y-2">
              <Label>Typ subjektu</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="Vyberte typ subjektu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fyzicka_osoba">Fyzicka osoba</SelectItem>
                  <SelectItem value="pravnicka_osoba">Pravnicka osoba / SZCO</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Skupina pravomoci</Label>
              <Select value={permissionGroupId} onValueChange={setPermissionGroupId}>
                <SelectTrigger data-testid="select-permission-group">
                  <SelectValue placeholder="Vyberte skupinu pravomoci" />
                </SelectTrigger>
                <SelectContent>
                  {(permissionGroups || []).map(pg => (
                    <SelectItem key={pg.id} value={String(pg.id)}>{pg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <ProcessingSaveButton
                isPending={createMutation.isPending || updateMutation.isPending}
              />
              {isEditing && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setActiveTab("podskupiny")}
                  data-testid="button-dalej"
                >
                  Dalej <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            </div>
            </form>
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
                          <ConditionalDelete canDelete={sg.memberCount === 0} onClick={() => deleteSubGroupMutation.mutate(sg.id)} testId={`button-delete-subgroup-${sg.id}`} />
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
            {isBlacklist && (
              <div className="space-y-2 p-3 rounded border-2 border-red-800 bg-red-950/30">
                <Label className="text-red-300 font-semibold text-sm flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  Dôvod zaradenia na čierny zoznam *
                </Label>
                <Textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="Uveďte dôvod zaradenia subjektu na čierny zoznam..."
                  className="min-h-[60px] border-red-800/50"
                  data-testid="input-blacklist-reason"
                />
                {!blacklistReason.trim() && (
                  <p className="text-xs text-red-400">Dôvod je povinný pred pridaním subjektu</p>
                )}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Vyhladat klienta podla mena alebo KIK ID..."
                className="pl-9"
                data-testid="input-search-client"
                disabled={isBlacklist && !blacklistReason.trim()}
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
                        onClick={() => {
                          if (isBlacklist && !blacklistReason.trim()) {
                            toast({ title: "Chyba", description: "Najprv vyplňte dôvod zaradenia na čierny zoznam", variant: "destructive" });
                            return;
                          }
                          addMemberMutation.mutate({ subjectId: s.id });
                        }}
                        data-testid={`search-result-${s.id}`}
                      >
                        <div>
                          <span className="font-medium">
                            {s.firstName} {s.lastName} {s.companyName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">{formatUid(s.uid)}</span>
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
                    <TableHead sortKey="subject.firstName" sortDirection={memberSortKey === "subject.firstName" ? memberSortDirection : null} onSort={memberRequestSort}>Meno</TableHead>
                    <TableHead sortKey="subject.uid" sortDirection={memberSortKey === "subject.uid" ? memberSortDirection : null} onSort={memberRequestSort}>KIK ID</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMembers.map((m) => (
                    <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                      <TableCell className="font-medium">
                        {m.subject?.firstName} {m.subject?.lastName} {m.subject?.companyName}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{formatUid(m.subject?.uid) || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {!isSystem && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMemberMutation.mutate(m.id)}
                            data-testid={`button-remove-member-${m.id}`}
                          >
                            <UserMinus className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
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

          <TabsContent value="polia" className="flex-1 space-y-4 mt-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-field-name">Nazov polia</Label>
                <Input
                  id="new-field-name"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Napr. Cislo dokladu"
                  data-testid="input-custom-field-name"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
                />
              </div>
              <div className="w-36 space-y-1">
                <Label>Typ</Label>
                <Select value={newFieldType} onValueChange={setNewFieldType}>
                  <SelectTrigger data-testid="select-custom-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Cislo</SelectItem>
                    <SelectItem value="date">Datum</SelectItem>
                    <SelectItem value="boolean">Ano/Nie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={addCustomField} disabled={!newFieldName.trim()} data-testid="button-add-custom-field">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {customFields.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazov polia</TableHead>
                    <TableHead className="w-28">Typ</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customFields.map((field, i) => (
                    <TableRow key={i} data-testid={`row-custom-field-${i}`}>
                      <TableCell className="font-medium">{field.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{field.type === "text" ? "Text" : field.type === "number" ? "Cislo" : field.type === "date" ? "Datum" : "Ano/Nie"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeCustomField(i)} data-testid={`button-remove-field-${i}`}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8 text-sm">
                Ziadne vlastne polia
              </div>
            )}

            <div className="flex justify-end pt-2">
              <ProcessingSaveButton
                isPending={updateMutation.isPending}
                onClick={handleSave}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const CLIENT_GROUPS_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nazov skupiny" },
  { key: "permissionGroup", label: "Skupina pravomoci" },
  { key: "allowLogin", label: "Povolenie prihlasenia" },
  { key: "allowCalculators", label: "Povolene kalkulacky" },
  { key: "memberCount", label: "Pocet klientov" },
];

const CLIENT_GROUPS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Nazov skupiny", type: "text" },
  { key: "memberCount", label: "Pocet klientov", type: "number" },
];

export default function ClientGroups() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ClientGroupWithCount | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<ClientGroupWithCount | null>(null);

  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();

  const { data: groupsRaw, isLoading } = useQuery<ClientGroupWithCount[]>({
    queryKey: ["/api/client-groups"],
  });
  // Filter out individual partner groups — displayed as single "PARTNERI" synthetic row
  const groups = groupsRaw?.filter(g => !g.isPartnerGroup);

  const { data: partnerCountData } = useQuery<{ count: number; divisionId: number | null }>({
    queryKey: ["/api/partners/active-count"],
  });

  const { data: permGroupsData } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });
  const groupFilter = useSmartFilter(groups || [], CLIENT_GROUPS_FILTER_COLUMNS, "client-groups");
  const columnVisibility = useColumnVisibility("client-groups", CLIENT_GROUPS_COLUMNS);

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
      <div className="flex items-center justify-between gap-4 flex-wrap w-full">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Skupiny klientov</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={groupFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button
            onClick={() => { setEditingGroup(null); setDialogOpen(true); }}
            data-testid="button-add-group"
          >
            <Plus className="w-4 h-4 mr-2" />
            Pridat skupinu
          </Button>
        </div>
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
            <Table stickyHeader className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  {columnVisibility.isVisible("name") && <TableHead>Nazov skupiny</TableHead>}
                  {columnVisibility.isVisible("permissionGroup") && <TableHead className="w-36 text-center">Skupina pravomoci</TableHead>}
                  {columnVisibility.isVisible("allowLogin") && <TableHead className="w-28 text-center">Povolenie prihlasenia</TableHead>}
                  {columnVisibility.isVisible("allowCalculators") && <TableHead className="w-28 text-center">Povolene kalkulacky</TableHead>}
                  {columnVisibility.isVisible("memberCount") && <TableHead className="w-28 text-center">Pocet klientov</TableHead>}
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext_Wrapper
                items={groupFilter.filteredData}
                onReorder={(items) => reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })))}
              >
                <TableBody>
                  {/* Synthetic PARTNERI row — počet unikátnych partnerov s aspoň 1 zmluvou v divízii */}
                  <TableRow data-testid="row-partneri-synthetic" className="bg-red-500/5 border-l-2 border-l-red-500">
                    <TableCell></TableCell>
                    {columnVisibility.isVisible("name") && (
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          PARTNERI
                          <Badge variant="outline" className="text-[9px] h-4 border-red-500/50 text-red-500">Partner</Badge>
                        </span>
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("permissionGroup") && <TableCell></TableCell>}
                    {columnVisibility.isVisible("allowLogin") && <TableCell></TableCell>}
                    {columnVisibility.isVisible("allowCalculators") && <TableCell></TableCell>}
                    {columnVisibility.isVisible("memberCount") && (
                      <TableCell className="text-center">
                        <span className="font-semibold text-red-500" data-testid="count-partneri">
                          {partnerCountData?.count ?? "—"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell></TableCell>
                  </TableRow>
                  {groupFilter.filteredData.map((group) => (
                    <SortableTableRow
                      key={group.id}
                      id={group.id}
                      data-testid={`row-group-${group.id}`}
                      onRowClick={() => { setEditingGroup(group); setDialogOpen(true); }}
                    >
                      {columnVisibility.isVisible("name") && <TableCell
                        className="font-medium cursor-pointer hover-elevate"
                        onClick={() => { setEditingGroup(group); setDialogOpen(true); }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {group.isPartnerGroup
                            ? <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            : group.isHoldingGroup
                              ? <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              : group.isSystem
                                ? <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                : null}
                          {group.name}
                          {group.isPartnerGroup
                            ? <Badge variant="outline" className="text-[9px] h-4 border-red-500/50 text-red-500">Partner</Badge>
                            : group.isHoldingGroup
                              ? <Badge variant="outline" className="text-[9px] h-4 border-blue-500/50 text-blue-500">Holding</Badge>
                              : group.isSystem
                                ? <Badge variant="outline" className="text-[9px] h-4 border-amber-500/50 text-amber-500">Systémová</Badge>
                                : null}
                        </span>
                      </TableCell>}
                      {columnVisibility.isVisible("permissionGroup") && <TableCell className="text-center">
                        <Badge variant="outline" data-testid={`badge-level-${group.id}`}>
                          {group.permissionGroupId
                            ? (permGroupsData || []).find(pg => pg.id === group.permissionGroupId)?.name || "—"
                            : "—"}
                        </Badge>
                      </TableCell>}
                      {columnVisibility.isVisible("allowLogin") && <TableCell className="text-center">
                        {group.allowLogin ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" data-testid={`icon-login-${group.id}`} />
                        ) : (
                          <X className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-login-${group.id}`} />
                        )}
                      </TableCell>}
                      {columnVisibility.isVisible("allowCalculators") && <TableCell className="text-center">
                        {group.allowCalculators ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" data-testid={`icon-calc-${group.id}`} />
                        ) : (
                          <X className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-calc-${group.id}`} />
                        )}
                      </TableCell>}
                      {columnVisibility.isVisible("memberCount") && <TableCell className="text-center">
                        <Badge variant="secondary" data-testid={`badge-count-${group.id}`}>{group.memberCount}</Badge>
                      </TableCell>}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-actions-group-${group.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!group.isPartnerGroup && !group.isHoldingGroup && (
                              <DropdownMenuItem
                                onClick={() => { setEditingGroup(group); setDialogOpen(true); }}
                                data-testid={`menu-edit-group-${group.id}`}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Upraviť
                              </DropdownMenuItem>
                            )}
                            {!group.isSystem && !group.isHoldingGroup && !group.isPartnerGroup && (
                              <DropdownMenuItem
                                onClick={() => setDeletingGroup(group)}
                                disabled={group.memberCount > 0}
                                className="text-destructive focus:text-destructive"
                                data-testid={`menu-delete-group-${group.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Vymazať
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
