import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { Link2, Plus, Trash2, Pencil, Loader2, ExternalLink, ChevronDown, ChevronRight, X, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SidebarLinkSection, SidebarLink } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableGroupItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded" data-testid={`sortable-group-${id}`}>
      <div className="flex items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab px-2 py-2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={`Presunúť skupinu ${id}`}
          aria-roledescription="sortable"
          data-testid={`grip-group-${id}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function NastavenieOdkazov() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: appUser } = useAppUser();
  const divisionId = appUser?.activeDivisionId;

  const { data: sections, isLoading: sectionsLoading } = useQuery<SidebarLinkSection[]>({
    queryKey: ["/api/sidebar-link-sections", divisionId],
    queryFn: async () => {
      const res = await fetch(`/api/sidebar-link-sections${divisionId ? `?divisionId=${divisionId}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!divisionId,
  });
  const { data: links, isLoading: linksLoading } = useQuery<SidebarLink[]>({
    queryKey: ["/api/sidebar-links", divisionId],
    queryFn: async () => {
      const res = await fetch(`/api/sidebar-links${divisionId ? `?divisionId=${divisionId}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!divisionId,
  });

  const section = sections?.[0];

  const [editingSectionName, setEditingSectionName] = useState(false);
  const [sectionNameValue, setSectionNameValue] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addingLink, setAddingLink] = useState(false);
  const [newLinkGroup, setNewLinkGroup] = useState("");
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editLinkGroup, setEditLinkGroup] = useState("");
  const [editLinkName, setEditLinkName] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sidebar-link-sections", divisionId] });
    queryClient.invalidateQueries({ queryKey: ["/api/sidebar-links", divisionId] });
  };

  const updateSectionMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/sidebar-link-sections/${id}`, { name });
    },
    onSuccess: () => {
      toast({ title: "Názov sekcie aktualizovaný" });
      setEditingSectionName(false);
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const createLinkMut = useMutation({
    mutationFn: async (data: { sectionId: number; groupName: string; name: string; url: string }) => {
      const sectionLinks = links?.filter(l => l.sectionId === data.sectionId) || [];
      await apiRequest("POST", "/api/sidebar-links", { ...data, sortOrder: sectionLinks.length });
    },
    onSuccess: () => {
      toast({ title: "Odkaz pridaný" });
      setAddingLink(false);
      setNewLinkGroup("");
      setNewLinkName("");
      setNewLinkUrl("");
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const updateLinkMut = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; groupName: string; name: string; url: string }) => {
      await apiRequest("PATCH", `/api/sidebar-links/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Odkaz aktualizovaný" });
      setEditingLinkId(null);
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const deleteLinkMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sidebar-links/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Odkaz zmazaný" });
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const deleteGroupMut = useMutation({
    mutationFn: async (groupName: string) => {
      const groupLinks = links?.filter(l => l.groupName === groupName && l.sectionId === section?.id) || [];
      for (const link of groupLinks) {
        await apiRequest("DELETE", `/api/sidebar-links/${link.id}`);
      }
    },
    onSuccess: () => {
      toast({ title: "Skupina zmazaná" });
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const getGroupedLinks = (): [string, SidebarLink[]][] => {
    if (!links || !section) return [];
    const sectionLinks = links.filter(l => l.sectionId === section.id);
    const groups: Record<string, SidebarLink[]> = {};
    for (const l of sectionLinks) {
      if (!groups[l.groupName]) groups[l.groupName] = [];
      groups[l.groupName].push(l);
    }
    const entries = Object.entries(groups);
    entries.sort((a, b) => {
      const minA = Math.min(...a[1].map(l => l.sortOrder ?? 0));
      const minB = Math.min(...b[1].map(l => l.sortOrder ?? 0));
      return minA - minB;
    });
    return entries;
  };

  const serverGrouped = getGroupedLinks();
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);
  const reorderSeqRef = useRef(0);

  const grouped = optimisticOrder
    ? optimisticOrder
        .map(name => serverGrouped.find(([g]) => g === name))
        .filter((e): e is [string, SidebarLink[]] => !!e)
    : serverGrouped;
  const groupNames = grouped.map(([name]) => name);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorderGroupsMut = useMutation({
    mutationFn: async ({ newOrder, seq }: { newOrder: string[]; seq: number }) => {
      const allSectionLinks = links?.filter(l => l.sectionId === section?.id) || [];
      let sortCounter = 0;
      for (const gName of newOrder) {
        const gLinks = allSectionLinks.filter(l => l.groupName === gName);
        for (const link of gLinks) {
          if (reorderSeqRef.current !== seq) return;
          await apiRequest("PATCH", `/api/sidebar-links/${link.id}`, { sortOrder: sortCounter });
          sortCounter++;
        }
      }
    },
    onSuccess: () => {
      setOptimisticOrder(null);
      invalidateAll();
    },
    onError: () => {
      setOptimisticOrder(null);
      invalidateAll();
      toast({ title: "Chyba pri zmene poradia", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupNames.indexOf(active.id as string);
    const newIndex = groupNames.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(groupNames, oldIndex, newIndex);
    setOptimisticOrder(reordered);
    const seq = ++reorderSeqRef.current;
    reorderGroupsMut.mutate({ newOrder: reordered, seq });
  };
  const isLoading = sectionsLoading || linksLoading;
  const totalLinks = links?.filter(l => l.sectionId === section?.id).length || 0;

  const { data: divisionsData } = useQuery<any[]>({
    queryKey: ["/api/companies", appUser?.activeCompanyId, "divisions"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${appUser?.activeCompanyId}/divisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!appUser?.activeCompanyId,
  });

  const activeDivision = divisionsData?.find((d: any) => d.divisionId === divisionId || d.division?.id === divisionId);
  const divisionName = activeDivision?.division?.name || "";
  const divisionEmoji = activeDivision?.division?.emoji || "";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenie odkazov</h1>
        {divisionEmoji && divisionName && (
          <span className="text-sm text-muted-foreground ml-2">
            {divisionEmoji} {divisionName}
          </span>
        )}
      </div>

      {!divisionId ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Vyberte divíziu pre nastavenie odkazov.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : section ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                {editingSectionName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={sectionNameValue}
                      onChange={e => setSectionNameValue(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-edit-section-name"
                    />
                    <Button
                      size="sm"
                      onClick={() => sectionNameValue.trim() && updateSectionMut.mutate({ id: section.id, name: sectionNameValue.trim() })}
                      disabled={!sectionNameValue.trim() || updateSectionMut.isPending}
                      data-testid="btn-save-section-name"
                    >
                      Uložiť
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSectionName(false)} data-testid="btn-cancel-section-name">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-base flex-1">{section.name}</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => { setEditingSectionName(true); setSectionNameValue(section.name); }}
                      data-testid="btn-edit-section-name"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground">{totalLinks} odkazov</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={groupNames} strategy={verticalListSortingStrategy}>
              {grouped.map(([groupName, groupLinks]) => {
                const isExpanded = expandedGroups.has(groupName);
                const hasLinks = groupLinks.length > 0;
                return (
                  <SortableGroupItem key={groupName} id={groupName}>
                    <div
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleGroup(groupName)}
                      data-testid={`group-toggle-${groupName}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium flex-1">{groupName}</span>
                      <span className="text-xs text-muted-foreground">{groupLinks.length}</span>
                      {!hasLinks && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteGroupMut.mutate(groupName); }}
                          data-testid={`btn-delete-group-${groupName}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border px-3 py-2 space-y-1">
                        {groupLinks.map(link => (
                          <div key={link.id} className="flex items-center gap-2 pl-2" data-testid={`link-item-${link.id}`}>
                            {editingLinkId === link.id ? (
                              <div className="flex flex-wrap items-center gap-2 flex-1">
                                <Input
                                  value={editLinkGroup}
                                  onChange={e => setEditLinkGroup(e.target.value)}
                                  placeholder="Skupina"
                                  className="h-7 text-xs w-32"
                                  data-testid={`input-edit-link-group-${link.id}`}
                                />
                                <Input
                                  value={editLinkName}
                                  onChange={e => setEditLinkName(e.target.value)}
                                  placeholder="Názov"
                                  className="h-7 text-xs w-32"
                                  data-testid={`input-edit-link-name-${link.id}`}
                                />
                                <Input
                                  value={editLinkUrl}
                                  onChange={e => setEditLinkUrl(e.target.value)}
                                  placeholder="URL"
                                  className="h-7 text-xs flex-1"
                                  data-testid={`input-edit-link-url-${link.id}`}
                                />
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => updateLinkMut.mutate({ id: link.id, groupName: editLinkGroup.trim(), name: editLinkName.trim(), url: editLinkUrl.trim() })}
                                  disabled={!editLinkGroup.trim() || !editLinkName.trim() || !editLinkUrl.trim()}
                                  data-testid={`btn-save-link-${link.id}`}
                                >
                                  Uložiť
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingLinkId(null)} data-testid="btn-cancel-edit-link">
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-sm flex-1 truncate">{link.name}</span>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-48">
                                  {link.url}
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => { setEditingLinkId(link.id); setEditLinkGroup(link.groupName); setEditLinkName(link.name); setEditLinkUrl(link.url); }}
                                  data-testid={`btn-edit-link-${link.id}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive"
                                  onClick={() => deleteLinkMut.mutate(link.id)}
                                  data-testid={`btn-delete-link-${link.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                        {groupLinks.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">Žiadne odkazy v tejto skupine</p>
                        )}
                      </div>
                    )}
                  </SortableGroupItem>
                );
              })}
                </SortableContext>
              </DndContext>

              {addingLink ? (
                <div className="border border-dashed border-border rounded p-3 space-y-2">
                  <p className="text-xs font-medium">Nový odkaz</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Skupina</Label>
                      <Input
                        value={newLinkGroup}
                        onChange={e => setNewLinkGroup(e.target.value)}
                        placeholder="napr. Poistenie auta"
                        className="h-8 text-sm"
                        data-testid="input-new-link-group"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Názov odkazu</Label>
                      <Input
                        value={newLinkName}
                        onChange={e => setNewLinkName(e.target.value)}
                        placeholder="napr. PZP"
                        className="h-8 text-sm"
                        data-testid="input-new-link-name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">URL adresa</Label>
                      <Input
                        value={newLinkUrl}
                        onChange={e => setNewLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                        data-testid="input-new-link-url"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setAddingLink(false); setNewLinkGroup(""); setNewLinkName(""); setNewLinkUrl(""); }}
                      data-testid="btn-cancel-new-link"
                    >
                      Zrušiť
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createLinkMut.mutate({ sectionId: section.id, groupName: newLinkGroup.trim(), name: newLinkName.trim(), url: newLinkUrl.trim() })}
                      disabled={!newLinkGroup.trim() || !newLinkName.trim() || !newLinkUrl.trim() || createLinkMut.isPending}
                      data-testid="btn-save-new-link"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Pridať odkaz
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingLink(true)}
                  data-testid="btn-add-link"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Pridať odkaz
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Načítavam sekciu odkazov...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
