import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Link, Mail, MessageSquare, ArrowRight, RefreshCw, Loader2, UserCheck, Building2, Search } from "lucide-react";

type ModalStep = "suggestions" | "form" | "otp" | "success";

interface Suggestion {
  userId: number;
  firstName: string | null;
  lastName: string | null;
  maskedEmail: string;
  type: string | null;
  ico: string | null;
  uid: string | null;
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
  const [step, setStep] = useState<ModalStep>("suggestions");
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

  useEffect(() => {
    if (open && !suggestionsLoaded) {
      loadSuggestions();
    }
  }, [open]);

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
    setStep("suggestions");
    setPrevStep("suggestions");
    setTargetEmail("");
    setRc("");
    setOtp("");
    setError(null);
    setInitiateResult(null);
    setSuggestions([]);
    setSuggestionsLoaded(false);
  };

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

  const emptyAndLoaded = suggestionsLoaded && !suggestionsLoading && suggestions.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>

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
                <Button variant="outline" className="w-full" onClick={handleClose} data-testid="button-account-link-cancel">
                  Zavrieť
                </Button>
              </>
            )}

            {/* Empty state: show info + manual form inline, no extra click needed */}
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
                    <Button type="button" variant="outline" className="flex-1" onClick={handleClose} data-testid="button-account-link-cancel">
                      Zavrieť
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

        {/* ── MANUAL FORM STEP (accessed from suggestion list via "Zadať email manuálne") ── */}
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
      </DialogContent>
    </Dialog>
  );
}
