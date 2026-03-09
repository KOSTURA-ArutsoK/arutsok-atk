import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useAppUser } from "@/hooks/use-app-user";

interface Division {
  id: number;
  companyId: number;
  divisionId: number;
  division: {
    id: number;
    name: string;
    emoji: string;
    isActive: boolean;
  };
}

interface BusinessOpportunity {
  id: number;
  title: string;
  content: string;
  divisionIds: number[];
  companyId: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function DivisionCheckboxes({
  companyDivisions,
  selectedIds,
  onChange,
  testIdPrefix,
}: {
  companyDivisions: Division[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  testIdPrefix: string;
}) {
  const isAll = selectedIds.length === 0;

  const handleAllToggle = (checked: boolean) => {
    if (checked) {
      onChange([]);
    }
  };

  const handleDivisionToggle = (divId: number, checked: boolean) => {
    if (checked) {
      const next = [...selectedIds, divId];
      onChange(next);
    } else {
      const next = selectedIds.filter(id => id !== divId);
      onChange(next);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Platnost pre divizie</label>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm" data-testid={`${testIdPrefix}-all`}>
          <Checkbox checked={isAll} onCheckedChange={handleAllToggle} />
          <span>Vsetky divizie</span>
        </label>
        {companyDivisions.map((cd) => (
          <label key={cd.divisionId} className="flex items-center gap-2 cursor-pointer text-sm" data-testid={`${testIdPrefix}-${cd.divisionId}`}>
            <Checkbox
              checked={selectedIds.includes(cd.divisionId)}
              onCheckedChange={(checked) => handleDivisionToggle(cd.divisionId, !!checked)}
            />
            <span>{cd.division.emoji} {cd.division.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function NastavenieObchodnychPrilezitosti() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [filterScope, setFilterScope] = useState<string>("all_divisions");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editDivisionIds, setEditDivisionIds] = useState<number[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDivisionIds, setNewDivisionIds] = useState<number[]>([]);
  const lastCompanyIdRef = useRef<number | null>(null);

  const activeCompanyId = appUser?.activeCompanyId;

  const { data: companyDivisions } = useQuery<Division[]>({
    queryKey: ["/api/companies", activeCompanyId, "divisions"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${activeCompanyId}/divisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeCompanyId,
  });

  const { data: allOpportunities, isLoading } = useQuery<BusinessOpportunity[]>({
    queryKey: ["/api/business-opportunities/all"],
    enabled: !!activeCompanyId,
  });

  useEffect(() => {
    if (activeCompanyId && lastCompanyIdRef.current !== activeCompanyId) {
      lastCompanyIdRef.current = activeCompanyId;
      setFilterScope("all_divisions");
    }
  }, [activeCompanyId]);

  const filteredOpportunities = (allOpportunities || []).filter((op) => {
    if (filterScope === "all_divisions") return true;
    if (filterScope === "global") return !op.divisionIds || op.divisionIds.length === 0;
    const fId = parseInt(filterScope);
    return op.divisionIds?.includes(fId) || (!op.divisionIds || op.divisionIds.length === 0);
  });

  const getDivisionLabels = (divisionIds: number[] | null) => {
    if (!divisionIds || divisionIds.length === 0) return "Vsetky divizie";
    return divisionIds.map(id => {
      const cd = companyDivisions?.find(d => d.divisionId === id);
      return cd ? `${cd.division.emoji || ""} ${cd.division.name}`.trim() : `Div. ${id}`;
    }).join(", ");
  };

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; divisionIds: number[] }) => {
      return await apiRequest("POST", "/api/business-opportunities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-opportunities"] });
      toast({ title: "Vytvorene", description: "Obchodna prilezitost bola vytvorena." });
      setIsAdding(false);
      setNewTitle("");
      setNewContent("");
      setNewDivisionIds([]);
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvorit", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title: string; content: string; divisionIds: number[] } }) => {
      return await apiRequest("PUT", `/api/business-opportunities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-opportunities"] });
      toast({ title: "Ulozene", description: "Obchodna prilezitost bola aktualizovana." });
      setEditingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa ulozit", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/business-opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-opportunities"] });
      toast({ title: "Vymazane", description: "Obchodna prilezitost bola vymazana." });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vymazat", variant: "destructive" });
    },
  });

  const startEdit = (op: BusinessOpportunity) => {
    setEditingId(op.id);
    setEditTitle(op.title);
    setEditContent(op.content);
    setEditDivisionIds(op.divisionIds || []);
  };

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({ title: "Chyba", description: "Nazov aj text su povinne", variant: "destructive" });
      return;
    }
    createMutation.mutate({ title: newTitle.trim(), content: newContent.trim(), divisionIds: newDivisionIds });
  };

  const handleUpdate = () => {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    updateMutation.mutate({ id: editingId, data: { title: editTitle.trim(), content: editContent.trim(), divisionIds: editDivisionIds } });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenie obchodnych prilezitosti</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg" data-testid="text-card-title">Obchodne prilezitosti</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={filterScope} onValueChange={setFilterScope}>
              <SelectTrigger className="w-[220px]" data-testid="select-filter-scope">
                <SelectValue placeholder="Filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_divisions">Vsetky zaznamy</SelectItem>
                <SelectItem value="global">Platne pre vsetky divizie</SelectItem>
                {companyDivisions?.map((cd) => (
                  <SelectItem key={cd.divisionId} value={String(cd.divisionId)}>
                    {cd.division.emoji} {cd.division.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} size="sm" data-testid="button-add-opportunity">
                <Plus className="w-4 h-4 mr-1" />
                Pridat
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdding && (
            <Card className="border-primary/50">
              <CardContent className="pt-4 space-y-3">
                <DivisionCheckboxes
                  companyDivisions={companyDivisions || []}
                  selectedIds={newDivisionIds}
                  onChange={setNewDivisionIds}
                  testIdPrefix="chk-new-div"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kratky nazov (zobrazuje sa v menu)</label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Napr. Ponuka životného poistenia Q1..."
                    data-testid="input-new-title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Text prilezitosti</label>
                  <Textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Podrobny popis obchodnej prilezitosti..."
                    className="min-h-[150px] font-mono text-sm"
                    data-testid="textarea-new-content"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setIsAdding(false); setNewTitle(""); setNewContent(""); setNewDivisionIds([]); }} data-testid="button-cancel-add">
                    <X className="w-4 h-4 mr-1" />
                    Zrusit
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-new">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                    Ulozit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6" data-testid="text-no-records">
              Ziadne obchodne prilezitosti. Kliknite na "Pridat" pre vytvorenie novej.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredOpportunities.map((op) => (
                <Card key={op.id} className="border-border/50" data-testid={`card-opportunity-${op.id}`}>
                  <CardContent className="pt-4 space-y-2">
                    {editingId === op.id ? (
                      <>
                        <DivisionCheckboxes
                          companyDivisions={companyDivisions || []}
                          selectedIds={editDivisionIds}
                          onChange={setEditDivisionIds}
                          testIdPrefix={`chk-edit-div-${op.id}`}
                        />
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="font-medium"
                          data-testid={`input-edit-title-${op.id}`}
                        />
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[150px] font-mono text-sm"
                          data-testid={`textarea-edit-content-${op.id}`}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${op.id}`}>
                            <X className="w-4 h-4 mr-1" />
                            Zrusit
                          </Button>
                          <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending} data-testid={`button-save-edit-${op.id}`}>
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Ulozit
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-sm" data-testid={`text-title-${op.id}`}>{op.title}</h3>
                            <span className="text-xs text-muted-foreground" data-testid={`text-scope-${op.id}`}>
                              {getDivisionLabels(op.divisionIds)}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(op)} data-testid={`button-edit-${op.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(op.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${op.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3" data-testid={`text-content-preview-${op.id}`}>
                          {op.content}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
