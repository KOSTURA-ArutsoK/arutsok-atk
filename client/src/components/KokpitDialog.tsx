import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { StatusChangeModal } from "@/components/status-change-modal";
import { formatRemainingHHMM, isOverdue, isAdminAlert } from "@/lib/workingHours";
import type { KokpitItem, ContractStatus } from "@shared/schema";

type KokpitItemExt = KokpitItem & { contractUid?: string | null; statusName?: string | null };

function AgingBadge({ dayCreated }: { dayCreated: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.floor((new Date(today).getTime() - new Date(dayCreated).getTime()) / 86400000);
  if (diff <= 0) return null;
  return (
    <span
      data-testid="badge-aging"
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: diff >= 3 ? "#ea580c" : "#f59e0b",
        color: "white",
        borderRadius: 8,
        padding: "1px 6px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      +{diff}d
    </span>
  );
}

function SlaTimer({ createdAt, resolvedAt }: { createdAt: string; resolvedAt: string | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (resolvedAt) return;
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [resolvedAt]);

  if (resolvedAt) return <span style={{ color: "#059669", fontSize: 12 }}>Vybavené</span>;

  const created = new Date(createdAt);
  const label = formatRemainingHHMM(created, now);
  const overdue = isOverdue(created, now);
  return (
    <span
      data-testid="text-sla-timer"
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: overdue ? "#dc2626" : "#f59e0b",
        background: overdue ? "rgba(220,38,38,0.08)" : "transparent",
        borderRadius: 4,
        padding: overdue ? "1px 4px" : 0,
      }}
    >
      {label}
    </span>
  );
}

interface KokpitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialItemId?: number | null;
}

export function KokpitDialog({ open, onOpenChange, initialItemId }: KokpitDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("prichod");
  const [uidSearch, setUidSearch] = useState("");
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [selectedContractUid, setSelectedContractUid] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [workingItem, setWorkingItem] = useState<KokpitItemExt | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [resolveItem, setResolveItem] = useState<KokpitItemExt | null>(null);

  const { data: items = [], isLoading } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items"],
    enabled: open,
  });

  const { data: statuses = [] } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
    enabled: open,
  });

  useEffect(() => {
    if (initialItemId && items.length > 0) {
      const item = items.find(i => i.id === initialItemId);
      if (item) {
        setWorkingItem(item);
        if (item.phase === 1) setActiveTab("prichod");
        else if (item.phase === 2) setActiveTab("rozdelenie");
        else setActiveTab("riesenie");
      }
    }
  }, [initialItemId, items]);

  const phase1Items = items.filter(i => i.phase === 1);
  const phase2Items = items.filter(i => i.phase === 2);
  const phase3Items = items.filter(i => i.phase === 3);

  const moveMutation = useMutation({
    mutationFn: async ({ id, phase, contractId, statusId }: { id: number; phase: number; contractId?: number | null; statusId?: number | null }) =>
      (await apiRequest("PATCH", `/api/kokpit/items/${id}`, { phase, contractId, statusId })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kokpit/items"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/kokpit/items/${id}/resolve`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kokpit/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kokpit/calendar"] });
      toast({ title: "Položka vybavená a zapísaná do zmluvy" });
    },
  });

  type ContractSearchRow = { id: number; uid: string | null; statusId: number | null };

  const contractSearch = useQuery<{ id: number; uid: string; statusId: number | null }[]>({
    queryKey: ["/api/contracts", "search-uid", uidSearch],
    queryFn: async () => {
      if (!uidSearch.trim()) return [];
      const res = await fetch(`/api/contracts?limit=500`, { credentials: "include" });
      const data = await res.json();
      const all: ContractSearchRow[] = data.contracts ?? data ?? [];
      const q = uidSearch.replace(/\s/g, "").toLowerCase();
      return all
        .filter(c => (c.uid ?? "").replace(/\s/g, "").toLowerCase().includes(q))
        .slice(0, 8)
        .map(c => ({ id: c.id, uid: c.uid ?? "", statusId: c.statusId ?? null }));
    },
    enabled: uidSearch.length >= 3,
  });

  function groupBySource(list: KokpitItemExt[]): Record<string, KokpitItemExt[]> {
    return list.reduce((acc, item) => {
      const k = item.source || "Bez zdroja";
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, KokpitItemExt[]>);
  }

  function handleAssign(item: KokpitItemExt) {
    setWorkingItem(item);
    setSelectedContractId(item.contractId ?? null);
    setSelectedContractUid(item.contractUid ?? null);
    setSelectedStatusId(item.statusId ? String(item.statusId) : "");
    setActiveTab("rozdelenie");
  }

  async function handleSaveRozdelenie() {
    if (!workingItem) return;
    await moveMutation.mutateAsync({
      id: workingItem.id,
      phase: 2,
      contractId: selectedContractId,
      statusId: selectedStatusId ? parseInt(selectedStatusId) : null,
    });
    setActiveTab("riesenie");
  }

  function handleOpenResolve(item: KokpitItemExt) {
    setResolveItem(item);
    setStatusModalOpen(true);
  }

  const grouped1 = groupBySource(phase1Items);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 flex flex-col"
          style={{ maxWidth: "90vw", width: "90vw", height: "90vh", maxHeight: "90vh" }}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-lg font-bold">Kokpit — Spracovanie stavov</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 shrink-0 justify-start">
              <TabsTrigger value="prichod" data-testid="tab-prichod">
                PRÍCHOD
                {phase1Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase1Items.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rozdelenie" data-testid="tab-rozdelenie">
                ROZDELENIE
                {phase2Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase2Items.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="riesenie" data-testid="tab-riesenie">
                RIEŠENIE
                {phase3Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase3Items.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* PRÍCHOD */}
            <TabsContent value="prichod" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {isLoading && <p className="text-sm text-muted-foreground">Načítavam...</p>}
              {!isLoading && phase1Items.length === 0 && (
                <p className="text-sm text-muted-foreground">Žiadne nové položky.</p>
              )}
              {Object.entries(grouped1).map(([source, sourceItems]) => (
                <div key={source} className="border-2 rounded-lg overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <span>{source}</span>
                    <span className="ml-auto">{sourceItems.length} položiek</span>
                  </div>
                  <div className="divide-y">
                    {sourceItems.map(item => {
                      const created = new Date(item.createdAt!);
                      const pulse = isAdminAlert(created);
                      return (
                        <div
                          key={item.id}
                          data-testid={`row-kokpit-${item.id}`}
                          className="flex items-center gap-3 px-3 py-2"
                          style={{ background: isOverdue(created) ? "rgba(234,88,12,0.04)" : undefined }}
                        >
                          <TripleRingStatus phase={1} size={22} pulsing={pulse} />
                          <span className="flex-1 text-sm">{item.title}</span>
                          <AgingBadge dayCreated={item.dayCreated} />
                          <SlaTimer createdAt={item.createdAt!} resolvedAt={item.resolvedAt ? String(item.resolvedAt) : null} />
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-assign-${item.id}`}
                            onClick={() => handleAssign(item)}
                          >
                            Priradiť
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* ROZDELENIE */}
            <TabsContent value="rozdelenie" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {workingItem ? (
                <div className="max-w-lg space-y-4">
                  <div className="flex items-center gap-3 border rounded-lg p-3">
                    <TripleRingStatus phase={2} size={22} />
                    <div>
                      <p className="text-sm font-medium">{workingItem.title}</p>
                      <p className="text-xs text-muted-foreground">{workingItem.source}</p>
                    </div>
                    <AgingBadge dayCreated={workingItem.dayCreated} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zmluva (UID)</label>
                    <Input
                      data-testid="input-uid-search"
                      placeholder="Hľadaj UID zmluvy..."
                      value={uidSearch}
                      onChange={e => setUidSearch(e.target.value)}
                    />
                    {selectedContractUid && (
                      <p className="text-xs text-green-600 font-medium">Priradené: {selectedContractUid}</p>
                    )}
                    {contractSearch.data && contractSearch.data.length > 0 && (
                      <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                        {contractSearch.data.map(c => (
                          <button
                            key={c.id}
                            data-testid={`option-contract-${c.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setSelectedContractId(c.id);
                              setSelectedContractUid(c.uid);
                              setUidSearch(c.uid);
                            }}
                          >
                            {c.uid}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategória stavu</label>
                    <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                      <SelectTrigger data-testid="select-status-category">
                        <SelectValue placeholder="Vyber kategóriu..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    data-testid="button-save-rozdelenie"
                    onClick={handleSaveRozdelenie}
                    disabled={moveMutation.isPending}
                    className="w-full"
                  >
                    {moveMutation.isPending ? "Ukladám..." : "Uložiť a presunúť do Riešenia"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {phase2Items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Žiadne položky v Rozdelení. Priraďte ich z Príchodu.</p>
                  )}
                  {phase2Items.map(item => {
                    const created = new Date(item.createdAt!);
                    const pulse = isAdminAlert(created);
                    return (
                      <div
                        key={item.id}
                        data-testid={`row-kokpit-r2-${item.id}`}
                        className="flex items-center gap-3 border rounded-lg px-3 py-2"
                        style={{ background: isOverdue(created) ? "rgba(234,88,12,0.06)" : undefined }}
                      >
                        <TripleRingStatus phase={2} size={22} pulsing={pulse} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.contractUid || "—"} · {item.statusName || "—"}</p>
                        </div>
                        <AgingBadge dayCreated={item.dayCreated} />
                        <SlaTimer createdAt={item.createdAt!} resolvedAt={item.resolvedAt ? String(item.resolvedAt) : null} />
                        <Button size="sm" variant="outline" onClick={() => handleAssign(item)}>Upraviť</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* RIEŠENIE */}
            <TabsContent value="riesenie" className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {phase3Items.length === 0 && phase2Items.length === 0 && (
                <p className="text-sm text-muted-foreground">Žiadne položky na riešenie.</p>
              )}
              {[...phase2Items, ...phase3Items].map(item => {
                const created = new Date(item.createdAt!);
                const pulse = isAdminAlert(created);
                const done = item.phase === 3;
                return (
                  <div
                    key={item.id}
                    data-testid={`row-kokpit-r3-${item.id}`}
                    className="flex items-center gap-3 border rounded-lg px-3 py-2"
                    style={{
                      opacity: done ? 0.6 : 1,
                      background: !done && isOverdue(created) ? "rgba(234,88,12,0.06)" : undefined,
                    }}
                  >
                    <TripleRingStatus phase={item.phase as 1 | 2 | 3} size={22} pulsing={!done && pulse} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.contractUid || "—"} · {item.statusName || "—"}
                      </p>
                    </div>
                    <AgingBadge dayCreated={item.dayCreated} />
                    {!done && (
                      <SlaTimer createdAt={item.createdAt!} resolvedAt={null} />
                    )}
                    {done ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Vybavené</span>
                    ) : (
                      <Button
                        size="sm"
                        data-testid={`button-resolve-${item.id}`}
                        onClick={() => handleOpenResolve(item)}
                        disabled={!item.contractId}
                      >
                        Zapísať do zmluvy
                      </Button>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {resolveItem && resolveItem.contractId && (
        <StatusChangeModal
          open={statusModalOpen}
          onOpenChange={v => {
            setStatusModalOpen(v);
            if (!v) setResolveItem(null);
          }}
          contractId={resolveItem.contractId}
          currentStatusId={null}
          statuses={statuses}
          onSuccess={async () => {
            await resolveMutation.mutateAsync(resolveItem.id);
            setStatusModalOpen(false);
            setResolveItem(null);
          }}
        />
      )}
    </>
  );
}
