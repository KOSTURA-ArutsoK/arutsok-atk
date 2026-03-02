import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link2, Plus, Trash2, Pencil, Loader2, ExternalLink, ChevronDown, ChevronRight, FolderOpen, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SidebarLinkSection, SidebarLink } from "@shared/schema";

export default function NastavenieOdkazov() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sections, isLoading: sectionsLoading } = useQuery<SidebarLinkSection[]>({
    queryKey: ["/api/sidebar-link-sections"],
  });
  const { data: links, isLoading: linksLoading } = useQuery<SidebarLink[]>({
    queryKey: ["/api/sidebar-links"],
  });

  const [newSectionName, setNewSectionName] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  const [addingLinkToSection, setAddingLinkToSection] = useState<number | null>(null);
  const [newLinkGroup, setNewLinkGroup] = useState("");
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editLinkGroup, setEditLinkGroup] = useState("");
  const [editLinkName, setEditLinkName] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sidebar-link-sections"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sidebar-links"] });
  };

  const createSectionMut = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/sidebar-link-sections", { name, sortOrder: (sections?.length || 0) });
    },
    onSuccess: () => {
      toast({ title: "Sekcia vytvorená" });
      setNewSectionName("");
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const updateSectionMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/sidebar-link-sections/${id}`, { name });
    },
    onSuccess: () => {
      toast({ title: "Sekcia aktualizovaná" });
      setEditingSectionId(null);
      invalidateAll();
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const deleteSectionMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sidebar-link-sections/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Sekcia zmazaná" });
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
      setAddingLinkToSection(null);
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

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSectionLinks = (sectionId: number) => links?.filter(l => l.sectionId === sectionId) || [];

  const getGroupedLinks = (sectionId: number) => {
    const sLinks = getSectionLinks(sectionId);
    const groups: Record<string, SidebarLink[]> = {};
    for (const l of sLinks) {
      if (!groups[l.groupName]) groups[l.groupName] = [];
      groups[l.groupName].push(l);
    }
    return groups;
  };

  const isLoading = sectionsLoading || linksLoading;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenie odkazov</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pridať novú sekciu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  placeholder="Názov sekcie (napr. Odkazy - linky)"
                  className="flex-1"
                  data-testid="input-new-section-name"
                />
                <Button
                  onClick={() => newSectionName.trim() && createSectionMut.mutate(newSectionName.trim())}
                  disabled={!newSectionName.trim() || createSectionMut.isPending}
                  data-testid="btn-create-section"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Pridať
                </Button>
              </div>
            </CardContent>
          </Card>

          {sections && sections.length > 0 ? (
            sections.map(section => (
              <Card key={section.id} data-testid={`section-card-${section.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="p-1 hover:bg-muted rounded"
                      data-testid={`btn-toggle-section-${section.id}`}
                    >
                      {expandedSections.has(section.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {editingSectionId === section.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingSectionName}
                          onChange={e => setEditingSectionName(e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-edit-section-${section.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => updateSectionMut.mutate({ id: section.id, name: editingSectionName.trim() })}
                          disabled={!editingSectionName.trim()}
                          data-testid={`btn-save-section-${section.id}`}
                        >
                          Uložiť
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingSectionId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base flex-1">{section.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">{getSectionLinks(section.id).length} odkazov</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }}
                          data-testid={`btn-edit-section-${section.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteSectionMut.mutate(section.id)}
                          data-testid={`btn-delete-section-${section.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>

                {expandedSections.has(section.id) && (
                  <CardContent className="space-y-4">
                    {Object.entries(getGroupedLinks(section.id)).map(([groupName, groupLinks]) => (
                      <div key={groupName} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1">
                          {groupName}
                        </p>
                        {groupLinks.map(link => (
                          <div key={link.id} className="flex items-center gap-2 pl-3" data-testid={`link-item-${link.id}`}>
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
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingLinkId(null)}>
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
                      </div>
                    ))}

                    {addingLinkToSection === section.id ? (
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
                            onClick={() => { setAddingLinkToSection(null); setNewLinkGroup(""); setNewLinkName(""); setNewLinkUrl(""); }}
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
                        onClick={() => { setAddingLinkToSection(section.id); setExpandedSections(prev => new Set(prev).add(section.id)); }}
                        data-testid={`btn-add-link-${section.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Pridať odkaz do sekcie
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="text-no-sections">
                Zatiaľ nemáte žiadne sekcie odkazov. Vytvorte prvú sekciu vyššie.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
