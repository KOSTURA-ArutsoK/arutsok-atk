import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Plus, X, Check, Loader2, Zap, GripVertical, Upload } from "lucide-react";

const PANEL_BG = "#07111f";

const IDENTIFIER_TYPES: Record<string, string> = {
  proposalNumber: "Č. návrhu",
  contractNumber: "Č. zmluvy",
  insuranceContractNumber: "Č. poistnej zmluvy",
};

const PARAM_TYPE_LABELS: Record<string, string> = {
  text: "text",
  date: "dátum",
  number: "číslo",
  boolean: "áno/nie",
  select: "výber",
};

function genExcelLetter(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function excelLetterToIndex(letter: string): number {
  let n = 0;
  for (let i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n;
}

type ColMapping = Record<string, { key: string; label: string; paramType?: string; paramId?: number }>;

interface ServerParam {
  id: number | null;
  name: string;
  paramType: string;
  statusId: number | null;
  statusName: string | null;
  isBuiltin: boolean;
  key: string;
}
type AnyParam = { key: string; label: string; paramType: string; paramId?: number; isBuiltin?: boolean };

function isParamAssigned(colMap: ColMapping, key: string): string | null {
  for (const [letter, val] of Object.entries(colMap)) {
    if (val.key === key) return letter;
  }
  return null;
}

interface HromadnyImportPanelProps {
  onBack: () => void;
  onLaunchType: (typeId?: number) => void;
  onStartImportReview?: (parsedData: any, selectedType: any) => void;
  shadowRoyalBlue?: string;
  panelFilter?: string;
}

export function HromadnyImportPanel({ onBack, onLaunchType, onStartImportReview, shadowRoyalBlue, panelFilter }: HromadnyImportPanelProps) {
  const { toast } = useToast();

  const { data: serverParams = [], isLoading: paramsLoading } = useQuery<ServerParam[]>({
    queryKey: ["/api/contract-status-parameters/all"],
  });
  const allParams: AnyParam[] = serverParams.map(p => ({
    key: p.key,
    label: p.name,
    paramType: p.paramType,
    paramId: p.id ?? undefined,
    isBuiltin: p.isBuiltin,
  }));
  const { data: types = [], isLoading: typesLoading } = useQuery<any[]>({
    queryKey: ["/api/bulk-status-import-types"],
  });

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [letters, setLetters] = useState<string[]>(() => Array.from({ length: 10 }, (_, i) => genExcelLetter(i + 1)));
  const [colMap, setColMap] = useState<ColMapping>({});

  const [selectedParamKey, setSelectedParamKey] = useState<string | null>(null);
  const [draggedParamKey, setDraggedParamKey] = useState<string | null>(null);
  const [dragOverLetter, setDragOverLetter] = useState<string | null>(null);

  const [showNewTypeForm, setShowNewTypeForm] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({ name: "", description: "", identifierType: "proposalNumber" });
  const lastClickRef = useRef<{ id: number; ts: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const saveMut = useMutation({
    mutationFn: ({ id, columnMapping }: { id: number; columnMapping: ColMapping }) =>
      apiRequest("PATCH", `/api/bulk-status-import-types/${id}`, { columnMapping }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-types"] });
      toast({ title: "Šablóna uložená" });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const createTypeMut = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/bulk-status-import-types", d),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-types"] });
      setShowNewTypeForm(false);
      setNewTypeForm({ name: "", description: "", identifierType: "proposalNumber" });
      setSelectedTypeId(data.id);
      setColMap(data.columnMapping || {});
      toast({ title: "Typ vytvorený" });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const allParamsFlat = allParams;

  function selectType(t: any) {
    setSelectedTypeId(t.id);
    const cm: ColMapping = (t.columnMapping && typeof t.columnMapping === "object") ? t.columnMapping : {};
    setColMap(cm);
    const usedLetters = Object.keys(cm);
    const maxIndex = usedLetters.reduce((acc, letter) => {
      return Math.max(acc, excelLetterToIndex(letter));
    }, 10);
    setLetters(Array.from({ length: Math.max(maxIndex, 10) }, (_, i) => genExcelLetter(i + 1)));
  }

  function handleTypeClick(t: any) {
    const now = Date.now();
    if (lastClickRef.current && lastClickRef.current.id === t.id && now - lastClickRef.current.ts < 400) {
      lastClickRef.current = null;
      onLaunchType(t.id);
    } else {
      lastClickRef.current = { id: t.id, ts: now };
      selectType(t);
    }
  }

  function addLetter() {
    const next = genExcelLetter(letters.length + 1);
    setLetters(l => [...l, next]);
  }

  function assignToLetter(letter: string, paramKey: string) {
    const param = allParamsFlat.find(p => p.key === paramKey);
    if (!param) return;
    setColMap(prev => {
      const next: ColMapping = {};
      for (const [l, v] of Object.entries(prev)) {
        if (v.key !== paramKey) next[l] = v;
      }
      next[letter] = { key: param.key, label: param.label, paramType: param.paramType, paramId: param.paramId };
      return next;
    });
    setSelectedParamKey(null);
  }

  function unassignLetter(letter: string) {
    setColMap(prev => {
      const next = { ...prev };
      delete next[letter];
      return next;
    });
  }

  function handleLetterClick(letter: string) {
    if (selectedParamKey) {
      assignToLetter(letter, selectedParamKey);
    }
  }

  function handleParamClick(key: string) {
    setSelectedParamKey(prev => prev === key ? null : key);
  }

  function handleDragStart(e: React.DragEvent, key: string) {
    setDraggedParamKey(key);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleDragEnd() {
    setDraggedParamKey(null);
    setDragOverLetter(null);
  }

  function handleLetterDragOver(e: React.DragEvent, letter: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverLetter(letter);
  }

  function handleLetterDrop(e: React.DragEvent, letter: string) {
    e.preventDefault();
    if (draggedParamKey) {
      assignToLetter(letter, draggedParamKey);
    }
    setDragOverLetter(null);
  }

  function handleSave() {
    if (!selectedTypeId) return;
    saveMut.mutate({ id: selectedTypeId, columnMapping: colMap });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const selectedTypeObj = types.find((t: any) => t.id === selectedTypeId);
    if (!selectedTypeObj) return;
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bulk-status-import/parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Chyba pri parsovaní súboru" }));
        toast({ title: "Chyba", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      onStartImportReview?.(data, selectedTypeObj);
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa načítať súbor", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  }

  const selectedType = types.find((t: any) => t.id === selectedTypeId);

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        width: "90vw",
        height: "90vh",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: PANEL_BG,
        zIndex: 4,
        overflow: "hidden",
        borderRadius: 12,
        border: "2px solid #1B263B",
        boxShadow: shadowRoyalBlue,
        filter: panelFilter,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(245,158,11,0.15)", background: "#0c1a2e" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-300/70 hover:text-amber-100 hover:bg-white/10 transition-colors text-xs font-semibold border border-amber-500/20 hover:border-amber-400/40"
          data-testid="button-import-builder-back"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Späť
        </button>
        <div className="h-3 w-px bg-amber-500/25 mx-1" />
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-extrabold tracking-[0.2em] text-amber-300">HROMADNÝ IMPORT STAVOV</span>
        {selectedType && (
          <>
            <div className="h-3 w-px bg-amber-500/25 mx-1" />
            <span className="text-xs text-amber-300/60 font-semibold truncate max-w-[200px]">{selectedType.name}</span>
          </>
        )}
      </div>

      {/* Body: two columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Konfigurátor stĺpcov ── */}
        <div
          className="flex flex-col flex-1 overflow-hidden min-h-0"
          style={{ borderRight: "1px solid #1B263B" }}
        >
          {/* Section title */}
          <div
            className="px-4 py-2.5 shrink-0 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-blue-300/50 uppercase">Konfigurátor stĺpcov</span>
            <span className="text-[10px] text-blue-300/30 ml-1">
              {Object.keys(colMap).length > 0 ? `· ${Object.keys(colMap).length} priradených` : ""}
            </span>
          </div>

          <div className="flex flex-col flex-1 overflow-y-auto min-h-0 p-4 gap-4">

            {/* Alphabet row */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-blue-300/40 uppercase">Stĺpce</span>
                <span className="text-[10px] text-blue-300/25">
                  {selectedParamKey
                    ? `· kliknite na stĺpec pre priradenie: „${allParamsFlat.find(p => p.key === selectedParamKey)?.label}"`
                    : "· potiahnite parameter do stĺpca alebo kliknite parameter a potom stĺpec"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-start">
                {letters.map(letter => {
                  const assigned = colMap[letter];
                  const isDragTarget = dragOverLetter === letter;
                  const isClickTarget = !!selectedParamKey && !assigned;
                  return (
                    <div
                      key={letter}
                      data-testid={`letter-slot-${letter}`}
                      onClick={() => handleLetterClick(letter)}
                      onDragOver={e => handleLetterDragOver(e, letter)}
                      onDragLeave={() => setDragOverLetter(null)}
                      onDrop={e => handleLetterDrop(e, letter)}
                      className="relative flex flex-col items-center rounded-xl transition-all duration-150 cursor-pointer select-none"
                      style={{
                        minWidth: 60,
                        minHeight: 64,
                        background: assigned
                          ? "rgba(59,130,246,0.12)"
                          : isDragTarget || isClickTarget
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(255,255,255,0.03)",
                        border: assigned
                          ? "1.5px solid rgba(59,130,246,0.4)"
                          : isDragTarget || isClickTarget
                          ? "1.5px dashed rgba(245,158,11,0.6)"
                          : "1.5px dashed rgba(255,255,255,0.12)",
                        padding: "6px 8px 8px 8px",
                      }}
                    >
                      <span
                        className="text-[11px] font-black tracking-wider"
                        style={{ color: assigned ? "rgba(147,197,253,0.9)" : "rgba(148,163,184,0.45)" }}
                      >
                        {letter}
                      </span>
                      {assigned ? (
                        <div className="mt-1 flex flex-col items-center gap-0.5 w-full">
                          <span
                            className="text-[9px] text-center font-semibold leading-snug"
                            style={{ color: "rgba(147,197,253,0.8)", maxWidth: 54, wordBreak: "break-word" }}
                          >
                            {assigned.label}
                          </span>
                          <span
                            className="text-[8px] px-1 rounded"
                            style={{
                              background: "rgba(59,130,246,0.15)",
                              color: "rgba(147,197,253,0.5)",
                              marginTop: 1,
                            }}
                          >
                            {PARAM_TYPE_LABELS[assigned.paramType ?? ""] ?? assigned.paramType ?? ""}
                          </span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); unassignLetter(letter); }}
                            className="mt-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors"
                            style={{ color: "rgba(239,68,68,0.5)" }}
                            data-testid={`button-unassign-${letter}`}
                          >
                            <X style={{ width: 9, height: 9 }} />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center justify-center w-full opacity-30">
                          <GripVertical style={{ width: 12, height: 12, color: "#64748b" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* + button */}
                <button
                  type="button"
                  onClick={addLetter}
                  data-testid="button-add-letter"
                  className="flex items-center justify-center rounded-xl hover:bg-white/8 transition-all duration-150 border text-blue-300/40 hover:text-blue-300/70 hover:border-blue-400/30"
                  style={{
                    minWidth: 40,
                    minHeight: 64,
                    border: "1.5px dashed rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {/* Parameter bubbles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-blue-300/40 uppercase">Dostupné parametre</span>
                {selectedParamKey && (
                  <button
                    type="button"
                    onClick={() => setSelectedParamKey(null)}
                    className="text-[10px] text-amber-400/60 hover:text-amber-300 transition-colors"
                  >
                    zrušiť výber
                  </button>
                )}
              </div>
              {paramsLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400/40" />
                  <span className="text-xs text-blue-300/30">Načítavam parametre...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allParamsFlat.map(param => {
                    const assigned = isParamAssigned(colMap, param.key);
                    const isSelected = selectedParamKey === param.key;
                    const isBuiltin = param.key === "identifier" || param.key === "status";
                    return (
                      <div
                        key={param.key}
                        draggable
                        onDragStart={e => handleDragStart(e, param.key)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleParamClick(param.key)}
                        data-testid={`param-bubble-${param.key}`}
                        className="flex items-center gap-1.5 rounded-full cursor-grab active:cursor-grabbing select-none transition-all duration-150"
                        style={{
                          padding: "5px 12px 5px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          background: isSelected
                            ? "rgba(245,158,11,0.2)"
                            : assigned
                            ? "rgba(34,197,94,0.1)"
                            : isBuiltin
                            ? "rgba(59,130,246,0.1)"
                            : "rgba(255,255,255,0.04)",
                          border: isSelected
                            ? "1.5px solid rgba(245,158,11,0.6)"
                            : assigned
                            ? "1.5px solid rgba(34,197,94,0.3)"
                            : isBuiltin
                            ? "1.5px solid rgba(59,130,246,0.25)"
                            : "1.5px solid rgba(255,255,255,0.1)",
                          color: isSelected
                            ? "rgba(251,191,36,0.9)"
                            : assigned
                            ? "rgba(134,239,172,0.7)"
                            : isBuiltin
                            ? "rgba(147,197,253,0.8)"
                            : "rgba(148,163,184,0.7)",
                        }}
                      >
                        <GripVertical style={{ width: 11, height: 11, opacity: 0.5, flexShrink: 0 }} />
                        <span>{param.label}</span>
                        <span
                          className="text-[9px] rounded px-1"
                          style={{
                            background: "rgba(255,255,255,0.07)",
                            color: "rgba(148,163,184,0.5)",
                            marginLeft: 2,
                          }}
                        >
                          {PARAM_TYPE_LABELS[param.paramType] ?? param.paramType}
                        </span>
                        {assigned && (
                          <span
                            className="text-[9px] font-black rounded px-1"
                            style={{ background: "rgba(34,197,94,0.15)", color: "rgba(134,239,172,0.8)" }}
                          >
                            {assigned}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer: save button */}
          <div
            className="px-4 py-3 shrink-0 flex items-center gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            {!selectedTypeId && (
              <span className="text-xs text-blue-300/30">Vyberte šablónu vpravo pre uloženie</span>
            )}
            {selectedTypeId && (
              <>
                <span className="text-xs text-blue-300/40 flex-1">
                  {Object.keys(colMap).length} stĺpcov priradených
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMut.isPending}
                  data-testid="button-save-template"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all"
                  style={{
                    background: saveMut.isPending ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.18)",
                    border: "1.5px solid rgba(34,197,94,0.4)",
                    color: "rgba(134,239,172,0.9)",
                    cursor: saveMut.isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {saveMut.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Check className="w-3 h-3" />
                  }
                  Uložiť šablónu
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Uložené šablóny ── */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: "38%", minWidth: 280, flexShrink: 0 }}
        >
          {/* Section title */}
          <div
            className="px-4 py-2.5 shrink-0 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-amber-300/50 uppercase">Uložené šablóny</span>
            <button
              type="button"
              onClick={() => setShowNewTypeForm(v => !v)}
              data-testid="button-new-type-toggle"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-amber-300/50 hover:text-amber-200 hover:bg-white/8 transition-colors border border-transparent hover:border-amber-500/20"
            >
              <Plus style={{ width: 11, height: 11 }} />
              Nová
            </button>
          </div>

          {/* New type inline form */}
          {showNewTypeForm && (
            <div
              className="px-4 py-3 shrink-0 flex flex-col gap-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(245,158,11,0.04)" }}
            >
              <input
                type="text"
                placeholder="Názov šablóny *"
                value={newTypeForm.name}
                onChange={e => setNewTypeForm(p => ({ ...p, name: e.target.value }))}
                data-testid="input-new-type-name"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-blue-100 placeholder-blue-300/30 focus:outline-none focus:border-amber-500/40"
              />
              <input
                type="text"
                placeholder="Popis (voliteľné)"
                value={newTypeForm.description}
                onChange={e => setNewTypeForm(p => ({ ...p, description: e.target.value }))}
                data-testid="input-new-type-desc"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-blue-100 placeholder-blue-300/30 focus:outline-none focus:border-amber-500/40"
              />
              <select
                value={newTypeForm.identifierType}
                onChange={e => setNewTypeForm(p => ({ ...p, identifierType: e.target.value }))}
                data-testid="select-new-type-identifier"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-amber-500/40"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <option value="proposalNumber">Číslo návrhu</option>
                <option value="contractNumber">Číslo zmluvy</option>
                <option value="insuranceContractNumber">Číslo poistnej zmluvy</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => createTypeMut.mutate(newTypeForm)}
                  disabled={!newTypeForm.name.trim() || createTypeMut.isPending}
                  data-testid="button-create-type"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    border: "1.5px solid rgba(34,197,94,0.35)",
                    color: "rgba(134,239,172,0.85)",
                    opacity: newTypeForm.name.trim() && !createTypeMut.isPending ? 1 : 0.5,
                    cursor: newTypeForm.name.trim() && !createTypeMut.isPending ? "pointer" : "not-allowed",
                  }}
                >
                  {createTypeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Vytvoriť
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewTypeForm(false); setNewTypeForm({ name: "", description: "", identifierType: "proposalNumber" }); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-blue-300/40 hover:text-blue-300/70 transition-colors"
                >
                  Zrušiť
                </button>
              </div>
            </div>
          )}

          {/* Types list */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {typesLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400/40" />
                <span className="text-xs text-blue-300/30">Načítavam šablóny...</span>
              </div>
            ) : types.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Zap className="w-10 h-10 text-amber-400/15" />
                <p className="text-xs text-blue-300/30">Žiadne šablóny.</p>
                <p className="text-[10px] text-blue-300/20">Kliknite „Nová" pre vytvorenie prvej šablóny.</p>
              </div>
            ) : types.map((t: any) => {
              const isSelected = selectedTypeId === t.id;
              const mappedCount = t.columnMapping ? Object.keys(t.columnMapping).length : 0;
              return (
                <div
                  key={t.id}
                  onClick={() => handleTypeClick(t)}
                  data-testid={`type-card-${t.id}`}
                  className="rounded-xl p-3 cursor-pointer transition-all duration-150 select-none"
                  style={{
                    background: isSelected
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: isSelected
                      ? "1.5px solid rgba(34,197,94,0.4)"
                      : "1.5px solid rgba(255,255,255,0.08)",
                    boxShadow: isSelected ? "0 0 12px rgba(34,197,94,0.1)" : "none",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-semibold text-sm leading-snug truncate"
                        style={{ color: isSelected ? "rgba(134,239,172,0.9)" : "rgba(148,163,184,0.8)" }}
                      >
                        {t.name}
                      </div>
                      {t.description && (
                        <div className="text-[10px] mt-0.5 leading-snug line-clamp-2" style={{ color: "rgba(148,163,184,0.4)" }}>
                          {t.description}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: "rgba(134,239,172,0.7)", marginTop: 1 }} />}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(59,130,246,0.1)",
                        border: "1px solid rgba(59,130,246,0.2)",
                        color: "rgba(147,197,253,0.6)",
                      }}
                    >
                      {IDENTIFIER_TYPES[t.identifierType] ?? t.identifierType}
                    </span>
                    {mappedCount > 0 && (
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(245,158,11,0.1)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          color: "rgba(251,191,36,0.6)",
                        }}
                      >
                        {mappedCount} stĺpc{mappedCount === 1 ? "" : mappedCount < 5 ? "e" : "ov"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[9px]" style={{ color: "rgba(148,163,184,0.25)" }}>
                    Dvojklik → spustiť import
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: Importovať button — visible only when template selected */}
          {selectedTypeId !== null && (
            <div
              className="shrink-0 px-4 py-3 flex justify-end"
              style={{ borderTop: "1px solid #1B263B", background: "rgba(255,255,255,0.015)" }}
            >
              <button
                type="button"
                disabled={isParsing}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-importovat"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all select-none"
                style={{
                  background: isParsing ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.15)",
                  border: "1.5px solid rgba(34,197,94,0.4)",
                  color: isParsing ? "rgba(134,239,172,0.5)" : "rgba(134,239,172,0.9)",
                  boxShadow: isParsing ? "none" : "0 0 12px rgba(34,197,94,0.12)",
                  cursor: isParsing ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                {isParsing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />
                }
                {isParsing ? "Načítavam..." : "Importovať"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for Excel upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
        data-testid="input-import-file"
      />
    </div>
  );
}
