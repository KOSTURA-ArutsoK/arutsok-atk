import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, Mail, Eye, EyeOff, Phone, CheckCircle, Users, ArrowRight, FolderOpen, Baby, CreditCard, XCircle, ChevronLeft, Building2 } from "lucide-react";
import { formatUid, normalizePhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

type LoginStep = "credentials" | "subject_select" | "sms_verify" | "rc_verify" | "doc_verify" | "blocked" | "phone_verify" | "entity_rc_verify";

interface DocumentHint {
  documentType: string | null;
  masked: string | null;
}

interface SubjectOption {
  id: number;
  uid: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string | null;
  phone: string | null;
  isShadow: boolean;
  isAdult: boolean | null;
  hasRisk: boolean;
  documentHint: DocumentHint | null;
}

interface SelectedSubject {
  id: number;
  firstName: string | null;
  lastName: string | null;
  companyName?: string | null;
  phone: string | null;
}


function subjectTypeLabelSk(type: string | null): string {
  switch (type) {
    case "person": return "Fyzická osoba";
    case "szco": return "SZČO";
    case "company": return "Právnická osoba";
    case "organization": return "Tretí sektor";
    case "state": return "Verejná správa";
    case "os": return "Ostatné subjekty";
    case "mycompany": return "Vlastná spoločnosť";
    default: return "Neznámy typ";
  }
}

function docTypeLabelSk(docType: string | null): string {
  if (!docType) return "dokladu totožnosti";
  const t = docType.toLowerCase();
  if (t.includes("pas")) return "pasu";
  if (t.includes("op") || t.includes("obciansky")) return "občianskeho preukazu";
  if (t.includes("ridic") || t.includes("rp")) return "vodičského preukazu";
  return docType;
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleMessage, setIdleMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<LoginStep>("credentials");
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string>("");
  const [smsPhone, setSmsPhone] = useState<string | null>(null);
  const [docHint, setDocHint] = useState<DocumentHint | null>(null);

  const [pendingSubject, setPendingSubject] = useState<SubjectOption | null>(null);

  const [smsCode, setSmsCode] = useState("");
  const [rcValue, setRcValue] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [entityRcValue, setEntityRcValue] = useState("");
  const [entityRcEntityName, setEntityRcEntityName] = useState<string | null>(null);
  const [entityRcAttemptsLeft, setEntityRcAttemptsLeft] = useState<number>(3);

  const [newPhone, setNewPhone] = useState("");
  const [phoneSmsCode, setPhoneSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  const { login, isLoggingIn } = useAuth();

  useEffect(() => {
    const msg = sessionStorage.getItem("idle_logout_message");
    if (msg) {
      setIdleMessage(msg);
      sessionStorage.removeItem("idle_logout_message");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Zadajte e-mail a heslo");
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/login", { email: email.trim(), password });
      const data = await res.json();

      if (data.loginStep === "subject_select" && data.subjects) {
        setSubjectOptions(data.subjects);
        setStep("subject_select");
      } else if (data.loginStep === "phone_verify" && data.selectedSubject) {
        setSelectedSubject(data.selectedSubject);
        setStep("phone_verify");
      } else {
        await login({ email: email.trim(), password } as any);
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("401")) {
        setError("Nesprávny e-mail alebo heslo");
      } else {
        setError("Chyba pri prihlásení. Skúste znova.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = async (subjectId: number) => {
    setError(null);
    setLoading(true);
    const clicked = subjectOptions.find((s) => s.id === subjectId) || null;
    setPendingSubject(clicked);
    try {
      const res = await apiRequest("POST", "/api/login/select-subject", { subjectId });
      const data = await res.json();

      if (data.nextStep === "phone_verify" && data.selectedSubject) {
        setSelectedSubject(data.selectedSubject);
        setStep("phone_verify");
      } else if (data.nextStep === "sms_verify") {
        setSmsPhone(data.maskedPhone || null);
        setStep("sms_verify");
      } else if (data.nextStep === "rc_verify") {
        setStep("rc_verify");
      } else if (data.nextStep === "entity_rc_verify") {
        setEntityRcEntityName(data.entityName || null);
        setEntityRcAttemptsLeft(3);
        setEntityRcValue("");
        setStep("entity_rc_verify");
      } else if (data.nextStep === "doc_verify") {
        setDocHint(data.documentHint || null);
        setStep("doc_verify");
      } else if (data.nextStep === "blocked") {
        setBlockedMessage(data.message || "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov.");
        setStep("blocked");
      } else if (data.loginStep === "phone_verify" && data.selectedSubject) {
        setSelectedSubject(data.selectedSubject);
        setStep("phone_verify");
      }
    } catch (err: any) {
      setError("Chyba pri výbere identity");
    } finally {
      setLoading(false);
    }
  };

  const applyPendingSubject = (serverSubject?: { id: number; firstName: string | null; lastName: string | null; companyName: string | null; type: string | null } | null) => {
    if (serverSubject) {
      setSelectedSubject({
        id: serverSubject.id,
        firstName: serverSubject.firstName,
        lastName: serverSubject.lastName,
        companyName: serverSubject.companyName,
        phone: pendingSubject?.phone ?? null,
      });
    } else if (pendingSubject) {
      setSelectedSubject({
        id: pendingSubject.id,
        firstName: pendingSubject.firstName,
        lastName: pendingSubject.lastName,
        companyName: pendingSubject.companyName,
        phone: pendingSubject.phone,
      });
    }
  };

  const handleEntityRcVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!entityRcValue.trim()) { setError("Zadajte rodné číslo"); return; }
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/login/entity-rc-verify", { rc: entityRcValue.trim() });
      const data = await resp.json();
      if (data.nextStep === "phone_verify" && data.selectedSubject) {
        setSelectedSubject(data.selectedSubject);
        setStep("phone_verify");
      } else if (data.nextStep === "blocked") {
        setBlockedMessage(data.message || "Profil fyzickej osoby je neúplný.");
        setStep("blocked");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("429")) {
        setError("Príliš veľa nesprávnych pokusov. Prihláste sa znova od začiatku.");
        setEntityRcAttemptsLeft(0);
      } else {
        try {
          const jsonStr = msg.replace(/^\d+:\s*/, "");
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed.attemptsLeft === "number") setEntityRcAttemptsLeft(parsed.attemptsLeft);
          setError(parsed.message || "Nesprávne rodné číslo");
        } catch {
          setError("Nesprávne rodné číslo");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (smsCode.length !== 6) { setError("SMS kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/login/verify-sms", { code: smsCode });
      const res = await resp.json();
      applyPendingSubject(res?.selectedSubject);
      setStep("phone_verify");
    } catch (err: any) {
      setError("Nesprávny SMS kód");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!rcValue.trim()) { setError("Zadajte rodné číslo"); return; }
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/login/verify-rc", { rc: rcValue.trim() });
      const res = await resp.json();
      applyPendingSubject(res?.selectedSubject);
      setStep("phone_verify");
    } catch (err: any) {
      setError("Nesprávne rodné číslo");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!docNumber.trim()) { setError("Zadajte číslo dokladu"); return; }
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/login/verify-doc", { docNumber: docNumber.trim() });
      const res = await resp.json();
      applyPendingSubject(res?.selectedSubject);
      setStep("phone_verify");
    } catch (err: any) {
      setError("Nesprávne číslo dokladu");
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = () => {
    setPhoneConfirmed(true);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-popup-data"] });
    }, 500);
  };

  const handlePhoneConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/login/verify-phone", { confirmed: true });
      finalizeLogin();
    } catch {
      setError("Chyba pri overení telefónu");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newPhone.trim()) { setError("Zadajte nové telefónne číslo"); return; }
    if (!phoneSmsCode.trim() || phoneSmsCode.length !== 6) { setError("SMS kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/login/verify-phone", { confirmed: false, newPhone: newPhone.trim(), smsCode: phoneSmsCode.trim() });
      finalizeLogin();
    } catch {
      setError("Chyba pri zmene telefónneho čísla");
    } finally {
      setLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="text-login-error">
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  };

  const backToSelect = () => {
    setError(null);
    setSmsCode("");
    setRcValue("");
    setDocNumber("");
    setEntityRcValue("");
    setEntityRcEntityName(null);
    setEntityRcAttemptsLeft(3);
    setStep("subject_select");
  };

  if (step === "subject_select") {
    const peerSubjects = subjectOptions.filter((s) => !s.isShadow);
    const shadowSubjects = subjectOptions.filter((s) => s.isShadow);
    const hasRiskInCluster = peerSubjects.some((s) => s.hasRisk);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-5">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-subject-select-title">Vyberte identitu</h1>
                <p className="text-sm text-muted-foreground mt-1">K vášmu e-mailu je priradených viacero osôb</p>
              </div>
            </div>

            {hasRiskInCluster && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30" data-testid="banner-risk-warning">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">Upozornenie: Jeden zo subjektov je na rizikovom zozname. Vyžaduje sa overenie totožnosti.</p>
              </div>
            )}

            {renderError()}

            {peerSubjects.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Vaše profily</p>
                <div className="grid grid-cols-2 gap-2">
                  {peerSubjects.map((s) => {
                    const name = s.firstName || s.lastName
                      ? `${s.firstName || ""} ${s.lastName || ""}`.trim()
                      : s.companyName || "Neznámy";
                    const isMinor = s.isAdult === false && s.type === "person";
                    const isCompany = s.type !== "person" && s.type !== "szco";
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSubject(s.id)}
                        disabled={loading}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg border transition-colors text-left ${
                          s.hasRisk
                            ? "border-destructive/60 bg-destructive/5 hover:bg-destructive/10"
                            : "border-border hover:bg-accent hover:border-primary/50"
                        }`}
                        data-testid={`button-select-subject-${s.id}`}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          {isMinor && <Baby className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                          {isCompany && <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          {s.hasRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                          <p className="font-medium text-sm truncate">{name}</p>
                          <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground">{subjectTypeLabelSk(s.type)}</p>
                        {isMinor && <p className="text-xs text-blue-500">Neplnoletá osoba</p>}
                        {s.phone && <p className="text-xs font-mono text-muted-foreground">{s.phone}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {shadowSubjects.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Spravované profily</p>
                <div className="grid grid-cols-2 gap-2">
                  {shadowSubjects.map((s) => {
                    const name = s.firstName || s.lastName
                      ? `${s.firstName || ""} ${s.lastName || ""}`.trim()
                      : s.companyName || "Neznámy";
                    const isMinor = s.isAdult === false && s.type === "person";
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSubject(s.id)}
                        disabled={loading}
                        className="flex flex-col items-start gap-1 p-3 rounded-lg border border-dashed border-border hover:bg-accent hover:border-primary/50 transition-colors text-left"
                        data-testid={`button-select-shadow-${s.id}`}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          {isMinor ? <Baby className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> : <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          <p className="font-medium text-sm truncate">{name}</p>
                          <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground">{subjectTypeLabelSk(s.type)}</p>
                        {isMinor && <p className="text-xs text-blue-500">Neplnoletá osoba</p>}
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Spravovaný profil</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "entity_rc_verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-entity-rc-verify-title">Identifikácia osoby</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Spoločnosť{entityRcEntityName ? <> <span className="font-semibold">{entityRcEntityName}</span></> : ""} má viacerých oprávnených zástupcov
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
              Pre jednoznačnú identifikáciu zadajte vaše rodné číslo. Zostávajúce pokusy: <span className="font-semibold text-foreground">{entityRcAttemptsLeft}</span>
            </div>

            {renderError()}

            <form onSubmit={handleEntityRcVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entityRcInput">Rodné číslo</Label>
                <Input
                  id="entityRcInput"
                  type="text"
                  placeholder="YYMMDD/XXXX"
                  value={entityRcValue}
                  onChange={(e) => setEntityRcValue(e.target.value)}
                  autoFocus
                  data-testid="input-entity-rc-value"
                />
                <p className="text-xs text-muted-foreground">Zadajte rodné číslo evidované k vášmu profilu v systéme</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading || !entityRcValue.trim()}
                data-testid="button-verify-entity-rc"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Potvrdiť totožnosť"}
              </Button>

              <Button type="button" variant="ghost" className="w-full text-sm" onClick={backToSelect} data-testid="button-back-to-select-entity-rc">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na výber identity
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "sms_verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-sms-verify-title">Overenie SMS kódom</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Kód bol odoslaný na číslo <span className="font-mono font-semibold">{smsPhone || "neznáme číslo"}</span>
                </p>
              </div>
            </div>

            {renderError()}

            <form onSubmit={handleVerifySms} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smsCodeInput">SMS overovací kód (6 číslic)</Label>
                <Input
                  id="smsCodeInput"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                  data-testid="input-sms-code-verify"
                />
                <p className="text-xs text-muted-foreground text-center">Overovací kód bol odoslaný (simulácia)</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading || smsCode.length !== 6}
                data-testid="button-verify-sms-code"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Potvrdiť kód"}
              </Button>

              <Button type="button" variant="ghost" className="w-full text-sm" onClick={backToSelect} data-testid="button-back-to-select-sms">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na výber identity
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "rc_verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-rc-verify-title">Overenie rodného čísla</h1>
                <p className="text-sm text-muted-foreground mt-1">Zadajte rodné číslo pre potvrdenie vašej totožnosti</p>
              </div>
            </div>

            {renderError()}

            <form onSubmit={handleVerifyRc} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rcInput">Rodné číslo</Label>
                <Input
                  id="rcInput"
                  type="text"
                  placeholder="YYMMDD/XXXX"
                  value={rcValue}
                  onChange={(e) => setRcValue(e.target.value)}
                  autoFocus
                  data-testid="input-rc-value"
                />
                <p className="text-xs text-muted-foreground">Zadajte rodné číslo evidované v systéme</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading || !rcValue.trim()}
                data-testid="button-verify-rc"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Potvrdiť totožnosť"}
              </Button>

              <Button type="button" variant="ghost" className="w-full text-sm" onClick={backToSelect} data-testid="button-back-to-select-rc">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na výber identity
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "doc_verify") {
    const docLabel = docTypeLabelSk(docHint?.documentType || null);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-doc-verify-title">Overenie dokladu totožnosti</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Zadajte číslo {docLabel}
                </p>
              </div>
            </div>

            {docHint?.masked && (
              <div className="text-center p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Evidovaný doklad ({docHint.documentType || "neznámy typ"})</p>
                <p className="text-lg font-mono font-bold" data-testid="text-doc-masked">{docHint.masked}</p>
              </div>
            )}

            {renderError()}

            <form onSubmit={handleVerifyDoc} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="docInput">Číslo {docLabel}</Label>
                <Input
                  id="docInput"
                  type="text"
                  placeholder="Zadajte číslo dokladu"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  autoFocus
                  data-testid="input-doc-number"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading || !docNumber.trim()}
                data-testid="button-verify-doc"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? "Overujem..." : "Potvrdiť totožnosť"}
              </Button>

              <Button type="button" variant="ghost" className="w-full text-sm" onClick={backToSelect} data-testid="button-back-to-select-doc">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na výber identity
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-blocked-title">Prístup zamietnutý</h1>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-blocked-message">
                  {blockedMessage || "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov."}
                </p>
              </div>
            </div>

            <Button type="button" variant="ghost" className="w-full text-sm" onClick={backToSelect} data-testid="button-back-to-select-blocked">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Späť na výber identity
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "phone_verify") {
    if (phoneConfirmed) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md rounded-2xl">
            <CardContent className="pt-8 pb-6 px-6 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-xl font-bold" data-testid="text-phone-verified">Overenie úspešné</h1>
                <p className="text-sm text-muted-foreground">Presmerovanie do systému...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-phone-verify-title">Overenie telefónu</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSubject?.firstName} {selectedSubject?.lastName}
                  {selectedSubject?.companyName && !selectedSubject?.firstName ? selectedSubject.companyName : ""}
                </p>
              </div>
            </div>

            {renderError()}

            {!smsSent ? (
              <div className="space-y-4">
                <div className="text-center p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Je toto vaše aktuálne telefónne číslo?</p>
                  <p className="text-lg font-mono font-bold" data-testid="text-masked-phone">
                    {selectedSubject?.phone || "Telefón nie je evidovaný"}
                  </p>
                </div>

                <div className="flex gap-2 w-full">
                  <Button
                    onClick={handlePhoneConfirm}
                    disabled={loading || !selectedSubject?.phone}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="button-phone-yes"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ÁNO
                  </Button>
                  <Button
                    onClick={() => setSmsSent(true)}
                    variant="outline"
                    className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    data-testid="button-phone-no"
                  >
                    NIE
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePhoneChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPhone">Nové telefónne číslo</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="newPhone"
                      type="tel"
                      placeholder="+421 9XX XXX XXX"
                      value={newPhone}
                      onChange={(e) => setNewPhone(normalizePhone(e.target.value) || e.target.value)}
                      className="pl-10"
                      autoFocus
                      data-testid="input-new-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneSmsCode">SMS overovací kód (6 číslic)</Label>
                  <Input
                    id="phoneSmsCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={phoneSmsCode}
                    onChange={(e) => setPhoneSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    data-testid="input-sms-code"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Overovací kód bol odoslaný na nové číslo (simulácia)
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={loading || phoneSmsCode.length !== 6}
                  data-testid="button-verify-sms"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {loading ? "Overujem..." : "Overiť a pokračovať"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-3">
        <Card className="rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            {idleMessage && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="text-idle-message">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{idleMessage}</p>
              </div>
            )}

            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-app-title">ArutsoK</h1>
                <p className="text-sm text-muted-foreground mt-1">Prihláste sa pre prístup do systému</p>
              </div>
            </div>

            {renderError()}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Zadajte váš e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                    autoFocus
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Heslo</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Zadajte heslo"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading || isLoggingIn}
                data-testid="button-login"
              >
                <Lock className="w-4 h-4 mr-2" />
                {loading || isLoggingIn ? "Prihlasovanie..." : "Prihlásiť sa"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex gap-2 w-full">
          <Link href="/forgot-password" className="basis-3/5">
            <Button
              variant="outline"
              className="w-full rounded-xl border-orange-500 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/30 font-medium"
              data-testid="button-forgot-password"
            >
              Zabudli ste heslo?
            </Button>
          </Link>
          <Link href="/register" className="basis-2/5">
            <Button
              variant="outline"
              className="w-full rounded-xl border-yellow-500 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 dark:text-yellow-400 dark:hover:bg-yellow-500/30 font-medium"
              data-testid="button-register"
            >
              Registrovať sa
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
