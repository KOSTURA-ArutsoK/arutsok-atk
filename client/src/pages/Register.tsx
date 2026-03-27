import { useState, useRef, useCallback } from "react";
import { Shield, ArrowLeft, Mail, Phone, KeyRound, ShieldCheck, UserCheck, AlertTriangle, Fingerprint, Building2, Landmark, Heart, Globe, Search, CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { formatPhone, normalizePhone } from "@/lib/utils";
import { validateSlovakRC } from "@shared/rc-validator";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type Step = "identify" | "birth_verify" | "mfa" | "full_verify" | "welcome";

interface ClientData {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
}

interface LiveLookupCandidate {
  subjectId: number;
  name: string;
  type: string;
  ico: string | null;
  uid: string | null;
  via: string;
}

type CandidateStatus = "idle" | "selected" | "pending" | "initiated" | "error" | "already_linked" | "already_pending" | "no_email";

function subjectTypeLabel(type: string): string {
  switch (type) {
    case "company":
    case "mycompany": return "PO";
    case "szco": return "SZČO";
    case "state": return "VS";
    case "organization": return "TS";
    case "os": return "OS";
    default: return type.toUpperCase();
  }
}

function subjectTypeBadgeColor(type: string): string {
  switch (type) {
    case "company":
    case "mycompany": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "szco": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "state": return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "organization": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    case "os": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
}

function CandidateTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "company":
    case "mycompany": return <Building2 className="w-4 h-4" />;
    case "state": return <Landmark className="w-4 h-4" />;
    case "organization":
    case "os": return <Heart className="w-4 h-4" />;
    default: return <Globe className="w-4 h-4" />;
  }
}

function candidateStatusBadge(status: CandidateStatus) {
  switch (status) {
    case "initiated":
    case "already_pending":
      return <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><Clock className="w-3.5 h-3.5" />Čaká na overenie</span>;
    case "already_linked":
      return <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Prepojené</span>;
    case "no_email":
      return <span className="text-xs text-destructive">Subjekt nemá email</span>;
    case "error":
      return <span className="text-xs text-destructive">Chyba</span>;
    default:
      return null;
  }
}

export default function RegisterPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("identify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [challengeId, setChallengeId] = useState("");
  const [positions, setPositions] = useState<number[]>([]);
  const [birthNumberLength, setBirthNumberLength] = useState(10);
  const [clientName, setClientName] = useState("");
  const [digitInputs, setDigitInputs] = useState<string[]>([]);

  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailCode, setEmailCode] = useState("");

  const [fullBirthNumber, setFullBirthNumber] = useState("");
  const [fullBirthNumberError, setFullBirthNumberError] = useState<string | null>(null);
  const [idCardNumber, setIdCardNumber] = useState("");

  const [clientData, setClientData] = useState<ClientData | null>(null);

  // Live Lookup state
  const [liveLookupCandidates, setLiveLookupCandidates] = useState<LiveLookupCandidate[]>([]);
  const [liveLookupLoading, setLiveLookupLoading] = useState(false);
  const [liveLookupDone, setLiveLookupDone] = useState(false);
  const [candidateStatuses, setCandidateStatuses] = useState<Record<number, CandidateStatus>>({});
  const [liveLookupExpanded, setLiveLookupExpanded] = useState(true);
  const [batchInitiating, setBatchInitiating] = useState(false);
  const [registeredSubjectId, setRegisteredSubjectId] = useState<number | null>(null);

  const verifyBirthButtonRef = useRef<HTMLButtonElement>(null);

  const positionLabel = (pos: number) => {
    return `${pos + 1}. cifra`;
  };

  async function handleInitiate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/register/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }
      setChallengeId(data.challengeId);
      setPositions(data.positions);
      setBirthNumberLength(data.birthNumberLength);
      setClientName(data.clientName);
      setDigitInputs(new Array(data.positions.length).fill(""));
      setStep("birth_verify");
    } catch {
      setError("Chyba pripojenia k serveru");
    } finally {
      setLoading(false);
    }
  }

  async function handleBirthVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/register/verify-birth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, digits: digitInputs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }

      setSubjectId(data.subjectId);

      if (data.step === "mfa") {
        setMaskedPhone(data.maskedPhone);
        setMaskedEmail(data.maskedEmail);
        setStep("mfa");
      } else if (data.step === "full_verification") {
        setStep("full_verify");
      }
    } catch {
      setError("Chyba pripojenia k serveru");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/register/mfa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, smsCode, emailCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }
      setClientData(data.client);
      setRegisteredSubjectId(data.client?.id ?? subjectId);
      setStep("welcome");
    } catch {
      setError("Chyba pripojenia k serveru");
    } finally {
      setLoading(false);
    }
  }

  async function handleFullVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/register/full-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, fullBirthNumber, idCardNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }
      setClientData(data.client);
      setRegisteredSubjectId(data.client?.id ?? subjectId);

      // Spustiť Live Lookup po úspešnom overení
      runLiveLookup(fullBirthNumber);

      setStep("welcome");
    } catch {
      setError("Chyba pripojenia k serveru");
    } finally {
      setLoading(false);
    }
  }

  const runLiveLookup = useCallback(async (birthNum: string) => {
    if (!birthNum) return;
    const cleanBn = birthNum.replace(/\//g, "").replace(/\s/g, "").trim();
    if (!/^\d{9,10}$/.test(cleanBn)) return;

    setLiveLookupLoading(true);
    try {
      const res = await fetch("/api/registration/live-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthNumber: cleanBn }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const candidates: LiveLookupCandidate[] = data.candidates || [];
      setLiveLookupCandidates(candidates);
      setLiveLookupDone(true);
      const initialStatuses: Record<number, CandidateStatus> = {};
      for (const c of candidates) {
        initialStatuses[c.subjectId] = "idle";
      }
      setCandidateStatuses(initialStatuses);
    } catch {}
    finally {
      setLiveLookupLoading(false);
    }
  }, []);

  function toggleCandidate(subjectId: number) {
    setCandidateStatuses(prev => ({
      ...prev,
      [subjectId]: prev[subjectId] === "selected" ? "idle" : "selected",
    }));
  }

  const selectedIds = Object.entries(candidateStatuses)
    .filter(([, v]) => v === "selected")
    .map(([k]) => Number(k));

  async function handleBatchInitiate() {
    if (selectedIds.length === 0) return;
    setBatchInitiating(true);
    try {
      const res = await fetch("/api/registration/live-lookup/batch-initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subjectIds: selectedIds }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast({
            title: "Prihláste sa do systému",
            description: "Prepojenia môžete spustiť po prihlásení v nastaveniach účtu.",
            variant: "destructive",
          });
          return;
        }
        return;
      }
      const data = await res.json();
      const results: { subjectId: number; status: string }[] = data.results || [];
      const newStatuses = { ...candidateStatuses };
      for (const r of results) {
        newStatuses[r.subjectId] = r.status as CandidateStatus;
      }
      setCandidateStatuses(newStatuses);
      toast({ title: "Žiadosti o prepojenie boli odoslané" });
    } catch {
      toast({ title: "Chyba pri odosielaní žiadostí", variant: "destructive" });
    } finally {
      setBatchInitiating(false);
    }
  }

  const hasActionableStatuses = Object.values(candidateStatuses).some(
    s => s === "initiated" || s === "already_pending" || s === "already_linked"
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {step === "identify" && "Registracia"}
              {step === "birth_verify" && "Overenie identity"}
              {step === "mfa" && "Dvojfaktorove overenie"}
              {step === "full_verify" && "Rozsirene overenie"}
              {step === "welcome" && `Vitajte ${clientData?.firstName || ""}`}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">ArutsoK</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="text-register-error">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {step === "identify" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Zadajte vase kontaktne udaje pre overenie. Registrovat sa mozu len klienti existujucich spolocnosti.
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reg-email" className="text-xs">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="vas@email.sk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const phoneInput = document.getElementById("reg-phone");
                          if (phoneInput) phoneInput.focus();
                        }
                      }}
                      className="pl-9"
                      data-testid="input-register-email"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-phone" className="text-xs">Telefon</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-phone"
                      type="tel"
                      placeholder="+421 900 000 000"
                      value={phone}
                      onChange={(e) => setPhone(normalizePhone(e.target.value) || e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (email && phone && !loading) {
                            handleInitiate();
                          }
                        }
                      }}
                      className="pl-9"
                      data-testid="input-register-phone"
                    />
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleInitiate}
                disabled={loading || !email || !phone}
                data-testid="button-register-initiate"
              >
                {loading ? "Overujem..." : "Pokracovat"}
              </Button>
            </div>
          )}

          {step === "birth_verify" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {clientName && <><span className="font-medium text-foreground">{clientName}</span>, </>}
                zadajte nasledujuce cifry z vasho rodneho cisla ({birthNumberLength}-miestne):
              </p>
              <div className="space-y-3">
                {positions.map((pos, idx) => (
                  <div key={pos} className="flex items-center gap-3">
                    <Badge variant="outline" className="min-w-[80px] justify-center">
                      {positionLabel(pos)}
                    </Badge>
                    <Input
                      type="text"
                      maxLength={1}
                      pattern="[0-9]"
                      inputMode="numeric"
                      value={digitInputs[idx] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        const newDigits = [...digitInputs];
                        newDigits[idx] = val;
                        setDigitInputs(newDigits);
                        if (val) {
                          const nextIdx = idx + 1;
                          if (nextIdx < positions.length) {
                            const nextInput = document.querySelector(`[data-testid="input-birth-digit-${nextIdx}"]`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          } else {
                            const allFilled = newDigits.every(d => d !== "");
                            if (allFilled) {
                              verifyBirthButtonRef.current?.focus();
                            }
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const allFilled = digitInputs.every(d => d !== "");
                          if (allFilled && !loading) {
                            handleBirthVerify();
                          }
                        }
                      }}
                      className="w-14 text-center font-mono text-lg"
                      data-testid={`input-birth-digit-${idx}`}
                    />
                  </div>
                ))}
              </div>
              <Button
                ref={verifyBirthButtonRef}
                className="w-full"
                onClick={handleBirthVerify}
                disabled={loading || digitInputs.some(d => d === "")}
                data-testid="button-verify-birth"
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Overit"}
              </Button>
            </div>
          )}

          {step === "mfa" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Overovaci kod bol odoslany na:
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">{maskedPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">{maskedEmail}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sms-code" className="text-xs">SMS kod</Label>
                  <div className="relative mt-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="sms-code"
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="000000"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="pl-9 font-mono tracking-wider"
                      data-testid="input-sms-code"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email-code" className="text-xs">Email kod</Label>
                  <div className="relative mt-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email-code"
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="000000"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="pl-9 font-mono tracking-wider"
                      data-testid="input-email-code"
                    />
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleMfaVerify}
                disabled={loading || smsCode.length < 6 || emailCode.length < 6}
                data-testid="button-verify-mfa"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Overit kody"}
              </Button>
            </div>
          )}

          {step === "full_verify" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vase kontaktne udaje nie su kompletne v systeme. Pre dokoncenie overenia zadajte:
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="full-bn" className="text-xs">Cele rodne cislo</Label>
                  <Input
                    id="full-bn"
                    type="text"
                    placeholder="YYMMDD/XXXX"
                    value={fullBirthNumber}
                    onChange={(e) => {
                      setFullBirthNumber(e.target.value);
                      if (fullBirthNumberError) {
                        const result = validateSlovakRC(e.target.value);
                        if (result.valid) setFullBirthNumberError(null);
                      }
                      const cleanVal = e.target.value.replace(/[^0-9]/g, "");
                      if (cleanVal.length >= 9 && cleanVal.length <= 10) {
                        setTimeout(() => {
                          const idCardInput = document.getElementById("id-card");
                          if (idCardInput) idCardInput.focus();
                        }, 50);
                      }
                    }}
                    onBlur={() => {
                      const cleanVal = fullBirthNumber.replace(/[^0-9]/g, "");
                      if (!cleanVal || cleanVal.length < 6) { setFullBirthNumberError(null); return; }
                      const result = validateSlovakRC(fullBirthNumber);
                      if (!result.valid) {
                        setFullBirthNumberError(result.error || "Neplatné rodné číslo");
                      } else {
                        setFullBirthNumberError(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const idCardInput = document.getElementById("id-card");
                        if (idCardInput) idCardInput.focus();
                      }
                    }}
                    className={`font-mono ${fullBirthNumberError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    data-testid="input-full-birth-number"
                  />
                  {fullBirthNumberError && (
                    <p className="text-xs text-red-500 mt-1" data-testid="text-rc-register-error">{fullBirthNumberError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="id-card" className="text-xs">Cislo obcianskeho preukazu (OP)</Label>
                  <Input
                    id="id-card"
                    type="text"
                    placeholder="AA000000"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (fullBirthNumber && idCardNumber && !loading) {
                          handleFullVerify();
                        }
                      }
                    }}
                    className="font-mono"
                    data-testid="input-id-card-number"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleFullVerify}
                disabled={loading || !fullBirthNumber || !idCardNumber}
                data-testid="button-verify-full"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Overit identitu"}
              </Button>
            </div>
          )}

          {step === "welcome" && clientData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <UserCheck className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Overenie uspesne</p>
                  <p className="text-xs text-muted-foreground">Vasa identita bola overena</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Meno</span>
                  <span className="text-sm font-medium" data-testid="text-welcome-name">
                    {clientData.firstName} {clientData.lastName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium" data-testid="text-welcome-email">
                    {clientData.email || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Telefon</span>
                  <span className="text-sm font-medium" data-testid="text-welcome-phone">
                    {formatPhone(clientData.phone)}
                  </span>
                </div>
                {clientData.companyName && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Spolocnost</span>
                    <span className="text-sm font-medium" data-testid="text-welcome-company">
                      {clientData.companyName}
                    </span>
                  </div>
                )}
              </div>

              {/* Live Lookup sekcia */}
              {(liveLookupLoading || (liveLookupDone && liveLookupCandidates.length > 0)) && (
                <div className="border border-border rounded-md overflow-hidden" data-testid="section-live-lookup">
                  <button
                    type="button"
                    onClick={() => setLiveLookupExpanded(v => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                    data-testid="button-live-lookup-toggle"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">
                        Našli sme subjekty, kde ste zapísaný
                      </span>
                      {liveLookupCandidates.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{liveLookupCandidates.length}</Badge>
                      )}
                    </div>
                    {liveLookupExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {liveLookupExpanded && (
                    <div className="p-4 space-y-3">
                      {liveLookupLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Prehľadávam databázu...
                        </div>
                      )}

                      {!liveLookupLoading && liveLookupCandidates.length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Zaškrtnite subjekty, ku ktorým chcete požiadať o prístup. Overovací email bude odoslaný na kontaktný email každého subjektu.
                          </p>
                          <div className="space-y-2">
                            {liveLookupCandidates.map((c) => {
                              const status = candidateStatuses[c.subjectId] ?? "idle";
                              const isActionable = status === "idle" || status === "selected";
                              const isActive = status === "selected";

                              return (
                                <div
                                  key={c.subjectId}
                                  data-testid={`card-live-lookup-candidate-${c.subjectId}`}
                                  className={`flex items-center gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
                                    isActive
                                      ? "bg-primary/10 border-primary/30"
                                      : "bg-muted/30 border-border hover:bg-muted/50"
                                  } ${!isActionable ? "opacity-70 cursor-default" : ""}`}
                                  onClick={() => isActionable && toggleCandidate(c.subjectId)}
                                >
                                  <div className="flex-shrink-0">
                                    {isActionable ? (
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                        isActive ? "bg-primary border-primary" : "border-border"
                                      }`}>
                                        {isActive && <div className="w-2 h-2 bg-white rounded-sm" />}
                                      </div>
                                    ) : (
                                      <div className="w-4 h-4 flex items-center justify-center">
                                        {candidateStatusBadge(status)}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${subjectTypeBadgeColor(c.type)}`}>
                                    <CandidateTypeIcon type={c.type} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${subjectTypeBadgeColor(c.type)}`}>
                                        {subjectTypeLabel(c.type)}
                                      </span>
                                      {c.ico && <span className="text-xs text-muted-foreground">IČO: {c.ico}</span>}
                                      {!isActionable && <div className="ml-1">{candidateStatusBadge(status)}</div>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {selectedIds.length > 0 && (
                            <Button
                              className="w-full"
                              onClick={handleBatchInitiate}
                              disabled={batchInitiating}
                              data-testid="button-live-lookup-batch-initiate"
                            >
                              {batchInitiating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Odosielam žiadosti...</>
                              ) : (
                                `Požiadať o prepojenie (${selectedIds.length})`
                              )}
                            </Button>
                          )}

                          {hasActionableStatuses && (
                            <p className="text-xs text-muted-foreground text-center">
                              Stav overení môžete sledovať po prihlásení v nastaveniach účtu.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => window.location.href = "/client-zone"}
                data-testid="button-enter-client-zone"
              >
                Vstup do Osobnej zony
              </Button>
            </div>
          )}

          {step !== "welcome" && (
            <div className="text-center pt-2">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors" data-testid="link-back-to-login">
                <ArrowLeft className="w-3.5 h-3.5" />
                Spat na prihlasenie
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
