import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  UserPlus, User, Briefcase, Building2, Landmark, Network, Library,
  Loader2, CheckCircle2, AlertTriangle, ExternalLink, ChevronRight,
} from "lucide-react";
import { useAppUser } from "@/hooks/use-app-user";
import { apiRequest } from "@/lib/queryClient";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import { formatUid } from "@/lib/utils";

type SubjectType = "person" | "szco" | "company" | "organization" | "state" | "os";

const SUBJECT_TYPE_OPTS: Array<{
  val: SubjectType;
  label: string;
  shortLabel: string;
  icon: typeof User;
  clientTypeCode: string;
  baseParam: "rc" | "ico" | "id";
  bubbleTitle: string;
  bubbleDesc: string;
  bubbleSteps: string[];
}> = [
  {
    val: "person",
    label: "Fyzické osoby (FO)",
    shortLabel: "FO",
    icon: User,
    clientTypeCode: "FO",
    baseParam: "rc",
    bubbleTitle: "Registrácia fyzickej osoby (FO)",
    bubbleDesc: "Fyzická osoba je občan, ktorý nie je podnikateľom. Do tejto kategórie patria všetci bežní klienti — napríklad poistenci, sporiteľia alebo dlžníci.",
    bubbleSteps: [
      "Zadajte rodné číslo klienta — systém overí, či subjekt už existuje.",
      "Vyberte krajinu registrácie (najčastejšie Slovensko).",
      "Vyplňte osobné údaje: meno, adresu, kontakt a ďalšie povinné polia.",
      "Uložte záznam — klient sa objaví v Zozname klientov.",
    ],
  },
  {
    val: "szco",
    label: "Živnostníci (SZČO)",
    shortLabel: "SZČO",
    icon: Briefcase,
    clientTypeCode: "SZCO",
    baseParam: "ico",
    bubbleTitle: "Registrácia živnostníka (SZČO)",
    bubbleDesc: "Samostatne zárobkovo činná osoba (živnostník) podniká na vlastné meno. Registrujte sem všetkých klientov s platným živnostenským listom.",
    bubbleSteps: [
      "Zadajte IČO živnostníka — systém overí duplicitu a príp. doplní údaje z registra.",
      "Vyberte krajinu registrácie.",
      "Vyplňte obchodné meno, miesto podnikania, kontaktné údaje a ďalšie povinné polia.",
      "Uložte záznam — živnostník sa objaví v Zozname klientov.",
    ],
  },
  {
    val: "company",
    label: "Súkromný sektor (PO)",
    shortLabel: "PO",
    icon: Building2,
    clientTypeCode: "PO",
    baseParam: "ico",
    bubbleTitle: "Registrácia právnickej osoby — súkromný sektor (PO)",
    bubbleDesc: "Právnická osoba v súkromnom sektore — s.r.o., a.s., k.s. a iné obchodné spoločnosti zapísané v Obchodnom registri SR.",
    bubbleSteps: [
      "Zadajte IČO spoločnosti — systém overí duplicitu a príp. načíta údaje z ARES / OR.",
      "Vyberte krajinu sídla.",
      "Vyplňte obchodné meno, sídlo, konateľov a ďalšie povinné polia.",
      "Uložte záznam — spoločnosť sa objaví v Zozname klientov.",
    ],
  },
  {
    val: "organization",
    label: "Tretí sektor (TS)",
    shortLabel: "TS",
    icon: Network,
    clientTypeCode: "NS",
    baseParam: "ico",
    bubbleTitle: "Registrácia subjektu tretieho sektora (TS)",
    bubbleDesc: "Neziskové organizácie, nadácie, občianske združenia a iné subjekty tretieho sektora, ktoré nie sú štátne ani komerčné.",
    bubbleSteps: [
      "Zadajte IČO organizácie — systém overí duplicitu.",
      "Vyberte krajinu registrácie.",
      "Vyplňte názov, sídlo, typ organizácie a ďalšie povinné polia.",
      "Uložte záznam — organizácia sa objaví v Zozname klientov.",
    ],
  },
  {
    val: "state",
    label: "Verejný sektor (VS)",
    shortLabel: "VS",
    icon: Landmark,
    clientTypeCode: "VS",
    baseParam: "ico",
    bubbleTitle: "Registrácia subjektu verejného sektora (VS)",
    bubbleDesc: "Štátne inštitúcie, ministerstvá, školy, nemocnice, obce, mestá a ďalšie organizácie financované z verejných zdrojov.",
    bubbleSteps: [
      "Zadajte IČO inštitúcie — systém overí duplicitu.",
      "Vyberte krajinu registrácie.",
      "Vyplňte názov, sídlo, typ inštitúcie a ďalšie povinné polia.",
      "Uložte záznam — inštitúcia sa objaví v Zozname klientov.",
    ],
  },
  {
    val: "os",
    label: "Ostatné subjekty (OS)",
    shortLabel: "OS",
    icon: Library,
    clientTypeCode: "OS",
    baseParam: "id",
    bubbleTitle: "Registrácia ostatného subjektu (OS)",
    bubbleDesc: "Sem patria subjekty, ktoré nespadajú do žiadnej z predchádzajúcich kategórií — napríklad cirkvi, náboženské spoločnosti, politické strany a iné špecifické organizácie.",
    bubbleSteps: [
      "Zadajte identifikátor subjektu — systém overí duplicitu.",
      "Vyberte krajinu registrácie.",
      "Vyplňte názov, sídlo a ďalšie povinné polia.",
      "Uložte záznam — subjekt sa objaví v Zozname klientov.",
    ],
  },
];

type AresLookup = {
  found: boolean;
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  source?: string;
  directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[];
  message?: string;
};

type DuplicateInfo = {
  name: string;
  uid: string;
  id: number;
  matchedField?: string;
  managerName?: string | null;
  managerId?: number | null;
  isBlacklisted?: boolean;
  blacklistMessage?: string;
};

function SubjectTypeSlider({
  value,
  onChange,
}: {
  value: SubjectType;
  onChange: (v: SubjectType) => void;
}) {
  const n = SUBJECT_TYPE_OPTS.length;
  const activeIdx = SUBJECT_TYPE_OPTS.findIndex(o => o.val === value);

  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % n; }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx + n - 1) % n; }
    if (next >= 0) {
      onChange(SUBJECT_TYPE_OPTS[next].val);
      const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
      (btns?.[next] as HTMLElement)?.focus();
    }
  };

  return (
    <div
      className="relative w-full flex p-0.5 bg-muted/40 rounded border border-border/60"
      role="radiogroup"
      aria-label="Typ subjektu"
      data-testid="toggle-subject-type-aaa"
    >
      <div
        className="absolute top-0.5 bottom-0.5 rounded bg-background shadow border border-border/50 transition-all duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          left: `calc(2px + ${activeIdx >= 0 ? activeIdx : 0} * (100% - 4px) / ${n})`,
        }}
      />
      {SUBJECT_TYPE_OPTS.map((opt, idx) => {
        const Icon = opt.icon;
        const isActive = value === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            title={opt.label}
            className={`relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium rounded transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
            onClick={() => onChange(opt.val)}
            onKeyDown={(e) => handleKey(e, idx)}
            data-testid={`toggle-subject-type-aaa-${opt.val}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-center leading-tight">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InlineRegistrationRow({
  opt,
  onProceed,
  onViewSubject,
}: {
  opt: typeof SUBJECT_TYPE_OPTS[0];
  onProceed: (data: { clientTypeCode: string; stateId: number; baseValue: string; aresData?: AresLookup }) => void;
  onViewSubject: (id: number) => void;
}) {
  const { data: appUser } = useAppUser();
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [icoError, setIcoError] = useState<string | null>(null);
  const [aresLookup, setAresLookup] = useState<AresLookup | null>(null);
  const [aresLoading, setAresLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const proceedRef = useRef<HTMLButtonElement>(null);

  const isRc = opt.baseParam === "rc";
  const isIco = opt.baseParam === "ico";
  const isId = opt.baseParam === "id";

  const inputLabel = isRc ? "Rodné číslo" : isIco ? "IČO" : "Identifikátor";
  const inputPlaceholder = isRc ? "napr. 900101/1234" : isIco ? "napr. 12345678" : "Číslo registrácie / ID...";

  useEffect(() => {
    setValue("");
    setDuplicateInfo(null);
    setDuplicateChecked(false);
    setRcError(null);
    setIcoError(null);
    setAresLookup(null);
    setAresLoading(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [opt.val]);

  const performDuplicateCheck = useCallback(async (val: string) => {
    if (!val.trim()) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      return;
    }
    setChecking(true);
    try {
      const trimmed = val.trim();
      const res = await apiRequest("POST", "/api/subjects/check-duplicate", { birthNumber: trimmed, ico: trimmed });
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateInfo({
          name: data.subject.name,
          uid: data.subject.uid,
          id: data.subject.id,
          matchedField: data.subject.matchedField,
          managerName: data.managerName,
          managerId: data.managerId,
          isBlacklisted: data.isBlacklisted,
          blacklistMessage: data.message,
        });
      } else {
        setDuplicateInfo(null);
        setTimeout(() => proceedRef.current?.focus(), 50);
      }
      setDuplicateChecked(true);
    } catch {
      setDuplicateInfo(null);
      setDuplicateChecked(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      setRcError(null);
      setIcoError(null);
      setAresLookup(null);
      return;
    }

    if (isRc) {
      setIcoError(null);
      setAresLookup(null);
      const digits = value.replace(/[^0-9]/g, "");
      if (digits.length < 9) {
        setRcError(null);
        setDuplicateChecked(false);
        return;
      }
      const result = validateSlovakRC(value);
      if (!result.valid) {
        setRcError(result.error || "Neplatné rodné číslo");
        setDuplicateChecked(false);
        return;
      }
      setRcError(null);
      performDuplicateCheck(value);
    } else if (isId) {
      setRcError(null);
      setIcoError(null);
      setAresLookup(null);
      setDuplicateChecked(false);
      debounceRef.current = setTimeout(() => performDuplicateCheck(value), 500);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    } else if (isIco) {
      setRcError(null);
      const digits = value.replace(/[\s\/-]/g, "");
      if (digits.length < 1) {
        setIcoError(null);
        setDuplicateChecked(false);
        setAresLookup(null);
        return;
      }
      const result = validateSlovakICO(value);
      if (!result.valid) {
        setIcoError(result.error || "Neplatné IČO");
        setDuplicateChecked(false);
        setAresLookup(null);
        return;
      }
      setIcoError(null);
      performDuplicateCheck(value);
      setAresLoading(true);
      const normalizedIco = result.normalized || digits;
      const lookupType = opt.clientTypeCode === "SZCO" ? "szco" : "company";
      fetch(`/api/lookup/ico/${encodeURIComponent(normalizedIco)}?type=${lookupType}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.found) {
            setAresLookup(data);
          } else {
            setAresLookup({ found: false, message: data.message || "Subjekt nenájdený v štátnych registroch" });
          }
        })
        .catch(() => setAresLookup({ found: false, message: "Chyba pri vyhľadávaní v registroch" }))
        .finally(() => setAresLoading(false));
    }
  }, [value, isRc, isIco, isId, opt.clientTypeCode, performDuplicateCheck]);

  const canProceed = !!(appUser?.activeStateId && value.trim() && duplicateChecked && !duplicateInfo && !rcError && !icoError);

  function handleProceed() {
    if (!canProceed) return;
    onProceed({
      clientTypeCode: opt.clientTypeCode,
      stateId: appUser?.activeStateId || 0,
      baseValue: value.trim(),
      aresData: aresLookup?.found ? aresLookup : undefined,
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background p-4 shadow-sm" data-testid="inline-registration-row">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" htmlFor="inline-reg-input">
          {inputLabel}
        </label>
      </div>

      <div className="relative">
        <input
          id="inline-reg-input"
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && canProceed && !checking) handleProceed(); }}
          placeholder={inputPlaceholder}
          autoComplete="off"
          data-testid="input-inline-reg-value"
          className={`w-full rounded-md border px-3 py-2 text-sm bg-background outline-none transition-colors pr-9
            ${rcError || icoError
              ? "border-red-500 focus:border-red-500"
              : "border-border focus:border-primary"}`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {(checking || aresLoading) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!checking && !aresLoading && (rcError || icoError) && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {!checking && !aresLoading && duplicateChecked && !duplicateInfo && !rcError && !icoError && value.trim() && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>
      </div>

      {rcError && (
        <p className="text-xs text-red-500 mt-1.5" data-testid="text-rc-error">{rcError}</p>
      )}
      {icoError && (
        <p className="text-xs text-red-500 mt-1.5" data-testid="text-ico-error">{icoError}</p>
      )}

      {aresLoading && (
        <div className="flex items-center gap-2 mt-2" data-testid="text-registry-loading">
          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
          <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
        </div>
      )}

      {aresLookup?.found && (
        <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-md p-3 space-y-1" data-testid="ares-lookup-result">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-blue-400">
                {aresLookup.source === "ORSR" ? "Obchodný register SR" : aresLookup.source === "ZRSR" ? "Živnostenský register SR" : "Register"}
              </span>
            </div>
          </div>
          {aresLookup.name && <p className="text-sm font-medium">{aresLookup.name}</p>}
          {(aresLookup.street || aresLookup.city) && (
            <p className="text-xs text-muted-foreground">
              {[aresLookup.street, aresLookup.streetNumber].filter(Boolean).join(" ")}
              {(aresLookup.street || aresLookup.streetNumber) && (aresLookup.zip || aresLookup.city) ? ", " : ""}
              {[aresLookup.zip, aresLookup.city].filter(Boolean).join(" ")}
            </p>
          )}
          {aresLookup.legalForm && (
            <p className="text-[10px] text-muted-foreground">
              {aresLookup.legalForm}{aresLookup.dic ? ` | DIČ: ${aresLookup.dic}` : ""}
            </p>
          )}
          {aresLookup.directors && aresLookup.directors.length > 0 && (
            <div className="mt-1 pt-1 border-t border-blue-500/20">
              <p className="text-[10px] font-semibold text-blue-400/80 mb-0.5">Štatutári / Konatelia:</p>
              {aresLookup.directors.slice(0, 5).map((dir, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  {[dir.titleBefore, dir.firstName, dir.lastName, dir.titleAfter].filter(Boolean).join(" ") || dir.name}
                  {dir.role ? <span className="text-[9px] text-blue-400/60 ml-1">({dir.role})</span> : null}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {aresLookup && !aresLookup.found && !icoError && (
        <p className="text-xs text-muted-foreground mt-2">{aresLookup.message}</p>
      )}

      {duplicateInfo && (
        <div className={`mt-3 border rounded-md p-3 space-y-2 ${duplicateInfo.isBlacklisted ? "bg-red-900/20 border-red-500/50" : "bg-destructive/10 border-destructive/30"}`} data-testid="duplicate-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${duplicateInfo.isBlacklisted ? "text-red-500" : "text-destructive"}`} />
            <span className={`text-sm font-semibold ${duplicateInfo.isBlacklisted ? "text-red-500" : "text-destructive"}`}>
              {duplicateInfo.isBlacklisted ? "Registráciu nie je možné dokončiť" : "Klient už existuje"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {duplicateInfo.name}{" "}
            <span className="font-mono text-xs">[ {formatUid(duplicateInfo.uid)} ]</span>
            {duplicateInfo.matchedField && (
              <span className="text-xs ml-1">(zhoda: {duplicateInfo.matchedField})</span>
            )}
          </p>
          {duplicateInfo.isBlacklisted && (
            <p className="text-xs text-red-400 font-medium" data-testid="text-blacklist-message">{duplicateInfo.blacklistMessage}</p>
          )}
          {duplicateInfo.managerName && !duplicateInfo.isBlacklisted && (
            <p className="text-xs text-muted-foreground" data-testid="text-duplicate-manager">
              Správca: <span className="font-semibold text-foreground">{duplicateInfo.managerName}</span>
            </p>
          )}
          {!duplicateInfo.isBlacklisted && (
            <button
              type="button"
              onClick={() => onViewSubject(duplicateInfo.id)}
              className="flex items-center gap-1.5 text-xs border border-border rounded px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
              data-testid="button-go-to-client"
            >
              <ExternalLink className="w-3 h-3" />
              Prejsť na kartu klienta
            </button>
          )}
        </div>
      )}

      {canProceed && !checking && (
        <button
          ref={proceedRef}
          type="button"
          onClick={handleProceed}
          data-testid="button-continue-reg"
          className="mt-3 flex items-center gap-2 w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
        >
          Pokračovať
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function SubjectInfoBubble({ opt }: { opt: typeof SUBJECT_TYPE_OPTS[0] }) {
  const Icon = opt.icon;
  return (
    <div
      className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-5 shadow-sm"
      data-testid="bubble-subject-info"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold leading-tight">{opt.bubbleTitle}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {opt.bubbleDesc}
      </p>
      <ol className="space-y-2">
        {opt.bubbleSteps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-muted-foreground leading-snug">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AddPartnerHexButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: -18, paddingBottom: 4 }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        data-testid="button-add-partner-aaa"
        title="Pridať nový subjekt"
        style={{
          position: "relative",
          width: 280,
          height: 80,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          outline: "none",
          userSelect: "none",
          transition: "transform 0.15s ease, filter 0.25s ease",
          transform: pressed ? "scale(0.96)" : hovered ? "scale(1.05)" : "scale(1)",
          filter: isActive
            ? "drop-shadow(0 0 10px rgba(0,220,60,0.55)) drop-shadow(0 0 22px rgba(0,220,60,0.25))"
            : "drop-shadow(0 0 10px rgba(56,189,248,0.50))",
        }}
      >
        <svg
          width="280"
          height="80"
          viewBox="0 0 280 80"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="glowAaaRest" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="10" result="blur" />
            </filter>
            <filter id="glowAaaHover" x="-40%" y="-80%" width="180%" height="260%">
              <feGaussianBlur stdDeviation="14" result="blur" />
            </filter>
            <linearGradient id="hexGradAaa" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          <rect
            x="8" y="8" width="264" height="64" rx="24"
            fill={isActive ? "rgba(0,255,60,1.0)" : "rgba(56,189,248,0.45)"}
            filter={isActive ? "url(#glowAaaHover)" : "url(#glowAaaRest)"}
            style={{ transition: "fill 0.2s ease" }}
          />
          {isActive && (
            <rect
              x="8" y="8" width="264" height="64" rx="24"
              fill="rgba(0,220,60,0.25)"
              filter="url(#glowAaaHover)"
            />
          )}
          <rect
            x="1" y="1" width="278" height="78" rx="28"
            fill="url(#hexGradAaa)"
            stroke={isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="2"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
        }}>
          <div style={{ width: 93, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserPlus
              size={28}
              strokeWidth={1.4}
              style={{
                color: "#FFBF00",
                filter: `drop-shadow(0 0 7px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
                transition: "filter 0.15s ease",
              }}
            />
          </div>
          <div style={{
            width: 3,
            margin: "12px 0",
            borderRadius: 2,
            background: isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)",
            transition: "background 0.15s ease",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{
              fontFamily: "sans-serif",
              fontSize: 12,
              fontWeight: 800,
              color: "#b8d0f0",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}>
              Pridať subjekt
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function Aaa() {
  const [, navigate] = useLocation();
  const [subjectType, setSubjectType] = useState<SubjectType>("person");
  const [sliderVisible, setSliderVisible] = useState(false);

  const selectedOpt = SUBJECT_TYPE_OPTS.find(o => o.val === subjectType)!;

  function handleButtonClick() {
    setSliderVisible(true);
  }

  function handleProceed(data: { clientTypeCode: string; stateId: number; baseValue: string; aresData?: AresLookup }) {
    try {
      sessionStorage.setItem("pridat_subjekt_data", JSON.stringify(data));
    } catch {}
    navigate("/pridat-subjekt");
  }

  function handleViewSubject(id: number) {
    navigate(`/subjekty/${id}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2" data-testid="text-aaa-title">
        Pridať subjekt
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Toto okno slúži na registráciu nového subjektu.
      </p>

      <AddPartnerHexButton onClick={handleButtonClick} />

      {sliderVisible && (
        <>
          <div className="mt-6">
            <SubjectTypeSlider value={subjectType} onChange={setSubjectType} />
          </div>
          <InlineRegistrationRow
            opt={selectedOpt}
            onProceed={handleProceed}
            onViewSubject={handleViewSubject}
          />
        </>
      )}

      <SubjectInfoBubble opt={selectedOpt} />
    </div>
  );
}
