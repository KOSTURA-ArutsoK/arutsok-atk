import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatUid } from "@/lib/utils";
import { useTableSort } from "@/hooks/use-table-sort";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import type { ClientGroup, Subject, PermissionGroup, Partner, Product, MyCompany } from "@shared/schema";
import {
  Plus, Pencil, Loader2, Check, X,
  Calculator, LogIn, UserPlus, UserMinus, Search, ChevronRight, ChevronDown, Building2, Shield, Lock, Ban, HelpCircle,
} from "lucide-react";
import { ConditionalDelete } from "@/components/conditional-delete";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Eye } from "lucide-react";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

// ============================================================
// PARTNER GROUP DIALOG — opens on PARTNERI row click
// Filtered by active division via sectors.partnerIds
// Tab "Klienti" = partners of this division
// Tab "Produkty" = products (from global catalog) linked to those partners
// ============================================================
type SectorRaw = { id: number; divisionId: number | null; partnerIds: number[] | null };

function PartnerGroupDialog({
  open,
  onOpenChange,
  activeDivisionId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeDivisionId: number | null | undefined;
}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("klienti");
  const [search, setSearch] = useState("");

  // 1. Fetch all partners (already state-filtered by server)
  const { data: allPartners, isLoading: partnersLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    enabled: open,
  });

  // 2. Fetch sectors for the active division to get partnerIds
  const { data: divSectors, isLoading: sectorsLoading } = useQuery<SectorRaw[]>({
    queryKey: ["/api/sectors", activeDivisionId],
    queryFn: async () => {
      const url = activeDivisionId
        ? `/api/sectors?divisionId=${activeDivisionId}`
        : "/api/sectors";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    enabled: open,
  });

  // 3. Build partnerIds set from sectors of this division
  const partnerIdSet = useMemo(() => {
    const s = new Set<number>();
    for (const sec of (divSectors ?? [])) {
      for (const pid of (sec.partnerIds ?? [])) s.add(pid);
    }
    return s;
  }, [divSectors]);

  // 4. Filter partners — if division has sectors with partners, restrict to those
  const partners = useMemo(() => {
    const all = (allPartners ?? []).filter(p => !p.isDeleted);
    if (partnerIdSet.size === 0) return all;
    return all.filter(p => partnerIdSet.has(p.id));
  }, [allPartners, partnerIdSet]);

  // 5. Fetch products linked to partners of this division
  const { data: allProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const products = useMemo(() => {
    const all = (allProducts ?? []).filter(p => !p.isDeleted);
    if (partnerIdSet.size === 0) return all;
    return all.filter(p => p.partnerId != null && partnerIdSet.has(p.partnerId));
  }, [allProducts, partnerIdSet]);

  const isLoading = partnersLoading || sectorsLoading;

  const lc = (s: string) => s.toLowerCase();
  const filteredPartners = search.length >= 2
    ? partners.filter(p => lc(p.name).includes(lc(search)) || (p.ico || "").includes(search))
    : partners;

  const filteredProducts = search.length >= 2
    ? products.filter(p => lc(p.name).includes(lc(search)))
    : products;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" />
              PARTNERI
              <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">Partner</Badge>
            </span>
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
            <TabsTrigger value="klienti" data-testid="tab-partneri-klienti">
              Klienti
              <Badge variant="secondary" className="ml-1.5 text-[9px]">{partners.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="produkty" data-testid="tab-partneri-produkty">
              Produkty
              <Badge variant="secondary" className="ml-1.5 text-[9px]">{products.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === "klienti" ? "Vyhľadať partnera..." : "Vyhľadať produkt..."}
                className="pl-9"
                data-testid="input-search-partner-group"
              />
            </div>
          </div>

          <TabsContent value="klienti" className="flex-1 overflow-auto mt-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Názov partnera</TableHead>
                    <TableHead className="w-32">UID</TableHead>
                    <TableHead className="w-32">Špecializácia</TableHead>
                    <TableHead className="w-24 text-center">Stav</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map(p => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => { onOpenChange(false); navigate("/partners"); }}
                      data-testid={`row-partner-group-${p.id}`}
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><span className="font-mono text-xs">{formatUid(p.uid)}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.specialization || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[9px]">{p.lifecycleStatus || "record"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPartners.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {search.length >= 2 ? "Žiadny partner nevyhovuje hľadaniu" : "Žiadni partneri v tejto divízii"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="produkty" className="flex-1 overflow-auto mt-3">
            {productsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Názov produktu</TableHead>
                    <TableHead className="w-36">Kód</TableHead>
                    <TableHead className="w-24 text-center">Partner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(p => {
                    const partner = (allPartners ?? []).find(pt => pt.id === p.partnerId);
                    return (
                      <TableRow key={p.id} data-testid={`row-product-group-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{p.code || "—"}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{partner?.name || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {search.length >= 2 ? "Žiadny produkt nevyhovuje hľadaniu" : "Žiadne produkty v tejto divízii"}
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

type MainCategory = "holdingove" | "systemove" | "volitelne" | "ina_spolocnost" | "globalne";

function getGroupMainCategory(g: ClientGroupWithCount): MainCategory {
  if (g.isHoldingGroup || g.isPartnerGroup) return "holdingove";
  if (g.isSystem && (g as any).groupCode === "group_cierny_zoznam") return "globalne";
  if (g.isSystem) return "systemove";
  return "volitelne";
}

function SectionCard({
  title, accentClass, badgeClass, badgeText, count, children, cta, testId,
  isCollapsed, onToggle, tooltip,
}: {
  title: string;
  accentClass: string;
  badgeClass: string;
  badgeText: string;
  count?: number;
  children: React.ReactNode;
  cta?: React.ReactNode;
  testId: string;
  isCollapsed: boolean;
  onToggle: () => void;
  tooltip?: string;
}) {
  return (
    <Card className={`border-l-4 ${accentClass}`} data-testid={testId}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
          />
          <span className="font-bold text-xs uppercase tracking-widest text-foreground/80">{title}</span>
          <Badge variant="outline" className={`text-[9px] h-4 ${badgeClass}`}>{badgeText}</Badge>
          {count !== undefined && (
            <Badge variant="secondary" className="text-[9px] h-4 ml-1">{count}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {cta}
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-yellow-700/40 text-yellow-700/50 hover:text-yellow-600/80 hover:border-yellow-600/60 transition-colors cursor-help">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      {!isCollapsed && <CardContent className="p-0">{children}</CardContent>}
    </Card>
  );
}

const SECTION_COLS = 5;
const TABLE_HEADER = (
  <TableHeader>
    <TableRow>
      <TableHead>Názov skupiny</TableHead>
      <TableHead className="w-36 text-center">Skupina právomocí</TableHead>
      <TableHead className="w-24 text-center">Prihlásenie</TableHead>
      <TableHead className="w-24 text-center">Počet klientov</TableHead>
      <TableHead className="w-10"></TableHead>
    </TableRow>
  </TableHeader>
);

function GroupRowCells({
  group,
  permGroupsData,
  onEdit,
  onDelete,
}: {
  group: ClientGroupWithCount;
  permGroupsData: PermissionGroup[] | undefined;
  onEdit: (g: ClientGroupWithCount) => void;
  onDelete: (g: ClientGroupWithCount) => void;
}) {
  return (
    <>
      <TableCell className="font-medium cursor-pointer hover-elevate" onClick={() => onEdit(group)}>
        <span className="inline-flex items-center gap-1.5">
          {group.isPartnerGroup
            ? <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />
            : group.isHoldingGroup
              ? <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              : group.isSystem
                ? <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                : null}
          {group.name}
          {group.isHoldingGroup && <Badge variant="outline" className="text-[9px] h-4 border-blue-500/50 text-blue-500">Holding</Badge>}
          {group.isSystem && !group.isHoldingGroup && <Badge variant="outline" className="text-[9px] h-4 border-amber-500/50 text-amber-500">Systémová</Badge>}
        </span>
      </TableCell>
      <TableCell className="w-36 text-center">
        <Badge variant="outline" data-testid={`badge-level-${group.id}`}>
          {group.permissionGroupId
            ? (permGroupsData || []).find(pg => pg.id === group.permissionGroupId)?.name || "—"
            : "—"}
        </Badge>
      </TableCell>
      <TableCell className="w-24 text-center">
        {group.allowLogin
          ? <Check className="w-4 h-4 text-emerald-500 mx-auto" data-testid={`icon-login-${group.id}`} />
          : <X className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-login-${group.id}`} />}
      </TableCell>
      <TableCell className="w-24 text-center">
        <Badge variant="secondary" data-testid={`badge-count-${group.id}`}>{group.memberCount}</Badge>
      </TableCell>
      <TableCell className="w-10">
        {!group.isHoldingGroup && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-actions-group-${group.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!group.isPartnerGroup && (
                <DropdownMenuItem onClick={() => onEdit(group)} data-testid={`menu-edit-group-${group.id}`}>
                  <Pencil className="w-4 h-4 mr-2" />Upraviť
                </DropdownMenuItem>
              )}
              {!group.isSystem && !group.isPartnerGroup && (
                <DropdownMenuItem
                  onClick={() => onDelete(group)}
                  disabled={group.memberCount > 0}
                  className="text-destructive focus:text-destructive"
                  data-testid={`menu-delete-group-${group.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />Vymazať
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </>
  );
}

type SectionKey = "holdingove" | "systemove" | "volitelne" | "ina_spolocnost" | "globalne" | "vsetky_subjekty";

export default function ClientGroups() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ClientGroupWithCount | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<ClientGroupWithCount | null>(null);
  const [partnerGroupOpen, setPartnerGroupOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionKey>>(
    new Set<SectionKey>(["globalne", "holdingove", "systemove", "volitelne", "ina_spolocnost", "vsetky_subjekty"])
  );

  const { data: appUser } = useAppUser();
  const { data: allCompanies } = useMyCompanies();
  const [, navigate] = useLocation();

  const activeDivisionId = (appUser as any)?.activeDivisionId as number | null | undefined;
  const activeStateId = appUser?.activeStateId;

  const stateCompanies = (allCompanies || []).filter(
    (c: MyCompany) => !c.deletedAt && (activeStateId ? c.stateId === activeStateId : true)
  );

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const isCollapsed = (key: SectionKey) => collapsedSections.has(key);

  const activeCompanyName = appUser?.activeCompanyId
    ? (allCompanies || []).find((c: MyCompany) => c.id === appUser.activeCompanyId)?.name
    : undefined;

  const { data: groupsRaw, isLoading } = useQuery<ClientGroupWithCount[]>({
    queryKey: ["/api/client-groups", "includeHolding"],
    queryFn: () => fetch("/api/client-groups?includeHolding=true", { credentials: "include" }).then(r => r.json()),
  });

  const { data: partnerCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/partners/active-count", activeDivisionId],
    queryFn: async () => {
      const url = activeDivisionId
        ? `/api/partners/active-count?divisionId=${activeDivisionId}`
        : "/api/partners/active-count";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const { data: otherCompanyCount } = useQuery<{ count: number }>({
    queryKey: ["/api/subjects/count-other-company"],
    queryFn: () => fetch("/api/subjects/count-other-company", { credentials: "include" }).then(r => r.json()),
  });

  const isAdminUser = ["admin", "superadmin", "prezident", "architekt"].includes(appUser?.role || "");

  type StateOverviewSubject = {
    id: number; uid: string | null;
    titleBefore: string | null; firstName: string | null; lastName: string | null;
    titleAfter: string | null; companyName: string | null; type: string;
    myCompanyId: number | null; groups: string[];
  };
  const { data: stateOverview, isLoading: stateOverviewLoading } = useQuery<StateOverviewSubject[]>({
    queryKey: ["/api/subjects/state-overview"],
    queryFn: () => fetch("/api/subjects/state-overview", { credentials: "include" }).then(r => r.json()),
    enabled: isAdminUser,
  });

  const { data: permGroupsData } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/client-groups/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", "includeHolding"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups", "includeHolding"] });
      toast({ title: "Uspech", description: "Skupina vymazana" });
      setDeletingGroup(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat skupinu", variant: "destructive" }),
  });

  const holdingGroups = (groupsRaw || []).filter(g => g.isHoldingGroup);
  const systemGroups = (groupsRaw || []).filter(g => getGroupMainCategory(g) === "systemove");
  const volitelneGroups = (groupsRaw || []).filter(g => getGroupMainCategory(g) === "volitelne");
  const globalneGroups = (groupsRaw || []).filter(g => getGroupMainCategory(g) === "globalne");

  const openEdit = (g: ClientGroupWithCount) => { setEditingGroup(g); setDialogOpen(true); };
  const openDelete = (g: ClientGroupWithCount) => setDeletingGroup(g);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap w-full">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Skupiny klientov</h1>
        {activeCompanyName && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border border-border" data-testid="header-active-company">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Firma:</span>
            <span className="text-xs font-medium" data-testid="text-active-company-name">{activeCompanyName}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <div className="space-y-3">

          {/* ── 1. HOLDINGOVÉ SKUPINY (spoločnosti štátu + čierny zoznam) ── */}
          <SectionCard
            title="Holdingové skupiny"
            accentClass="border-l-red-600"
            badgeClass="border-red-600/50 text-red-400"
            badgeText="Holding"
            count={1 + globalneGroups.length}
            testId="section-globalne"
            isCollapsed={isCollapsed("globalne")}
            onToggle={() => toggleSection("globalne")}
            tooltip="Holdingové skupiny združujú spoločnosti celého štátu a globálne záznamy platné naprieč všetkými firmami. Patrí sem zoznam spoločností štátu a čierny zoznam podvodníkov, ktorý je zdieľaný pre všetkých."
          >
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead className="w-36 text-center">Kód / Skupina právomocí</TableHead>
                  <TableHead className="w-24 text-center">Prihlásenie</TableHead>
                  <TableHead className="w-24 text-center">Počet klientov</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Syntetický riadok — Skupiny spoločností štátu */}
                <TableRow
                  data-testid="row-spolocnosti-synthetic"
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate("/my-companies")}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      Skupiny spoločností
                      <Badge variant="outline" className="text-[9px] h-4 border-violet-500/50 text-violet-400">Spoločnosť</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="w-36 text-center"></TableCell>
                  <TableCell className="w-24 text-center"></TableCell>
                  <TableCell className="w-24 text-center">
                    <span className="font-semibold text-violet-400" data-testid="count-spolocnosti">
                      {stateCompanies.length}
                    </span>
                  </TableCell>
                  <TableCell className="w-10">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
                {/* Čierny zoznam a iné globálne skupiny */}
                {globalneGroups.map(g => (
                  <TableRow key={g.id} data-testid={`row-group-${g.id}`} className="cursor-pointer" onClick={() => openEdit(g)}>
                    <GroupRowCells group={g} permGroupsData={permGroupsData} onEdit={openEdit} onDelete={openDelete} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          {/* ── 2. FIREMNÉ SKUPINY ── */}
          <SectionCard
            title="Firemné skupiny"
            accentClass="border-l-blue-500"
            badgeClass="border-blue-500/50 text-blue-400"
            badgeText="Firemná"
            count={holdingGroups.length + 1}
            testId="section-holdingove"
            isCollapsed={isCollapsed("holdingove")}
            onToggle={() => toggleSection("holdingove")}
            tooltip="Firemné skupiny sú skupiny klientov a partnerov naviazané priamo na konkrétnu spoločnosť alebo partnera v systéme. Tieto skupiny sú väčšinou uzamknuté a ich členstvo sa riadi automaticky podľa firemných vzťahov."
          >
            <Table className="w-full">
              {TABLE_HEADER}
              <TableBody>
                {holdingGroups.map(g => (
                  <TableRow key={g.id} data-testid={`row-group-${g.id}`} className="cursor-pointer" onClick={() => openEdit(g)}>
                    <GroupRowCells group={g} permGroupsData={permGroupsData} onEdit={openEdit} onDelete={openDelete} />
                  </TableRow>
                ))}
                <TableRow
                  data-testid="row-partneri-synthetic"
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setPartnerGroupOpen(true)}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      PARTNERI — Zoznam partnerov
                      <Badge variant="outline" className="text-[9px] h-4 border-red-500/50 text-red-500">Partner</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="w-36 text-center"></TableCell>
                  <TableCell className="w-24 text-center"></TableCell>
                  <TableCell className="w-24 text-center">
                    <span className="font-semibold text-red-500" data-testid="count-partneri">
                      {partnerCountData?.count ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="w-10">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>

          {/* ── 2. HLAVNÉ SYSTÉMOVÉ SKUPINY ── */}
          <SectionCard
            title="Systémové skupiny"
            accentClass="border-l-amber-500"
            badgeClass="border-amber-500/50 text-amber-400"
            badgeText="Systémová"
            count={systemGroups.length}
            testId="section-systemove"
            isCollapsed={isCollapsed("systemove")}
            onToggle={() => toggleSection("systemove")}
            tooltip="Systémové skupiny sú prednastavené skupiny vytvorené samotným systémom. Nedajú sa vymazať ani premenovať. Definujú základné kategórie klientov ako Klienti, Registrovaní klienti či Červený zoznam, ktoré sú kľúčové pre fungovanie celého CRM."
          >
            <Table className="w-full">
              {TABLE_HEADER}
              <TableBody>
                {systemGroups.map(g => (
                  <TableRow key={g.id} data-testid={`row-group-${g.id}`} className="cursor-pointer" onClick={() => openEdit(g)}>
                    <GroupRowCells group={g} permGroupsData={permGroupsData} onEdit={openEdit} onDelete={openDelete} />
                  </TableRow>
                ))}
                {systemGroups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={SECTION_COLS} className="text-center text-muted-foreground py-6 text-sm">Žiadne systémové skupiny</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SectionCard>

          {/* ── 3. VOLITEĽNÉ SKUPINY ── */}
          <SectionCard
            title="Voliteľné skupiny"
            accentClass="border-l-border"
            badgeClass="border-border text-muted-foreground"
            badgeText="Vlastná"
            count={volitelneGroups.length}
            cta={
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingGroup(null); setDialogOpen(true); }}
                data-testid="button-add-group"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Pridať skupinu
              </Button>
            }
            testId="section-volitelne"
            isCollapsed={isCollapsed("volitelne")}
            onToggle={() => toggleSection("volitelne")}
            tooltip="Voliteľné skupiny sú vlastné skupiny, ktoré si správca systému môže vytvoriť a prispôsobiť podľa potrieb firmy. Môžu mať vlastné pravidlá prístupu, oprávnenia a polia. Ich poradie je možné meniť presúvaním."
          >
            <SortableContext_Wrapper
              items={volitelneGroups}
              onReorder={(items) => reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })))}
            >
              <Table className="w-full">
                {TABLE_HEADER}
                <TableBody>
                  {volitelneGroups.map(g => (
                    <SortableTableRow key={g.id} id={g.id} data-testid={`row-group-${g.id}`} onRowClick={() => openEdit(g)}>
                      <GroupRowCells group={g} permGroupsData={permGroupsData} onEdit={openEdit} onDelete={openDelete} />
                    </SortableTableRow>
                  ))}
                  {volitelneGroups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={SECTION_COLS} className="text-center text-muted-foreground py-8 text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <span>Žiadne voliteľné skupiny</span>
                          <Button size="sm" variant="outline" onClick={() => { setEditingGroup(null); setDialogOpen(true); }} data-testid="button-add-group-empty">
                            <Plus className="w-3.5 h-3.5 mr-1" />Vytvoriť prvú skupinu
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </SortableContext_Wrapper>
          </SectionCard>

          {/* ── 4. SKUPINA SUBJEKTOV MIMO AKTÍVNEJ SPOLOČNOSTI ── */}
          <SectionCard
            title="Skupina subjektov iných spoločností"
            accentClass="border-l-slate-500"
            badgeClass="border-slate-500/40 text-slate-400"
            badgeText="Externá"
            count={3}
            testId="section-ina-spolocnost"
            isCollapsed={isCollapsed("ina_spolocnost")}
            onToggle={() => toggleSection("ina_spolocnost")}
            tooltip="Táto skupina zobrazuje subjekty, spoločnosti a partnerov, ktorí nepatria do aktuálne aktívnej spoločnosti zobrazenej v hornej lište. Slúži na prehľad entít z iných firiem v rámci toho istého štátu alebo systému."
          >
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead className="w-36 text-center">Kód / Skupina právomocí</TableHead>
                  <TableHead className="w-24 text-center">Prihlásenie</TableHead>
                  <TableHead className="w-24 text-center">Počet</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Spoločnosti mimo aktívnej spoločnosti */}
                <TableRow
                  data-testid="row-ext-spolocnosti"
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate("/my-companies")}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Spoločnosti mimo aktívnej spoločnosti
                      <Badge variant="outline" className="text-[9px] h-4 border-slate-500/40 text-slate-400">Spoločnosť</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="w-36 text-center"></TableCell>
                  <TableCell className="w-24 text-center"></TableCell>
                  <TableCell className="w-24 text-center">
                    <span className="font-semibold text-slate-400" data-testid="count-ext-spolocnosti">
                      {(allCompanies || []).filter((c: MyCompany) => !c.deletedAt && c.id !== appUser?.activeCompanyId).length || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="w-10"><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
                {/* Partneri mimo aktívnej spoločnosti */}
                <TableRow
                  data-testid="row-ext-partneri"
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate("/partners")}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Partneri mimo aktívnej spoločnosti
                      <Badge variant="outline" className="text-[9px] h-4 border-slate-500/40 text-slate-400">Partner</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="w-36 text-center"></TableCell>
                  <TableCell className="w-24 text-center"></TableCell>
                  <TableCell className="w-24 text-center">
                    <span className="font-semibold text-slate-400" data-testid="count-ext-partneri">—</span>
                  </TableCell>
                  <TableCell className="w-10"><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
                {/* Subjekty mimo aktívnej spoločnosti */}
                <TableRow
                  data-testid="row-ina-spolocnost-synthetic"
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate("/subjects?statusFilter=other_company")}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Subjekty mimo aktívnej spoločnosti
                      <Badge variant="outline" className="text-[9px] h-4 border-slate-500/40 text-slate-400">Subjekt</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="w-36 text-center"></TableCell>
                  <TableCell className="w-24 text-center"></TableCell>
                  <TableCell className="w-24 text-center">
                    <span className="font-semibold text-slate-400" data-testid="count-ina-spolocnost">
                      {otherCompanyCount?.count ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="w-10"><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>

          {/* ── 6. VŠETKY SUBJEKTY V ŠTÁTE (len admin) ── */}
          {isAdminUser && (
            <SectionCard
              title="Všetky subjekty v štáte"
              accentClass="border-l-green-600"
              badgeClass="border-green-600/50 text-green-400"
              badgeText="Admin"
              count={stateOverview?.length}
              testId="section-vsetky-subjekty"
              isCollapsed={isCollapsed("vsetky_subjekty")}
              onToggle={() => toggleSection("vsetky_subjekty")}
              tooltip="Táto sekcia je prístupná iba pre administrátorov. Zobrazuje VŠETKY subjekty v aktuálnom štáte naprieč všetkými spoločnosťami — bez ohľadu na aktívnu spoločnosť. Slúži na globálny prehľad a audit."
            >
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36 font-mono">UID</TableHead>
                    <TableHead>Meno / Názov</TableHead>
                    <TableHead>Skupiny</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateOverviewLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!stateOverviewLoading && (stateOverview || []).map(s => {
                    const fullName = s.type === "company"
                      ? (s.companyName || "—")
                      : [s.titleBefore, s.firstName, s.lastName, s.titleAfter].filter(Boolean).join(" ") || "—";
                    return (
                      <TableRow
                        key={s.id}
                        data-testid={`row-state-subject-${s.id}`}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => navigate(`/subjects/${s.id}`)}
                      >
                        <TableCell className="w-36 font-mono text-[11px] text-muted-foreground">
                          {s.uid ? formatUid(s.uid) : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{fullName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.groups.length === 0
                              ? <span className="text-muted-foreground text-xs">—</span>
                              : s.groups.map((g, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] h-4 border-green-600/40 text-green-400">{g}</Badge>
                              ))
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!stateOverviewLoading && (stateOverview || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Žiadne subjekty v tomto štáte</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </SectionCard>
          )}

        </div>
      )}

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

      <PartnerGroupDialog open={partnerGroupOpen} onOpenChange={setPartnerGroupOpen} activeDivisionId={activeDivisionId} />
    </div>
  );
}
