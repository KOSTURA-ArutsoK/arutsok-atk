import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUid } from "@/lib/utils";
import {
  ChevronLeft, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Search,
} from "lucide-react";

const PANEL_BG = "#07111f";

type RowState = "pending" | "loading" | "found" | "not-found" | "done" | "error";

interface ParsedData {
  headers: string[];
  allRows: Record<string, string>[];
  fileName: string;
  totalRows: number;
}

interface ImportType {
  id: number;
  name: string;
  identifierType: "proposalNumber" | "contractNumber" | "insuranceContractNumber";
  columnMapping: Record<string, { key: string; label: string; paramType?: string; paramId?: number }>;
}

interface ContractLookupResult {
  id: number;
  uid: string | null;
  proposalNumber: string | null;
  contractNumber: string | null;
  insuranceContractNumber: string | null;
  statusId: number | null;
  statusName: string | null;
  statusColor: string | null;
  subjectId: number | null;
  subjectName: string | null;
}

interface ContractStatus {
  id: number;
  name: string;
  color: string | null;
}

interface StatusParam {
  id: number;
  name: string;
  paramType: string;
  isRequired: boolean;
  options?: string[] | null;
  displayOrder?: number | null;
}

export interface ImportReviewPanelProps {
  onBack: () => void;
  parsedData: ParsedData;
  type: ImportType;
  shadowRoyalBlue?: string;
  panelFilter?: string;
}

function excelLetterToIndex(letter: string): number {
  let n = 0;
  for (let i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n;
}

function headerAtLetter(letter: string | undefined, headers: string[]): string | undefined {
  if (!letter) return undefined;
  const idx = excelLetterToIndex(letter) - 1;
  return headers[idx];
}

function RowBadge({ state }: { state: RowState }) {
  const cfg: Record<RowState, { label: string; bg: string; color: string; border: string; icon?: React.ReactNode }> = {
    pending: { label: "Čakajúci", bg: "rgba(100,116,139,0.12)", color: "rgba(148,163,184,0.6)", border: "rgba(100,116,139,0.2)" },
    loading: { label: "Načítava", bg: "rgba(234,179,8,0.1)", color: "rgba(253,224,71,0.8)", border: "rgba(234,179,8,0.25)", icon: <Loader2 className="w-2.5 h-2.5 animate-spin" /> },
    found: { label: "Nájdená", bg: "rgba(59,130,246,0.1)", color: "rgba(147,197,253,0.8)", border: "rgba(59,130,246,0.25)" },
    "not-found": { label: "Nenájdená", bg: "rgba(239,68,68,0.1)", color: "rgba(252,165,165,0.8)", border: "rgba(239,68,68,0.25)", icon: <XCircle className="w-2.5 h-2.5" /> },
    done: { label: "Hotovo", bg: "rgba(34,197,94,0.1)", color: "rgba(134,239,172,0.85)", border: "rgba(34,197,94,0.3)", icon: <CheckCircle2 className="w-2.5 h-2.5" /> },
    error: { label: "Chyba", bg: "rgba(239,68,68,0.1)", color: "rgba(252,165,165,0.8)", border: "rgba(239,68,68,0.25)", icon: <XCircle className="w-2.5 h-2.5" /> },
  };
  const c = cfg[state];
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

export function ImportReviewPanel({ onBack, parsedData, type, shadowRoyalBlue, panelFilter }: ImportReviewPanelProps) {
  const { toast } = useToast();

  const identifierLetter = Object.entries(type.columnMapping).find(([, v]) => v.key === "identifier")?.[0];
  const statusLetter = Object.entries(type.columnMapping).find(([, v]) => v.key === "status")?.[0];
  const identifierHeader = headerAtLetter(identifierLetter, parsedData.headers);
  const statusHeader = headerAtLetter(statusLetter, parsedData.headers);

  const rows = parsedData.allRows;
  const rowItems = rows.map((row, i) => ({
    index: i,
    identifierValue: identifierHeader ? (row[identifierHeader] ?? "") : "",
    statusValue: statusHeader ? (row[statusHeader] ?? "") : "",
  }));

  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
  const [rowContracts, setRowContracts] = useState<Record<number, ContractLookupResult>>({});
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [newStatusId, setNewStatusId] = useState<string>("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState("");
  const [changedAt, setChangedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lookupAbortRef = useRef<AbortController | null>(null);

  const { data: allStatuses = [] } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: statusParams = [] } = useQuery<StatusParam[]>({
    queryKey: ["/api/contract-statuses", newStatusId, "parameters"],
    queryFn: async () => {
      if (!newStatusId) return [];
      const res = await fetch(`/api/contract-statuses/${newStatusId}/parameters`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!newStatusId,
  });

  const doneCount = Object.values(rowStates).filter(s => s === "done").length;
  const totalRows = rowItems.length;

  const currentRowState = selectedRowIndex !== null ? (rowStates[selectedRowIndex] ?? "pending") : null;
  const currentContract = selectedRowIndex !== null ? rowContracts[selectedRowIndex] : null;
  const currentIdentifier = selectedRowIndex !== null ? rowItems[selectedRowIndex]?.identifierValue : null;
  const currentStatusValue = selectedRowIndex !== null ? rowItems[selectedRowIndex]?.statusValue : null;

  useEffect(() => {
    if (selectedRowIndex === null) return;
    const state = rowStates[selectedRowIndex] ?? "pending";
    if (state === "done") return;

    const identifierValue = rowItems[selectedRowIndex]?.identifierValue;
    if (!identifierValue) {
      setRowStates(prev => ({ ...prev, [selectedRowIndex]: "not-found" }));
      return;
    }

    if (lookupAbortRef.current) lookupAbortRef.current.abort();
    const ac = new AbortController();
    lookupAbortRef.current = ac;

    setRowStates(prev => ({ ...prev, [selectedRowIndex]: "loading" }));
    setNewStatusId("");
    setParamValues({});
    setStatusNote("");

    const capturedIndex = selectedRowIndex;

    fetch(
      `/api/contracts/lookup?q=${encodeURIComponent(identifierValue)}&identifierType=${type.identifierType}`,
      { credentials: "include", signal: ac.signal }
    )
      .then(async res => {
        if (res.status === 404) {
          setRowStates(prev => ({ ...prev, [capturedIndex]: "not-found" }));
          return;
        }
        if (!res.ok) throw new Error("Lookup failed");
        const data: ContractLookupResult = await res.json();
        setRowContracts(prev => ({ ...prev, [capturedIndex]: data }));
        setRowStates(prev => ({ ...prev, [capturedIndex]: "found" }));
        const statusValue = rowItems[capturedIndex]?.statusValue ?? "";
        if (statusValue) {
          const matched = allStatuses.find(s => s.name.toLowerCase() === statusValue.toLowerCase());
          if (matched) setNewStatusId(String(matched.id));
        }
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setRowStates(prev => ({ ...prev, [capturedIndex]: "not-found" }));
      });

    return () => ac.abort();
  }, [selectedRowIndex]);

  useEffect(() => {
    if (!currentStatusValue || !allStatuses.length || newStatusId) return;
    const byValue = allStatuses.find(s => s.name.toLowerCase() === currentStatusValue.toLowerCase());
    if (byValue) setNewStatusId(String(byValue.id));
  }, [allStatuses, currentStatusValue]);

  function selectRow(i: number) {
    const state = rowStates[i] ?? "pending";
    if (state === "done" || state === "error") return;
    setSelectedRowIndex(i);
  }

  function advanceToNextRow() {
    if (selectedRowIndex === null) return;
    for (let i = selectedRowIndex + 1; i < rowItems.length; i++) {
      const s = rowStates[i] ?? "pending";
      if (s !== "done" && s !== "not-found") {
        setSelectedRowIndex(i);
        return;
      }
    }
    for (let i = 0; i < selectedRowIndex; i++) {
      const s = rowStates[i] ?? "pending";
      if (s !== "done" && s !== "not-found") {
        setSelectedRowIndex(i);
        return;
      }
    }
  }

  async function handleConfirm() {
    if (!currentContract || !newStatusId || selectedRowIndex === null) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("newStatusId", newStatusId);
      formData.append("parameterValues", JSON.stringify(paramValues));
      formData.append("changedAt", changedAt);
      if (statusNote.trim()) formData.append("statusNote", statusNote.trim());

      const res = await fetch(`/api/contracts/${currentContract.id}/status-change`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Neznáma chyba" }));
        throw new Error(err.message || "Chyba pri ukladaní");
      }

      const capturedIndex = selectedRowIndex;
      setRowStates(prev => ({ ...prev, [capturedIndex]: "done" }));
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Stav zmluvy bol priradený." });
      advanceToNextRow();
    } catch (err: any) {
      setRowStates(prev => ({ ...prev, [selectedRowIndex]: "error" }));
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const rowListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedRowIndex !== null && rowListRef.current) {
      const el = rowListRef.current.querySelector(`[data-row-index="${selectedRowIndex}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedRowIndex]);

  function renderParamInput(param: StatusParam) {
    const val = paramValues[String(param.id)] ?? "";
    const onChange = (v: string) => setParamValues(prev => ({ ...prev, [String(param.id)]: v }));
    const inputStyle: React.CSSProperties = {
      width: "100%",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid #1B263B",
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 12,
      color: "rgba(226,232,240,0.9)",
      outline: "none",
    };

    if (param.paramType === "boolean") {
      return (
        <select value={val} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, background: "#0d1c2e" }}>
          <option value="">— vybrať —</option>
          <option value="true">Áno</option>
          <option value="false">Nie</option>
        </select>
      );
    }
    if (param.paramType === "select" && param.options?.length) {
      return (
        <select value={val} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, background: "#0d1c2e" }}>
          <option value="">— vybrať —</option>
          {param.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (param.paramType === "date") {
      return <input type="date" value={val} onChange={e => onChange(e.target.value)} style={inputStyle} />;
    }
    if (param.paramType === "number") {
      return <input type="number" value={val} onChange={e => onChange(e.target.value)} style={inputStyle} placeholder={param.name} />;
    }
    return <input type="text" value={val} onChange={e => onChange(e.target.value)} style={inputStyle} placeholder={param.name} />;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid #1B263B",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    color: "rgba(226,232,240,0.9)",
    outline: "none",
  };

  const selectedStatus = allStatuses.find(s => String(s.id) === newStatusId);

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
        zIndex: 5,
        overflow: "hidden",
        borderRadius: 12,
        border: "2px solid #1B263B",
        boxShadow: shadowRoyalBlue,
        filter: panelFilter,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid #1B263B", background: "#0c1a2e" }}
      >
        <button
          type="button"
          onClick={onBack}
          data-testid="button-import-review-back"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold"
          style={{
            color: "rgba(134,239,172,0.7)",
            border: "1px solid rgba(34,197,94,0.2)",
            background: "none",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(134,239,172,1)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(134,239,172,0.7)";
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Späť
        </button>
        <div className="h-3 w-px mx-1" style={{ background: "rgba(34,197,94,0.2)" }} />
        <Search className="w-4 h-4" style={{ color: "rgba(134,239,172,0.5)" }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-extrabold tracking-[0.15em]" style={{ color: "rgba(134,239,172,0.85)" }}>
            KONTROLA IMPORTU
          </span>
          {parsedData.fileName && (
            <span className="ml-3 text-[10px] font-medium" style={{ color: "rgba(148,163,184,0.4)" }}>
              {parsedData.fileName}
            </span>
          )}
        </div>
        <div
          className="shrink-0 px-3 py-1 rounded-full text-xs font-bold"
          style={{
            background: doneCount === totalRows && totalRows > 0
              ? "rgba(34,197,94,0.15)"
              : "rgba(59,130,246,0.1)",
            border: doneCount === totalRows && totalRows > 0
              ? "1px solid rgba(34,197,94,0.3)"
              : "1px solid rgba(59,130,246,0.2)",
            color: doneCount === totalRows && totalRows > 0
              ? "rgba(134,239,172,0.9)"
              : "rgba(147,197,253,0.7)",
          }}
          data-testid="text-import-progress"
        >
          {doneCount} / {totalRows} spracovaných
        </div>
      </div>

      {/* Body: two columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Detail zmluvy + status form */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: "45%", borderRight: "1px solid #1B263B" }}
        >
          {/* Section title */}
          <div
            className="px-4 py-2 shrink-0 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "rgba(134,239,172,0.4)" }}>
              Detail zmluvy
            </span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            {/* Empty state */}
            {selectedRowIndex === null && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Search className="w-10 h-10" style={{ color: "rgba(148,163,184,0.15)" }} />
                <p className="text-sm text-center" style={{ color: "rgba(148,163,184,0.35)" }}>
                  Vyberte riadok z pravého zoznamu.
                </p>
              </div>
            )}

            {/* Loading state */}
            {currentRowState === "loading" && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "rgba(59,130,246,0.5)" }} />
                <p className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>Hľadám zmluvu...</p>
              </div>
            )}

            {/* Not found state */}
            {currentRowState === "not-found" && (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                <AlertTriangle className="w-10 h-10" style={{ color: "rgba(239,68,68,0.5)" }} />
                <p className="text-sm text-center font-semibold" style={{ color: "rgba(252,165,165,0.8)" }}>
                  Zmluva s identifikátorom „{currentIdentifier}" nebola nájdená v systéme.
                </p>
                <p className="text-xs text-center" style={{ color: "rgba(148,163,184,0.35)" }}>
                  Skontrolujte správnosť čísla v Excel súbore.
                </p>
              </div>
            )}

            {/* Found / error state — show contract detail and form */}
            {(currentRowState === "found" || currentRowState === "done" || currentRowState === "error") && currentContract && (
              <div className="flex flex-col gap-4">

                {/* Contract info block */}
                <div
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{ border: "1px solid #1B263B", background: "rgba(255,255,255,0.02)" }}
                >
                  {/* Identifikátor */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "rgba(148,163,184,0.4)" }}>
                      Identifikátor
                    </span>
                    <span className="text-sm font-bold font-mono" style={{ color: "rgba(226,232,240,0.9)" }} data-testid="text-contract-uid">
                      {currentContract.uid ? formatUid(currentContract.uid) : (currentIdentifier ?? "—")}
                    </span>
                  </div>

                  {/* Aktuálny stav */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "rgba(148,163,184,0.4)" }}>
                      Aktuálny stav
                    </span>
                    <div className="flex items-center gap-1.5">
                      {currentContract.statusColor && (
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentContract.statusColor }} />
                      )}
                      <span className="text-xs font-medium" style={{ color: "rgba(203,213,225,0.8)" }}>
                        {currentContract.statusName ?? "—"}
                      </span>
                    </div>
                  </div>

                  {/* Klient */}
                  {currentContract.subjectName && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "rgba(148,163,184,0.4)" }}>
                        Klient
                      </span>
                      <span className="text-xs font-medium" style={{ color: "rgba(203,213,225,0.8)" }}>
                        {currentContract.subjectName}
                      </span>
                    </div>
                  )}

                  {/* Navrhovaný stav (from Excel) */}
                  {currentStatusValue && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "rgba(148,163,184,0.4)" }}>
                        Navrhovaný stav
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(245,158,11,0.1)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          color: "rgba(251,191,36,0.8)",
                        }}
                      >
                        {currentStatusValue}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status assignment form */}
                {currentRowState !== "done" && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "rgba(148,163,184,0.4)" }}>
                      Priradenie stavu
                    </div>

                    {/* Status selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold" style={{ color: "rgba(148,163,184,0.5)" }}>
                        Nový stav zmluvy {!newStatusId && <span style={{ color: "rgba(239,68,68,0.7)" }}>*</span>}
                      </label>
                      <select
                        value={newStatusId}
                        onChange={e => { setNewStatusId(e.target.value); setParamValues({}); }}
                        data-testid="select-new-status"
                        style={{ ...inputStyle, background: "#0d1c2e" }}
                      >
                        <option value="">— vybrať stav —</option>
                        {allStatuses.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status parameters */}
                    {statusParams.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {statusParams.map(param => (
                          <div key={param.id} className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold" style={{ color: "rgba(148,163,184,0.5)" }}>
                              {param.name}
                              {param.isRequired && <span style={{ color: "rgba(239,68,68,0.7)" }}> *</span>}
                            </label>
                            {renderParamInput(param)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold" style={{ color: "rgba(148,163,184,0.5)" }}>
                        Dátum zmeny
                      </label>
                      <input
                        type="date"
                        value={changedAt}
                        onChange={e => setChangedAt(e.target.value)}
                        data-testid="input-changed-at"
                        style={inputStyle}
                      />
                    </div>

                    {/* Note */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold" style={{ color: "rgba(148,163,184,0.5)" }}>
                        Poznámka
                      </label>
                      <textarea
                        value={statusNote}
                        onChange={e => setStatusNote(e.target.value)}
                        rows={2}
                        data-testid="textarea-status-note"
                        placeholder="Voliteľná poznámka..."
                        style={{
                          ...inputStyle,
                          resize: "none",
                          fontFamily: "inherit",
                          lineHeight: 1.5,
                        }}
                      />
                    </div>

                    {/* Confirm button */}
                    <button
                      type="button"
                      disabled={!newStatusId || isSubmitting}
                      onClick={handleConfirm}
                      data-testid="button-potvrdit"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: !newStatusId || isSubmitting
                          ? "rgba(34,197,94,0.06)"
                          : "rgba(34,197,94,0.18)",
                        border: "1.5px solid rgba(34,197,94,0.4)",
                        color: !newStatusId || isSubmitting
                          ? "rgba(134,239,172,0.35)"
                          : "rgba(134,239,172,0.9)",
                        cursor: !newStatusId || isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: newStatusId && !isSubmitting ? "0 0 16px rgba(34,197,94,0.12)" : "none",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isSubmitting ? "Ukladám..." : "Potvrdiť"}
                    </button>
                  </div>
                )}

                {/* Done state: already processed */}
                {currentRowState === "done" && (
                  <div
                    className="flex flex-col items-center gap-3 py-4 rounded-xl"
                    style={{ border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.05)" }}
                  >
                    <CheckCircle2 className="w-8 h-8" style={{ color: "rgba(134,239,172,0.7)" }} />
                    <p className="text-sm font-semibold" style={{ color: "rgba(134,239,172,0.8)" }}>
                      Stav bol priradený
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Riadky importu */}
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Section title */}
          <div
            className="px-4 py-2 shrink-0 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "rgba(147,197,253,0.4)" }}>
              Riadky importu
            </span>
            <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.25)" }}>
              · {totalRows} {totalRows === 1 ? "riadok" : totalRows < 5 ? "riadky" : "riadkov"}
            </span>
          </div>

          <div ref={rowListRef} className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-2">
            {rowItems.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.3)" }}>Žiadne riadky</p>
              </div>
            )}
            {rowItems.map(({ index, identifierValue, statusValue }) => {
              const state = rowStates[index] ?? "pending";
              const isSelected = selectedRowIndex === index;
              const isDone = state === "done";
              const isNotFound = state === "not-found";

              let borderColor = "rgba(27,38,59,0.8)";
              if (isSelected) borderColor = "rgba(34,197,94,0.4)";
              else if (isNotFound || state === "error") borderColor = "rgba(239,68,68,0.25)";
              else if (isDone) borderColor = "rgba(34,197,94,0.2)";

              return (
                <div
                  key={index}
                  data-row-index={index}
                  data-testid={`row-import-${index}`}
                  onClick={() => selectRow(index)}
                  className="rounded-xl p-3 cursor-pointer transition-all duration-150 select-none"
                  style={{
                    background: isSelected
                      ? "rgba(34,197,94,0.06)"
                      : isDone
                      ? "rgba(255,255,255,0.01)"
                      : isNotFound
                      ? "rgba(239,68,68,0.04)"
                      : "rgba(255,255,255,0.025)",
                    border: `1.5px solid ${borderColor}`,
                    boxShadow: isSelected ? "0 0 16px rgba(34,197,94,0.08)" : "none",
                    opacity: isDone ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[9px] font-mono"
                          style={{ color: "rgba(148,163,184,0.3)" }}
                        >
                          #{index + 1}
                        </span>
                      </div>
                      <div
                        className="text-sm font-bold leading-tight truncate"
                        style={{ color: isDone ? "rgba(134,239,172,0.5)" : "rgba(226,232,240,0.9)" }}
                        data-testid={`text-row-identifier-${index}`}
                      >
                        {identifierValue || <span style={{ color: "rgba(148,163,184,0.3)" }}>—</span>}
                      </div>
                      {statusValue && (
                        <div
                          className="text-[10px] mt-0.5 truncate"
                          style={{ color: "rgba(148,163,184,0.45)" }}
                          data-testid={`text-row-status-${index}`}
                        >
                          {statusValue}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <RowBadge state={state} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
