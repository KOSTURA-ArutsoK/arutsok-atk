import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { Plus, Pencil, Trash2, Smile, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Division } from "@shared/schema";

const EMOJI_LIST = [
  "🏦","💼","📊","📈","📉","💰","💵","💳","🏧","💹",
  "🏠","🏡","🏢","🏣","🏤","🏥","🏛","🏨","🏩","🏪",
  "🏫","🏬","🏭","🏯","🏰","🗼","🗽","🗿","🗺","🌍",
  "🌎","🌏","🌐","🌑","🌒","🌓","🌔","🌕","🌖","🌗",
  "⭐","🌟","💫","✨","🎯","🎪","🎨","🎭","🎬","🎤",
  "🎧","🎼","🎵","🎶","🎸","🎹","🎺","🎻","🥁","🎷",
  "🚀","✈️","🚂","🚢","🚗","🚕","🚙","🚌","🚎","🏎",
  "🚑","🚒","🚓","🚐","🚚","🚛","🚜","🏍","🛵","🛺",
  "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🥏","🎱","🏓",
  "🏸","🥊","🥋","🎿","⛷","🏂","🏋","🤸","🤺","🤼",
  "🔑","🗝","🔐","🔒","🔓","🔏","🛡","⚔","🗡","🔫",
  "🌲","🌳","🌴","🌵","🌾","🌿","☘","🍀","🍁","🍂",
  "🍎","🍊","🍋","🍇","🍓","🍒","🍑","🥭","🍍","🥝",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
  "🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🦅","🦆",
  "🦉","🦋","🐛","🐌","🐞","🐜","🦟","🦗","🕷","🦂",
  "🌺","🌻","🌹","🌷","🌸","💐","🌼","🍄","🌰","🦀",
  "💎","💍","👑","🏆","🥇","🥈","🥉","🎖","🏅","🎗",
  "🎁","🎀","🎊","🎉","🎈","🎆","🎇","✏","📝","📌",
  "📍","📎","🖇","📏","📐","✂","🗃","🗄","🗑","🔧",
  "🔨","⚙","🔩","🔬","🔭","📡","💡","🔦","🕯","🪔",
  "📱","💻","🖥","🖨","⌨","🖱","🖲","💾","💿","📀",
  "📷","📸","📹","🎥","📽","🎞","📞","☎","📟","📠",
  "🧲","🔋","🪫","💊","🩺","🧬","🧪","🧫","🧯","🪜",
  "🧭","⏱","⏰","⌛","⏳","📅","📆","🗒","📋","📁",
];

const DIVISION_COLUMNS: ColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "emoji", label: "Emotikon" },
  { key: "name", label: "Názov" },
  { key: "code", label: "Kód" },
  { key: "description", label: "Popis" },
  { key: "isActive", label: "Aktívna" },
];

function EmojiPickerDialog({
  open,
  onOpenChange,
  selected,
  usedEmojis,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string;
  usedEmojis: string[];
  onSelect: (emoji: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vybrať emotikon divízie</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Vypnuté emotikony sú už priradené inej divízii. Každý emotikon musí byť unikátny.
        </p>
        <div className="grid grid-cols-10 gap-1 max-h-[420px] overflow-y-auto pr-1 mt-2">
          {EMOJI_LIST.map((em) => {
            const isUsed = usedEmojis.includes(em);
            const isSelected = em === selected;
            return (
              <button
                key={em}
                disabled={isUsed}
                onClick={() => { onSelect(em); onOpenChange(false); }}
                title={isUsed ? "Už priradený inej divízii" : em}
                className={[
                  "flex items-center justify-center text-2xl rounded-md h-10 w-full transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground ring-2 ring-primary"
                    : isUsed
                    ? "opacity-20 cursor-not-allowed"
                    : "hover:bg-accent cursor-pointer",
                ].join(" ")}
                data-testid={`button-emoji-pick-${em}`}
              >
                {em}
              </button>
            );
          })}
        </div>
        {selected && (
          <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
            <span className="text-sm text-muted-foreground">Aktuálne vybraný:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selected}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onSelect(""); onOpenChange(false); }}
                data-testid="button-emoji-clear"
              >
                Zrušiť výber
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsDivisions() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Division | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<number | "none">>(new Set());

  const { data: appUser } = useAppUser();
  const activeCompanyId = appUser?.activeCompanyId ?? null;

  const { data: allDivisionsRaw, isLoading } = useQuery<any[]>({ queryKey: ["/api/divisions"] });
  const { data: allCompanies } = useMyCompanies();

  const columnVisibility = useColumnVisibility("settings-divisions", DIVISION_COLUMNS);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/divisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", activeCompanyId, "divisions"] });
      toast({ title: "Úspech", description: "Divízia vymazaná" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazať divíziu", variant: "destructive" }),
  });

  function openNew() {
    setEditingDivision(null);
    setFormOpen(true);
  }

  function openEdit(d: Division) {
    setEditingDivision(d);
    setFormOpen(true);
  }

  function toggleCompany(key: number | "none") {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const allDivisions: Division[] = allDivisionsRaw || [];

  const companyGroups = (allCompanies || []).map(company => ({
    company,
    divisions: allDivisions
      .filter((d: any) => (d.companies || []).some((c: any) => c.id === company.id))
      .sort((a, b) => a.name.localeCompare(b.name, "sk")),
  })).filter(g => g.divisions.length > 0);

  const assignedDivisionIds = new Set(
    allDivisions.filter((d: any) => (d.companies || []).length > 0).map(d => d.id)
  );
  const unassignedDivisions = allDivisions
    .filter(d => !assignedDivisionIds.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name, "sk"));

  const colSpan = [
    columnVisibility.isVisible("id"),
    columnVisibility.isVisible("emoji"),
    columnVisibility.isVisible("name"),
    columnVisibility.isVisible("code"),
    columnVisibility.isVisible("description"),
    columnVisibility.isVisible("isActive"),
  ].filter(Boolean).length + 1;

  function renderDivisionRow(div: Division) {
    return (
      <TableRow key={div.id} className={!div.isActive ? "opacity-50" : ""} onRowClick={() => openEdit(div)}>
        {columnVisibility.isVisible("id") && <TableCell data-testid={`text-division-id-${div.id}`}>{div.id}</TableCell>}
        {columnVisibility.isVisible("emoji") && (
          <TableCell className="text-center text-2xl" data-testid={`text-division-emoji-${div.id}`}>
            {(div as any).emoji || <span className="text-muted-foreground text-sm">–</span>}
          </TableCell>
        )}
        {columnVisibility.isVisible("name") && <TableCell className="font-medium" data-testid={`text-division-name-${div.id}`}>{div.name}</TableCell>}
        {columnVisibility.isVisible("code") && <TableCell><Badge variant="secondary" className="font-mono">{div.code || "–"}</Badge></TableCell>}
        {columnVisibility.isVisible("description") && <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{div.description || "–"}</TableCell>}
        {columnVisibility.isVisible("isActive") && <TableCell><Badge variant={div.isActive ? "default" : "secondary"}>{div.isActive ? "Áno" : "Nie"}</Badge></TableCell>}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(div)} data-testid={`button-edit-division-${div.id}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upraviť</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="ghost" onClick={() => setDeleteTarget(div)} data-testid={`button-delete-division-${div.id}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vymazať</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-divisions-title">Divízie</h1>
          <p className="text-muted-foreground text-sm">Divízie zoradené podľa spoločnosti</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnManager columns={DIVISION_COLUMNS} storageKey="settings-divisions" columnVisibility={columnVisibility} />
          <Button onClick={openNew} data-testid="button-add-division">
            <Plus className="w-4 h-4 mr-2" /> Pridať divíziu
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Načítavam...</div>
          ) : !allDivisions.length ? (
            <div className="p-8 text-center text-muted-foreground">Žiadne divízie</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("id") && <TableHead>ID</TableHead>}
                  {columnVisibility.isVisible("emoji") && <TableHead className="w-14 text-center">Emotikon</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead>Názov</TableHead>}
                  {columnVisibility.isVisible("code") && <TableHead>Kód</TableHead>}
                  {columnVisibility.isVisible("description") && <TableHead>Popis</TableHead>}
                  {columnVisibility.isVisible("isActive") && <TableHead>Aktívna</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyGroups.map(({ company, divisions }) => (
                  <>
                    <TableRow
                      key={`company-${company.id}`}
                      className="bg-muted/40 hover:bg-muted/60 cursor-pointer select-none"
                      data-testid={`row-company-group-${company.id}`}
                      onClick={() => toggleCompany(company.id)}
                    >
                      <TableCell colSpan={colSpan} className="py-2">
                        <div className="flex items-center gap-2">
                          {expandedCompanies.has(company.id)
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-semibold text-sm">{company.name}</span>
                          <Badge variant="outline" className="text-[10px] ml-1">{divisions.length}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedCompanies.has(company.id) && divisions.map(renderDivisionRow)}
                  </>
                ))}
                {unassignedDivisions.length > 0 && (
                  <>
                    <TableRow
                      className="bg-muted/40 hover:bg-muted/60 cursor-pointer select-none"
                      onClick={() => toggleCompany("none")}
                    >
                      <TableCell colSpan={colSpan} className="py-2">
                        <div className="flex items-center gap-2">
                          {expandedCompanies.has("none")
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-semibold text-sm">Nepriradené</span>
                          <Badge variant="outline" className="text-[10px] ml-1">{unassignedDivisions.length}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedCompanies.has("none") && unassignedDivisions.map(renderDivisionRow)}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DivisionFormDialog open={formOpen} onOpenChange={setFormOpen} editingDivision={editingDivision} activeCompanyId={activeCompanyId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať divíziu?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vymazať divíziu „{deleteTarget?.name}"? Táto akcia je nevratná a odstráni aj všetky prepojenia so spoločnosťami.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-division">Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} data-testid="button-confirm-delete-division">
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DivisionFormDialog({
  open,
  onOpenChange,
  editingDivision,
  activeCompanyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDivision: Division | null;
  activeCompanyId: number | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [emoji, setEmoji] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [foundedDate, setFoundedDate] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: allDivisions } = useQuery<Division[]>({ queryKey: ["/api/divisions"] });

  const usedEmojis = (allDivisions || [])
    .filter((d: any) => d.id !== editingDivision?.id && d.emoji)
    .map((d: any) => d.emoji as string);

  const emojiDuplicate = !!emoji && usedEmojis.includes(emoji);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/divisions", data);
      const newDivision = await res.json();
      if (activeCompanyId && newDivision?.id) {
        await apiRequest("POST", `/api/companies/${activeCompanyId}/divisions`, { divisionId: newDivision.id });
      }
      return newDivision;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", activeCompanyId, "divisions"] });
      toast({ title: "Úspech", description: "Divízia vytvorená" });
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvoriť divíziu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/divisions/${editingDivision?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", activeCompanyId, "divisions"] });
      toast({ title: "Úspech", description: "Divízia aktualizovaná" });
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa aktualizovať divíziu", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editingDivision) {
        setName(editingDivision.name);
        setCode(editingDivision.code || "");
        setEmoji((editingDivision as any).emoji || "");
        setDescription(editingDivision.description || "");
        setIsActive(editingDivision.isActive ?? true);
        setFoundedDate((editingDivision as any).foundedDate ? new Date((editingDivision as any).foundedDate).toISOString().split("T")[0] : "");
      } else {
        setName("");
        setCode("");
        setEmoji("");
        setDescription("");
        setIsActive(true);
        setFoundedDate("");
      }
    }
  }, [open, editingDivision]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Názov je povinný", variant: "destructive" });
      return;
    }
    if (emojiDuplicate) {
      toast({ title: "Chyba", description: "Tento emotikon sa už používa v inej divízii", variant: "destructive" });
      return;
    }
    const payload = { name, code: code || null, emoji: emoji || null, description: description || null, isActive, foundedDate: foundedDate ? new Date(foundedDate).toISOString() : null };
    if (editingDivision) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle data-testid="text-division-dialog-title">
              {editingDivision ? "Upraviť divíziu" : "Pridať divíziu"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Názov <span className="text-destructive">*</span></label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Finančný trh" data-testid="input-division-name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kód</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="napr. FIN" data-testid="input-division-code" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Emotikon divízie</label>
                <div className="flex items-center gap-2">
                  <div className={[
                    "flex items-center justify-center w-11 h-10 rounded-md border text-2xl flex-shrink-0",
                    emoji ? "border-border bg-background" : "border-dashed border-muted-foreground/40 bg-muted/30"
                  ].join(" ")} data-testid="display-division-emoji">
                    {emoji || <span className="text-muted-foreground text-xs">–</span>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-start gap-2"
                    onClick={() => setPickerOpen(true)}
                    data-testid="button-open-emoji-picker"
                  >
                    <Smile className="w-4 h-4 text-muted-foreground" />
                    {emoji ? "Zmeniť emotikon" : "Vybrať emotikon"}
                  </Button>
                </div>
                {emojiDuplicate && (
                  <p className="text-xs text-destructive" data-testid="text-emoji-duplicate-warning">
                    Tento emotikon sa už používa v inej divízii
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Popis</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Popis divízie" data-testid="input-division-description" rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dátum vytvorenia divízie</label>
              <Input type="date" value={foundedDate} onChange={(e) => setFoundedDate(e.target.value)} data-testid="input-division-founded-date" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-division-active" />
              <label className="text-sm font-medium">Aktívna divízia</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-division">Zrušiť</Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-division">
                {isPending ? "Ukladá sa..." : "Uložiť"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmojiPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={emoji}
        usedEmojis={usedEmojis}
        onSelect={setEmoji}
      />
    </>
  );
}

