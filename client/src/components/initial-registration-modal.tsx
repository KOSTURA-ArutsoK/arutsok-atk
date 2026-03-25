import { useState, useRef, useEffect, useCallback } from "react";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatUid } from "@/lib/utils";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import type { ClientType } from "@shared/schema";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Building2 } from "lucide-react";

export type AresData = {
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  source?: string;
  directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[];
};

export type ProceedData = {
  clientTypeCode: string;
  stateId: number;
  baseValue: string;
  aresData?: AresData;
};

export function InitialRegistrationModal({
  open,
  onOpenChange,
  onProceed,
  onViewSubject,
  initialType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: (data: ProceedData) => void;
  onViewSubject: (id: number) => void;
  initialType?: string;
}) {
  const { data: appUser } = useAppUser();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const [selectedType, setSelectedType] = useState(initialType || "");

  useEffect(() => {
    if (open && initialType) setSelectedType(initialType);
  }, [open, initialType]);
  const [baseValue, setBaseValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; uid: string; id: number; matchedField?: string; managerName?: string | null; managerId?: number | null; isBlacklisted?: boolean; blacklistMessage?: string } | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [icoError, setIcoError] = useState<string | null>(null);
  const [aresLookup, setAresLookup] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[]; found: boolean; message?: string } | null>(null);
  const [aresLoading, setAresLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);
  const proceedBtnRef = useRef<HTMLButtonElement>(null);

  const selectedClientType = clientTypes?.find(ct => ct.code === selectedType);
  const isOs = selectedClientType?.code === "OS";
  const baseParamLabel = isOs ? "Identifikátor" : selectedClientType?.baseParameter === "ico" ? "ICO" : "Rodne cislo (RC)";

  const performDuplicateCheck = useCallback(async (value: string, _paramType: string | undefined) => {
    if (!value.trim()) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      return;
    }
    setChecking(true);
    try {
      const trimmed = value.trim();
      const body = { birthNumber: trimmed, ico: trimmed };
      const res = await apiRequest("POST", "/api/subjects/check-duplicate", body);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateInfo({ name: data.subject.name, uid: data.subject.uid, id: data.subject.id, matchedField: data.subject.matchedField, managerName: data.managerName, managerId: data.managerId, isBlacklisted: data.isBlacklisted, blacklistMessage: data.message });
      } else {
        setDuplicateInfo(null);
      }
      setDuplicateChecked(true);
      if (!data.isDuplicate) {
        setTimeout(() => proceedBtnRef.current?.focus(), 50);
      }
    } catch {
      setDuplicateInfo(null);
      setDuplicateChecked(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!baseValue.trim() || !selectedType) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      setRcError(null);
      setIcoError(null);
      setAresLookup(null);
      return;
    }
    const isRc = selectedClientType?.baseParameter === "rc";
    const isIco = selectedClientType?.baseParameter === "ico";
    const isOsType = selectedClientType?.code === "OS";
    if (isRc) {
      setIcoError(null);
      setAresLookup(null);
      const digitsOnly = baseValue.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 9) {
        setDuplicateChecked(false);
        setRcError(null);
        return;
      }
      const result = validateSlovakRC(baseValue);
      if (!result.valid) {
        setRcError(result.error || "Neplatné rodné číslo");
        setDuplicateChecked(false);
        return;
      }
      setRcError(null);
      performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
    } else if (isOsType) {
      setRcError(null);
      setIcoError(null);
      setAresLookup(null);
      if (baseValue.trim().length < 1) {
        setDuplicateChecked(false);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDuplicateChecked(false);
      debounceRef.current = setTimeout(() => {
        performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
      }, 500);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    } else if (isIco) {
      setRcError(null);
      const digitsOnly = baseValue.replace(/[\s\/-]/g, "");
      if (digitsOnly.length < 1) {
        setDuplicateChecked(false);
        setIcoError(null);
        setAresLookup(null);
        return;
      }
      const icoResult = validateSlovakICO(baseValue);
      if (!icoResult.valid) {
        setIcoError(icoResult.error || "Neplatné IČO");
        setDuplicateChecked(false);
        setAresLookup(null);
        return;
      }
      setIcoError(null);
      performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
      setAresLoading(true);
      const normalizedIco = icoResult.normalized || digitsOnly;
      const lookupType = selectedType.toLowerCase().includes("szco") ? "szco" : "company";
      fetch(`/api/lookup/ico/${encodeURIComponent(normalizedIco)}?type=${lookupType}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.found) {
            setAresLookup(data);
          } else {
            setAresLookup({ found: false, message: data.message || "Subjekt nenájdený v štátnych registroch" });
          }
        })
        .catch(() => {
          setAresLookup({ found: false, message: "Chyba pri vyhľadávaní v registroch" });
        })
        .finally(() => setAresLoading(false));
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDuplicateChecked(false);
      debounceRef.current = setTimeout(() => {
        performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
      }, 500);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }
  }, [baseValue, selectedType, selectedClientType?.baseParameter, performDuplicateCheck]);

  function handleProceed() {
    if (duplicateInfo) return;
    onProceed({
      clientTypeCode: selectedType,
      stateId: appUser?.activeStateId || 0,
      baseValue: baseValue.trim(),
      aresData: aresLookup?.found ? { name: aresLookup.name, street: aresLookup.street, streetNumber: aresLookup.streetNumber, zip: aresLookup.zip, city: aresLookup.city, legalForm: aresLookup.legalForm, dic: aresLookup.dic, source: aresLookup.source, directors: aresLookup.directors } : undefined,
    });
    setSelectedType("");
    setBaseValue("");
    setDuplicateInfo(null);
    setDuplicateChecked(false);
    setAresLookup(null);
  }

  const canProceed = selectedType && appUser?.activeStateId && baseValue.trim() && duplicateChecked && !duplicateInfo && !rcError && !icoError;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) { setDuplicateInfo(null); setDuplicateChecked(false); setBaseValue(""); setSelectedType(""); setIcoError(null); setAresLookup(null); }
      onOpenChange(o);
    }}>
      <DialogContent size="sm" className="flex flex-col items-stretch justify-start">
        <DialogHeader>
          <DialogTitle>Registracia noveho klienta</DialogTitle>
          <DialogDescription>
            Vyberte typ klienta, stat a zadajte zakladny identifikator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Typ klienta</Label>
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setDuplicateInfo(null); setTimeout(() => baseInputRef.current?.focus(), 50); }}>
              <SelectTrigger data-testid="select-client-type">
                <SelectValue placeholder="Vyberte typ" />
              </SelectTrigger>
              <SelectContent>
                {clientTypes?.filter(ct => ct.isActive).map(ct => (
                  <SelectItem key={ct.code} value={ct.code}>{ct.name} ({ct.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ display: selectedType ? 'block' : 'none' }}>
            <Label className="text-xs">{baseParamLabel}</Label>
            <div className="relative">
              <Input
                ref={baseInputRef}
                placeholder={isOs ? "Zadajte identifikátor (číslo registrácie / ID)..." : selectedClientType?.baseParameter === "ico" ? "napr. 12345678" : "napr. 900101/1234"}
                value={baseValue}
                onChange={(e) => {
                  setBaseValue(e.target.value);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canProceed && !checking) handleProceed(); }}
                className={(rcError || icoError) ? "border-red-500 focus-visible:ring-red-500" : ""}
                data-testid="input-base-parameter"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (checking || aresLoading) ? 'block' : 'none' }}>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (!checking && !aresLoading && duplicateChecked && !duplicateInfo && baseValue.trim() && !rcError && !icoError) ? 'block' : 'none' }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (rcError || icoError) ? 'block' : 'none' }}>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            </div>
            {rcError && (
              <p className="text-xs text-red-500 mt-1" data-testid="text-rc-error">{rcError}</p>
            )}
            {icoError && (
              <p className="text-xs text-red-500 mt-1" data-testid="text-ico-error">{icoError}</p>
            )}
            {aresLoading && (
              <div className="flex items-center gap-2 mt-1" data-testid="text-registry-loading">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
              </div>
            )}
            {aresLookup?.found && (
              <div className="mt-2 bg-blue-500/10 border border-blue-500/30 rounded-md p-3 space-y-1" data-testid="ares-lookup-result">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-blue-400">{aresLookup.source === "ORSR" ? "Obchodný register SR" : aresLookup.source === "ZRSR" ? "Živnostenský register SR" : "ARES Register"}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/20"
                    onClick={handleProceed}
                    disabled={!canProceed || checking}
                    data-testid="button-use-ares-data"
                  >
                    Použiť údaje
                  </Button>
                </div>
                {aresLookup.name && <p className="text-sm font-medium">{aresLookup.name}</p>}
                {(aresLookup.street || aresLookup.city) && (
                  <p className="text-xs text-muted-foreground">
                    {[aresLookup.street, aresLookup.streetNumber].filter(Boolean).join(" ")}
                    {(aresLookup.street || aresLookup.streetNumber) && (aresLookup.zip || aresLookup.city) ? ", " : ""}
                    {[aresLookup.zip, aresLookup.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {aresLookup.legalForm && <p className="text-[10px] text-muted-foreground">{aresLookup.legalForm}{aresLookup.dic ? ` | DIČ: ${aresLookup.dic}` : ""}</p>}
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
              <p className="text-xs text-muted-foreground mt-1">{aresLookup.message}</p>
            )}
          </div>

          <div style={{ display: duplicateInfo ? 'block' : 'none' }}>
            <div className={`${duplicateInfo?.isBlacklisted ? 'bg-red-900/20 border-red-500/50' : 'bg-destructive/10 border-destructive/30'} border rounded-md p-3 space-y-2`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${duplicateInfo?.isBlacklisted ? 'text-red-500' : 'text-destructive'}`} />
                <span className={`text-sm font-semibold ${duplicateInfo?.isBlacklisted ? 'text-red-500' : 'text-destructive'}`}>
                  {duplicateInfo?.isBlacklisted ? 'Registráciu nie je možné dokončiť' : 'Klient uz existuje'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {duplicateInfo?.name} <span className="font-mono text-xs">[ {formatUid(duplicateInfo?.uid)} ]</span>
                <span style={{ display: duplicateInfo?.matchedField ? 'inline' : 'none' }} className="text-xs ml-1">(zhoda: {duplicateInfo?.matchedField})</span>
              </p>
              {duplicateInfo?.isBlacklisted && (
                <p className="text-xs text-red-400 font-medium" data-testid="text-blacklist-message">{duplicateInfo.blacklistMessage}</p>
              )}
              {duplicateInfo?.managerName && !duplicateInfo?.isBlacklisted && (
                <p className="text-xs text-muted-foreground" data-testid="text-duplicate-manager">Správca: <span className="font-semibold text-foreground">{duplicateInfo.managerName}</span></p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {!duplicateInfo?.isBlacklisted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (duplicateInfo) {
                        onOpenChange(false);
                        onViewSubject(duplicateInfo.id);
                      }
                    }}
                    data-testid="button-go-to-client"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Prejst na kartu klienta
                  </Button>
                )}
                {duplicateInfo?.managerName && !duplicateInfo?.isBlacklisted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (duplicateInfo) {
                        onOpenChange(false);
                        onViewSubject(duplicateInfo.id);
                      }
                    }}
                    data-testid="button-contact-manager"
                  >
                    Kontaktovať správcu {duplicateInfo.managerName} o zdieľanie klienta
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-init-reg">
              Zrusit
            </Button>
            <Button
              ref={proceedBtnRef}
              onClick={handleProceed}
              disabled={!canProceed || checking}
              data-testid="button-continue-reg"
            >
              {checking ? "Overujem..." : "Pokracovat"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
