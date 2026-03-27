import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Link, Mail, MessageSquare, ArrowRight, RefreshCw, Loader2, UserCheck, Building2, Search, ShieldCheck, Users, Clock, X, Link2, FileText, CalendarClock, Archive } from "lucide-react";
import { formatDateSlovak } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

type ModalStep = "type_select" | "suggestions" | "form" | "otp" | "success" | "guardian_form" | "guardian_pending" | "guardian_manage" | "subject_form" | "subject_pending" | "subject_manage";

interface Suggestion {
  userId: number;
  firstName: string | null;
  lastName: string | null;
  maskedEmail: string;
  type: string | null;
  ico: string | null;
  uid: string | null;
}

interface GuardianPendingItem {
  linkId: number;
  targetName: string;
  targetEmail: string;
  status: string;
  createdAt: string;
  tokenExpired: boolean;
}

interface GuardianActiveItem {
  linkId: number;
  isGuardian: boolean;
  otherName: string;
  role: string;
  confirmedAt: string | null;
}

interface SubjectSearchResult {
  id: number;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  uid: string | null;
  ico: string | null;
}

interface SubjectLinkItem {
  linkId: number;
  subjectId: number;
  subjectName: string;
  subjectType: string | null;
  ico: string | null;
  uid: string | null;
  status: string;
  isActive: boolean;
  needsSms: boolean;
  createdAt: string;
  verifiedAt: string | null;
  tokenExpired: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isTemporallyExpired: boolean;
}

interface AccountLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function subjectTypeLabel(type: string | null): string {
  switch (type) {
    case "person": return "FO — Fyzická osoba";
    case "szco": return "SZČO";
    case "company": return "PO — Právnická osoba";
    case "mycompany": return "Vlastná firma";
    case "organization": return "TS — Tretí sektor";
    case "state": return "VS — Verejný sektor";
    case "os": return "OS — Osobitný subjekt";
    default: return "Neznámy typ";
  }
}

function isEntityType(type: string | null): boolean {
  return type !== "person" && type !== "szco" && type != null;
}

async function apiPost<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: payload !== undefined ? "POST" : "GET",
    headers: payload !== undefined ? { "Content-Type": "application/json" } : {},
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    let message = res.statusText || "Chyba servera";
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = res.statusText || "Chyba servera";
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function AccountLinkModal({ open, onClose, onSuccess }: AccountLinkModalProps) {
  const [step, setStep] = useState<ModalStep>("type_select");
  const [prevStep, setPrevStep] = useState<"suggestions" | "form">("suggestions");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [rc, setRc] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initiateResult, setInitiateResult] = useState<{
    method: "email" | "sms";
    maskedTarget: string;
    targetName: string;
    isReactivation: boolean;
  } | null>(null);
  const [guardianPendingResult, setGuardianPendingResult] = useState<{
    targetName: string;
    maskedTarget: string;
    linkId: number;
  } | null>(null);

  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectSearchResults, setSubjectSearchResults] = useState<SubjectSearchResult[]>([]);
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false);
  const [subjectPendingResult, setSubjectPendingResult] = useState<{
    linkId: number;
    subjectName: string;
    maskedEmail: string;
  } | null>(null);

  const guardianPendingQuery = useQuery<GuardianPendingItem[]>({
    queryKey: ["/api/account-link/guardian-pending"],
    enabled: open && step === "guardian_manage",
  });
  const guardianActiveQuery = useQuery<GuardianActiveItem[]>({
    queryKey: ["/api/account-link/guardian-list"],
    enabled: open && step === "guardian_manage",
  });
  const subjectLinkListQuery = useQuery<SubjectLinkItem[]>({
    queryKey: ["/api/account-link/subject-list"],
    enabled: open && step === "subject_manage",
  });

  useEffect(() => {
    if (open && !suggestionsLoaded && (step === "suggestions" || step === "form")) {
      loadSuggestions();
    }
  }, [open, step]);

  async function loadSuggestions() {
    setSuggestionsLoading(true);
    try {
      const data = await apiGet<Suggestion[]>("/api/account-link/suggestions");
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
      setSuggestionsLoaded(true);
    }
  }

  const resetForm = () => {
    setStep("type_select");
    setPrevStep("suggestions");
    setTargetEmail("");
    setRc("");
    setOtp("");
    setError(null);
    setInitiateResult(null);
    setGuardianPendingResult(null);
    setSubjectPendingResult(null);
    setSubjectSearch("");
    setSubjectSearchResults([]);
    setSuggestions([]);
    setSuggestionsLoaded(false);
  };

  async function handleSubjectSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectSearch.trim()) return;
    setError(null);
    setSubjectSearchLoading(true);
    try {
      const data = await apiGet<SubjectSearchResult[]>(`/api/subjects/search?q=${encodeURIComponent(subjectSearch.trim())}`);
      setSubjectSearchResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Chyba pri vyhľadávaní subjektov");
    } finally {
      setSubjectSearchLoading(false);
    }
  }

  async function handleSubjectInitiate(subjectId: number) {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ status: string; linkId: number; subjectName: string; maskedEmail: string }>(
        "/api/account-link/initiate",
        { subjectId, mode: "subject" }
      );
      setSubjectPendingResult({ linkId: data.linkId, subjectName: data.subjectName || "", maskedEmail: data.maskedEmail || "" });
      setStep("subject_pending");
    } catch (err: any) {
      setError(err?.message || "Chyba pri odosielaní žiadosti");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubjectRevoke(linkId: number) {
    setError(null);
    setLoading(true);
    try {
      await apiPost(`/api/subject-link/${linkId}/revoke`, { reason: "Zrušené používateľom" });
      queryClient.invalidateQueries({ queryKey: ["/api/account-link/subject-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
    } catch (err: any) {
      setError(err?.message || "Chyba pri rušení prepojenia");
    } finally {
      setLoading(false);
    }
  }

  const handleClose = () => {
    resetForm();
    onClose();
  };

  async function callInitiate(payload: { targetUserId: number } | { targetEmail: string; rc: string }, fromStep: "suggestions" | "form") {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ method: "email" | "sms"; maskedTarget: string; targetName: string; isReactivation: boolean }>(
        "/api/account-link/initiate",
        payload
      );
      setInitiateResult(data);
      setPrevStep(fromStep);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Chyba pri odosielaní žiadosti");
    } finally {
      setLoading(false);
    }
  }

  const handleSuggestionLink = async (suggestion: Suggestion) => {
    await callInitiate({ targetUserId: suggestion.userId }, "suggestions");
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) { setError("Zadajte email cieľového účtu"); return; }
    if (!rc.trim()) { setError("Zadajte vaše rodné číslo"); return; }
    await callInitiate({ targetEmail: targetEmail.trim(), rc: rc.trim() }, "form");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) { setError("OTP kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      await apiPost("/api/account-link/verify", { otp: otp.trim() });
      setStep("success");
    } catch (err: any) {
      setError(err?.message || "Nesprávny OTP kód");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    resetForm();
    onSuccess();
    onClose();
  };

  const goToManualForm = () => {
    setError(null);
    setStep("form");
  };

  const handleGuardianInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) { setError("Zadajte email cieľového účtu"); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ status: string; linkId: number; targetName: string; maskedTarget: string }>(
        "/api/account-link/initiate",
        { targetEmail: targetEmail.trim(), mode: "guardian" }
      );
      setGuardianPendingResult({ targetName: data.targetName || "", maskedTarget: data.maskedTarget || targetEmail.trim(), linkId: data.linkId });
      setStep("guardian_pending");
    } catch (err: any) {
      setError(err?.message || "Chyba pri odosielaní žiadosti");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (linkId: number) => {
    setError(null);
    setLoading(true);
    try {
      await apiPost(`/api/account-link/${linkId}/revoke`, { reason: "Zrušené používateľom" });
      queryClient.invalidateQueries({ queryKey: ["/api/account-link/guardian-pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account-link/guardian-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account-link/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
    } catch (err: any) {
      setError(err?.message || "Chyba pri rušení prepojenia");
    } finally {
      setLoading(false);
    }
  };

  const emptyAndLoaded = suggestionsLoaded && !suggestionsLoading && suggestions.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>

        {/* ── TYPE SELECT STEP ── */}
        {step === "type_select" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle>Správa prepojení</DialogTitle>
              <DialogDescription>
                Vyberte typ prepojenia alebo spravujte existujúce opatrovníctva.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setError(null); setStep("suggestions"); loadSuggestions(); }}
                data-testid="button-type-same-person"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Rovnaká osoba</p>
                  <p className="text-xs text-muted-foreground">Prepojte viacero prihlasovacích účtov patriacich vám</p>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setError(null); setTargetEmail(""); setStep("guardian_form"); }}
                data-testid="button-type-guardian"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Opatrovníctvo (správca)</p>
                  <p className="text-xs text-muted-foreground">Požiadajte o správu cudzieho účtu — vyžaduje súhlas cieľového používateľa</p>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setError(null); setStep("guardian_manage"); }}
                data-testid="button-type-guardian-manage"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Moje opatrovníctva</p>
                  <p className="text-xs text-muted-foreground">Prehľad čakajúcich a aktívnych opatrovníckych prepojení</p>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setError(null); setSubjectSearch(""); setSubjectSearchResults([]); setStep("subject_form"); }}
                data-testid="button-type-subject"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Prepojenie so subjektom</p>
                  <p className="text-xs text-muted-foreground">Prepojte váš účet s PO, FO, SZČO, VS, OS, TS — vyžaduje potvrdenie subjektu</p>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setError(null); setStep("subject_manage"); }}
                data-testid="button-type-subject-manage"
              >
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Moje subjekty</p>
                  <p className="text-xs text-muted-foreground">Prehľad a správa prepojení s evidovanými subjektmi</p>
                </div>
              </button>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose} data-testid="button-account-link-cancel">
              Zavrieť
            </Button>
          </>
        )}

        {/* ── SUGGESTIONS STEP ── */}
        {step === "suggestions" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle>Prepojiť ďalší účet</DialogTitle>
              <DialogDescription>
                Prepojte svoje kontexty — po prepojení môžete prepínať medzi nimi jedným klikom bez opakovaného prihlasovania.
              </DialogDescription>
            </DialogHeader>

            {suggestionsLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm" data-testid="suggestions-loading">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Hľadám dostupné účty...</span>
              </div>
            )}

            {suggestionsLoaded && !suggestionsLoading && suggestions.length > 0 && (
              <>
                <div className="space-y-2" data-testid="suggestions-list">
                  <p className="text-xs text-muted-foreground">Tieto účty patria rovnakej osobe a môžete ich prepojiť:</p>
                  {suggestions.map((s) => {
                    const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Neznámy";
                    const isEntity = isEntityType(s.type);
                    return (
                      <div
                        key={s.userId}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                        data-testid={`suggestion-item-${s.userId}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isEntity ? "bg-blue-100 dark:bg-blue-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                          {isEntity ? (
                            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {subjectTypeLabel(s.type)}
                            {s.ico && <span> — IČO:&nbsp;{s.ico}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{s.maskedEmail}</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => handleSuggestionLink(s)}
                          data-testid={`button-suggestion-link-${s.userId}`}
                        >
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Prepojiť"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="alert-suggestion-error">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-center transition-colors w-full"
                  onClick={goToManualForm}
                  data-testid="button-manual-form"
                >
                  Zadať email manuálne
                </button>
                <Button variant="outline" className="w-full" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-account-link-cancel">
                  Späť
                </Button>
              </>
            )}

            {emptyAndLoaded && (
              <>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground" data-testid="suggestions-empty">
                  <Search className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Neboli nájdené žiadne ďalšie účty pre vašu osobu. Môžete zadať email cieľového účtu manuálne.</span>
                </div>

                <form onSubmit={handleInitiate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="al-email">Email cieľového účtu</Label>
                    <Input
                      id="al-email"
                      type="email"
                      placeholder="email@priklad.sk"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      autoFocus
                      data-testid="input-account-link-email"
                    />
                    <p className="text-xs text-muted-foreground">Email prihlásenia do druhého účtu v systéme ATK</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="al-rc">Vaše rodné číslo</Label>
                    <Input
                      id="al-rc"
                      type="text"
                      placeholder="YYMMDD/XXXX"
                      value={rc}
                      onChange={(e) => setRc(e.target.value)}
                      data-testid="input-account-link-rc"
                    />
                    <p className="text-xs text-muted-foreground">Potvrdí, že oba kontexty patria vám. Nikde sa neukladá.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                    Potvrdením preberáte zodpovednosť za akcie vykonané v prepojenom kontexte.
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="alert-suggestion-error">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-account-link-cancel">
                      Späť
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={loading || !targetEmail.trim() || !rc.trim()}
                      data-testid="button-account-link-submit"
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      {loading ? "Overujem..." : "Odoslať OTP"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* ── MANUAL FORM STEP ── */}
        {step === "form" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle>Prepojiť nový účet</DialogTitle>
              <DialogDescription>
                Zadajte email druhého účtu a vaše rodné číslo pre overenie.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitiate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="al-email-form">Email cieľového účtu</Label>
                <Input
                  id="al-email-form"
                  type="email"
                  placeholder="email@priklad.sk"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  autoFocus
                  data-testid="input-account-link-email"
                />
                <p className="text-xs text-muted-foreground">Email prihlásenia do druhého účtu v systéme ATK</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="al-rc-form">Vaše rodné číslo</Label>
                <Input
                  id="al-rc-form"
                  type="text"
                  placeholder="YYMMDD/XXXX"
                  value={rc}
                  onChange={(e) => setRc(e.target.value)}
                  data-testid="input-account-link-rc"
                />
                <p className="text-xs text-muted-foreground">Potvrdí, že oba kontexty patria vám. Nikde sa neukladá.</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                Potvrdením preberáte zodpovednosť za akcie vykonané v prepojenom kontexte.
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setError(null); setStep("suggestions"); }} data-testid="button-account-link-cancel">
                  Späť
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !targetEmail.trim() || !rc.trim()}
                  data-testid="button-account-link-submit"
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  {loading ? "Overujem..." : "Odoslať OTP"}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── OTP STEP ── */}
        {step === "otp" && initiateResult && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                {initiateResult.method === "email" ? (
                  <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <DialogTitle>Zadajte overovací kód</DialogTitle>
              <DialogDescription>
                Kód bol odoslaný {initiateResult.method === "email" ? "na email" : "cez SMS"}{" "}
                <span className="font-semibold text-foreground">{initiateResult.maskedTarget}</span>
              </DialogDescription>
            </DialogHeader>

            {initiateResult.isReactivation && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-sm text-orange-800 dark:text-orange-300">
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Toto prepojenie bolo predtým prerušené. Overte sa znova pre jeho obnovenie.</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="text-muted-foreground text-xs mb-1">Prepájate s účtom</p>
              <p className="font-semibold">{initiateResult.targetName}</p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300" data-testid="otp-dev-hint">
              <span className="font-medium">Testovací kód:</span>
              <span className="font-mono font-bold tracking-widest">151515</span>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="al-otp">6-ciferný kód</Label>
                <Input
                  id="al-otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="text-center text-2xl font-mono tracking-widest"
                  data-testid="input-account-link-otp"
                />
                <p className="text-xs text-muted-foreground text-center">Platnosť kódu vyprší o 10 minút</p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setStep(prevStep); setError(null); setOtp(""); }}
                  data-testid="button-account-link-back"
                >
                  Späť
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={loading || otp.trim().length !== 6}
                  data-testid="button-account-link-verify"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {loading ? "Overujem..." : "Potvrdiť"}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === "success" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2 mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center">Kontexty prepojené</DialogTitle>
              <DialogDescription className="text-center">
                {initiateResult?.isReactivation
                  ? "Prepojenie bolo úspešne obnovené."
                  : "Nové prepojenie bolo vytvorené."}{" "}
                Môžete prepínať medzi kontextmi v hornej lište systému.
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSuccessClose} data-testid="button-account-link-done">
              Hotovo
            </Button>
          </>
        )}

        {/* ── GUARDIAN FORM STEP ── */}
        {step === "guardian_form" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle>Žiadosť o opatrovníctvo</DialogTitle>
              <DialogDescription>
                Zadajte email účtu, ktorý chcete spravovať. Cieľový používateľ dostane email s potvrdením.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleGuardianInitiate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guardian-email">Email cieľového účtu</Label>
                <Input
                  id="guardian-email"
                  type="email"
                  placeholder="email@priklad.sk"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  autoFocus
                  data-testid="input-guardian-email"
                />
                <p className="text-xs text-muted-foreground">Email prihlásenia do cieľového účtu v systéme ATK</p>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-xs text-blue-800 dark:text-blue-300">
                Cieľovému používateľovi bude zaslaný overovací email. Prepojenie sa aktivuje až po jeho potvrdení.
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-guardian-back">
                  Späť
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !targetEmail.trim()}
                  data-testid="button-guardian-submit"
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  {loading ? "Odosielam..." : "Odoslať žiadosť"}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── GUARDIAN PENDING STEP ── */}
        {step === "guardian_pending" && guardianPendingResult && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2 mx-auto">
                <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center">Žiadosť odoslaná</DialogTitle>
              <DialogDescription className="text-center">
                Email bol odoslaný na účet cieľového používateľa. Čakáme na jeho potvrdenie.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
              <p className="text-xs text-muted-foreground">Žiadosť o opatrovníctvo bola zaslaná pre:</p>
              <p className="font-semibold text-foreground" data-testid="text-guardian-target">{guardianPendingResult.targetName}</p>
              <p className="text-xs text-muted-foreground">{guardianPendingResult.maskedTarget}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setError(null); setStep("guardian_manage"); }} data-testid="button-guardian-view-manage">
                <Users className="w-4 h-4 mr-1" />
                Prehľad správ
              </Button>
              <Button className="flex-1" onClick={handleClose} data-testid="button-guardian-done">
                Zavrieť
              </Button>
            </div>
          </>
        )}

        {/* ── GUARDIAN MANAGE STEP ── */}
        {step === "guardian_manage" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-2">
                <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <DialogTitle>Moje opatrovníctva</DialogTitle>
              <DialogDescription>
                Prehľad čakajúcich žiadostí a aktívnych opatrovníckych prepojení.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {(guardianPendingQuery.isLoading || guardianActiveQuery.isLoading) && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Načítavam...</span>
              </div>
            )}

            {guardianPendingQuery.data && guardianPendingQuery.data.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Čakajúce žiadosti</p>
                {guardianPendingQuery.data.map((item) => (
                  <div key={item.linkId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`guardian-pending-${item.linkId}`}>
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.targetName}</p>
                      <p className="text-xs text-muted-foreground">{item.tokenExpired ? "Token vypršal" : "Čaká na potvrdenie"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      disabled={loading}
                      onClick={() => handleRevoke(item.linkId)}
                      data-testid={`button-guardian-revoke-pending-${item.linkId}`}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Zrušiť
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {guardianActiveQuery.data && guardianActiveQuery.data.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aktívne opatrovníctva</p>
                {guardianActiveQuery.data.map((item) => (
                  <div key={item.linkId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`guardian-active-${item.linkId}`}>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.otherName}</p>
                      <p className="text-xs text-muted-foreground">{item.isGuardian ? "Spravujem tento účet" : "Tento správca spravuje môj účet"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      disabled={loading}
                      onClick={() => handleRevoke(item.linkId)}
                      data-testid={`button-guardian-revoke-${item.linkId}`}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Zrušiť
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!guardianPendingQuery.isLoading && !guardianActiveQuery.isLoading &&
              (!guardianPendingQuery.data?.length && !guardianActiveQuery.data?.length) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground" data-testid="guardian-manage-empty">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>Nemáte žiadne opatrovnícke prepojenia.</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-guardian-manage-back">
                Späť
              </Button>
              <Button className="flex-1" onClick={() => { setError(null); setTargetEmail(""); setStep("guardian_form"); }} data-testid="button-guardian-new">
                <ShieldCheck className="w-4 h-4 mr-1" />
                Nová žiadosť
              </Button>
            </div>
          </>
        )}
        {/* ── SUBJECT FORM STEP ── */}
        {step === "subject_form" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2">
                <Link2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <DialogTitle>Prepojenie so subjektom</DialogTitle>
              <DialogDescription>
                Vyhľadajte subjekt (PO, FO, SZČO, VS, OS, TS) a odošlite žiadosť o prepojenie. Subjekt dostane email s potvrdením.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubjectSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Hľadať podľa názvu, IČO, UID..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                data-testid="input-subject-search"
                className="flex-1"
              />
              <Button type="submit" disabled={subjectSearchLoading || !subjectSearch.trim()} data-testid="button-subject-search">
                {subjectSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </form>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {subjectSearchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {subjectSearchResults.map((s) => {
                  const displayName = s.companyName || [s.firstName, s.lastName].filter(Boolean).join(" ") || s.uid || "Neznámy";
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`subject-result-${s.id}`}>
                      <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {subjectTypeLabel(s.type)}
                          {s.ico && <span> — IČO:&nbsp;{s.ico}</span>}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => handleSubjectInitiate(s.id)}
                        data-testid={`button-subject-initiate-${s.id}`}
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Prepojiť"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {!subjectSearchLoading && subjectSearch && subjectSearchResults.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground" data-testid="subject-search-empty">
                <Search className="w-4 h-4 flex-shrink-0" />
                <span>Žiadne subjekty neboli nájdené. Skúste iný výraz.</span>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-subject-form-back">
              Späť
            </Button>
          </>
        )}

        {/* ── SUBJECT PENDING STEP ── */}
        {step === "subject_pending" && subjectPendingResult && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle>Žiadosť odoslaná</DialogTitle>
              <DialogDescription>
                Subjekt <strong>{subjectPendingResult.subjectName}</strong> dostane email na adresu <strong>{subjectPendingResult.maskedEmail}</strong> s odkazom na potvrdenie prepojenia.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Platnosť potvrdenia je 72 hodín. Ak nebude potvrdené, žiadosť vyprší automaticky. Potvrdenie vykonáva oprávnená osoba subjektu.</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("subject_manage"); }} data-testid="button-subject-pending-to-manage">
                Zobraziť moje subjekty
              </Button>
              <Button className="flex-1" onClick={() => { setError(null); setSubjectSearch(""); setSubjectSearchResults([]); setStep("subject_form"); }} data-testid="button-subject-pending-new">
                <Link2 className="w-4 h-4 mr-1" />
                Ďalší subjekt
              </Button>
            </div>
          </>
        )}

        {/* ── SUBJECT MANAGE STEP ── */}
        {step === "subject_manage" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <DialogTitle>Moje subjekty</DialogTitle>
              <DialogDescription>
                Prehľad prepojení vášho účtu s evidovanými subjektmi.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {subjectLinkListQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Načítavam...</span>
              </div>
            )}

            {subjectLinkListQuery.data && subjectLinkListQuery.data.filter(l => l.status === "pending_confirmation").length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Čakajúce na potvrdenie</p>
                {subjectLinkListQuery.data.filter(l => l.status === "pending_confirmation").map((item) => (
                  <div key={item.linkId} className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20" data-testid={`subject-pending-item-${item.linkId}`}>
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{subjectTypeLabel(item.subjectType)}{item.ico && ` — IČO: ${item.ico}`}</p>
                      <p className="text-xs text-orange-700 dark:text-orange-400">{item.tokenExpired ? "Platnosť vypršala" : "Čaká na potvrdenie"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {subjectLinkListQuery.data && subjectLinkListQuery.data.filter(l => l.isActive && l.status === "verified" && !l.isTemporallyExpired).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aktívne prepojenia</p>
                {subjectLinkListQuery.data.filter(l => l.isActive && l.status === "verified" && !l.isTemporallyExpired).map((item) => (
                  <div key={item.linkId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`subject-active-item-${item.linkId}`}>
                    <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{subjectTypeLabel(item.subjectType)}{item.ico && ` — IČO: ${item.ico}`}</p>
                      {item.validUntil && (
                        <p className="text-xs text-teal-700 dark:text-teal-400 flex items-center gap-1 mt-0.5">
                          <CalendarClock className="w-3 h-3" />
                          Platné do: {formatDateSlovak(item.validUntil)}
                        </p>
                      )}
                      {item.validFrom && !item.validUntil && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <CalendarClock className="w-3 h-3" />
                          Od: {formatDateSlovak(item.validFrom)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      disabled={loading}
                      onClick={() => handleSubjectRevoke(item.linkId)}
                      data-testid={`button-subject-revoke-${item.linkId}`}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Zrušiť
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {subjectLinkListQuery.data && subjectLinkListQuery.data.filter(l => !l.isActive || l.isTemporallyExpired || l.status === "expired").length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Archive className="w-3 h-3" />
                  Archivované / vypršané
                </p>
                {subjectLinkListQuery.data.filter(l => !l.isActive || l.isTemporallyExpired || l.status === "expired").map((item) => {
                  if (item.status === "pending_confirmation") return null;
                  const expiredByValidity = item.isTemporallyExpired || item.status === "expired";
                  return (
                    <div key={item.linkId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 opacity-70" data-testid={`subject-archived-item-${item.linkId}`}>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Archive className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{subjectTypeLabel(item.subjectType)}{item.ico && ` — IČO: ${item.ico}`}</p>
                        {expiredByValidity && item.validUntil && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                            <CalendarClock className="w-3 h-3" />
                            Platnosť skončila: {formatDateSlovak(item.validUntil)}
                          </p>
                        )}
                        {!expiredByValidity && (
                          <p className="text-xs text-muted-foreground mt-0.5">Zrušené</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!subjectLinkListQuery.isLoading && (!subjectLinkListQuery.data || subjectLinkListQuery.data.length === 0) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground" data-testid="subject-manage-empty">
                <Link2 className="w-4 h-4 flex-shrink-0" />
                <span>Nemáte žiadne prepojenia so subjektmi.</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setError(null); setStep("type_select"); }} data-testid="button-subject-manage-back">
                Späť
              </Button>
              <Button className="flex-1" onClick={() => { setError(null); setSubjectSearch(""); setSubjectSearchResults([]); setStep("subject_form"); }} data-testid="button-subject-new">
                <Link2 className="w-4 h-4 mr-1" />
                Nové prepojenie
              </Button>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
