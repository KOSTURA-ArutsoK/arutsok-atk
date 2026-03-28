import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, Mail, Eye, EyeOff, Phone, CheckCircle, Users, ArrowRight, FolderOpen, Baby, CreditCard, XCircle, ChevronLeft, Building2, User, Share2 } from "lucide-react";
import { formatUid, formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

type LoginStep = "credentials" | "subject_select" | "sms_verify" | "rc_verify" | "doc_verify" | "blocked" | "entity_rc_verify";

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
  ico?: string | null;
  isShadow: boolean;
  isAdult: boolean | null;
  hasRisk: boolean;
  documentHint: DocumentHint | null;
  groups?: string[];
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

type AtkCategory = "HOLDING" | "CLIENT" | "NETWORK";
const HOLDING_TYPES = new Set(["company", "organization", "state", "mycompany"]);

function getAtkCategory(s: SubjectOption): AtkCategory {
  if (HOLDING_TYPES.has(s.type ?? "")) return "HOLDING";
  if ((s.groups ?? []).includes("group_registrovany")) return "NETWORK";
  return "CLIENT";
}

const ATK_SECTION_META: Record<AtkCategory, { label: string; colorClass: string; stripClass: string; stripShadowClass: string; icon: (cls: string) => JSX.Element }> = {
  HOLDING: {
    label: "HOLDING",
    colorClass: "text-blue-600 dark:text-blue-400",
    stripClass: "bg-blue-500",
    stripShadowClass: "bg-blue-300",
    icon: (cls) => <Building2 className={cls} />,
  },
  CLIENT: {
    label: "CLIENT",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    stripClass: "bg-emerald-500",
    stripShadowClass: "bg-emerald-300",
    icon: (cls) => <User className={cls} />,
  },
  NETWORK: {
    label: "NETWORK",
    colorClass: "text-orange-500 dark:text-orange-400",
    stripClass: "bg-orange-500",
    stripShadowClass: "bg-orange-300",
    icon: (cls) => <Share2 className={cls} />,
  },
};

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleMessage, setIdleMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<LoginStep>("credentials");
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string>("");
  const [smsPhone, setSmsPhone] = useState<string | null>(null);
  const [docHint, setDocHint] = useState<DocumentHint | null>(null);

  const [subjectSearch, setSubjectSearch] = useState("");

  const [smsCode, setSmsCode] = useState("");
  const [rcValue, setRcValue] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [entityRcValue, setEntityRcValue] = useState("");
  const [entityRcEntityName, setEntityRcEntityName] = useState<string | null>(null);
  const [entityRcAttemptsLeft, setEntityRcAttemptsLeft] = useState<number>(3);

  const { isLoggingIn } = useAuth();

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
      } else if (data.loginStep === "sms_verify") {
        setSmsPhone(data.maskedPhone || null);
        setStep("sms_verify");
      } else if (data.loginStep === "rc_verify") {
        setStep("rc_verify");
      } else if (data.loginStep === "doc_verify") {
        setDocHint(data.documentHint || null);
        setStep("doc_verify");
      } else if (data.loginStep === "entity_rc_verify") {
        setEntityRcEntityName(data.entityName || null);
        setEntityRcAttemptsLeft(3);
        setEntityRcValue("");
        setStep("entity_rc_verify");
      } else if (data.loginStep === "blocked") {
        setBlockedMessage(data.message || "Prístup bol zamietnutý. Kontaktujte prosím podporu.");
        setStep("blocked");
      } else {
        await finalizeLogin();
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
    try {
      const res = await apiRequest("POST", "/api/login/select-subject", { subjectId });
      const data = await res.json();

      if (data.nextStep === "sms_verify") {
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
      } else if (data.nextStep === "done") {
        finalizeLogin();
      }
    } catch (err: any) {
      setError("Chyba pri výbere identity");
    } finally {
      setLoading(false);
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
      if (data.nextStep === "done") {
        finalizeLogin();
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
      if (res?.nextStep === "done") {
        finalizeLogin();
      } else if (res?.nextStep === "blocked") {
        setBlockedMessage(res.message ?? "Prístup zamietnutý");
        setStep("blocked");
      }
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
      await apiRequest("POST", "/api/login/verify-rc", { rc: rcValue.trim() });
      finalizeLogin();
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
      await apiRequest("POST", "/api/login/verify-doc", { docNumber: docNumber.trim() });
      finalizeLogin();
    } catch (err: any) {
      setError("Nesprávne číslo dokladu");
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/home-popup-data"] }),
    ]);
    localStorage.setItem("atk_pending_identity_setup", "1");
    navigate("/");
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
    setSubjectSearch("");
    setStep("subject_select");
  };

  if (step === "subject_select") {
    const totalCount = subjectOptions.length;
    const useListView = totalCount > 8;

    const q = subjectSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const matchesSearch = (s: SubjectOption) => {
      if (!q) return true;
      const name = [s.firstName, s.lastName, s.companyName].filter(Boolean).join(" ").toLowerCase();
      const uid = (s.uid || "").replace(/\D/g, "");
      const ico = (s.ico || "").replace(/\D/g, "");
      const nameMatch = name.includes(q);
      const uidMatch = qDigits.length > 0 && uid.includes(qDigits);
      const icoMatch = qDigits.length > 0 && ico.length > 0 && ico.includes(qDigits);
      return nameMatch || uidMatch || icoMatch;
    };

    const allFiltered = subjectOptions.filter(matchesSearch);
    const holdingSubjects = allFiltered.filter((s) => getAtkCategory(s) === "HOLDING");
    const clientSubjects = allFiltered.filter((s) => getAtkCategory(s) === "CLIENT");
    const networkSubjects = allFiltered.filter((s) => getAtkCategory(s) === "NETWORK");
    const hasRiskInCluster = subjectOptions.some((s) => s.hasRisk);
    const noResults = q && allFiltered.length === 0;

    const atkSections: { key: AtkCategory; subjects: typeof subjectOptions }[] = [
      { key: "HOLDING", subjects: holdingSubjects },
      { key: "CLIENT", subjects: clientSubjects },
      { key: "NETWORK", subjects: networkSubjects },
    ];

    const SubjectCardGrid = ({ s }: { s: SubjectOption }) => {
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
            s.isShadow
              ? "border-dashed border-border hover:bg-accent hover:border-primary/50"
              : s.hasRisk
              ? "border-destructive/60 bg-destructive/5 hover:bg-destructive/10"
              : "border-border hover:bg-accent hover:border-primary/50"
          }`}
          data-testid={`button-select-subject-${s.id}`}
        >
          <div className="flex items-center gap-1.5 w-full">
            {s.isShadow
              ? (isMinor ? <Baby className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> : <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />)
              : isMinor ? <Baby className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              : isCompany ? <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : null
            }
            {s.hasRisk && !s.isShadow && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
            <p className="font-medium text-sm truncate">{name}</p>
            <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">{subjectTypeLabelSk(s.type)}</p>
          {isMinor && <p className="text-xs text-blue-500">Neplnoletá osoba</p>}
          {s.isShadow && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Spravovaný profil</span>}
          {s.phone && <p className="text-xs font-mono text-muted-foreground">{formatPhone(s.phone)}</p>}
        </button>
      );
    };

    const SubjectRowList = ({ s }: { s: SubjectOption }) => {
      const name = s.firstName || s.lastName
        ? `${s.firstName || ""} ${s.lastName || ""}`.trim()
        : s.companyName || "Neznámy";
      const isMinor = s.isAdult === false && s.type === "person";
      const isCompany = s.type !== "person" && s.type !== "szco";
      const atkCat = getAtkCategory(s);
      const meta = ATK_SECTION_META[atkCat];
      const stripColor = s.isShadow ? meta.stripShadowClass : meta.stripClass;
      return (
        <button
          key={s.id}
          onClick={() => handleSelectSubject(s.id)}
          disabled={loading}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border transition-colors text-left overflow-hidden ${
            s.isShadow
              ? "border-dashed border-border hover:bg-accent"
              : s.hasRisk
              ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
              : "border-border hover:bg-accent hover:border-primary/30"
          }`}
          data-testid={`button-select-subject-${s.id}`}
        >
          <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${stripColor}`} />
          <div className="flex items-center gap-2 flex-shrink-0">
            {s.isShadow
              ? (isMinor ? <Baby className="w-3.5 h-3.5 text-blue-500" /> : <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />)
              : isMinor ? <Baby className="w-3.5 h-3.5 text-blue-500" />
              : isCompany ? <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              : s.hasRisk ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : null
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {subjectTypeLabelSk(s.type)}
              {s.isShadow && <span className="ml-1.5 text-muted-foreground/70">· Spravovaný</span>}
              {s.uid && <span className="ml-1.5 font-mono">{formatUid(s.uid)}</span>}
            </p>
          </div>
          {s.hasRisk && !s.isShadow && (
            <span className="text-xs text-destructive font-medium flex-shrink-0">Riziko</span>
          )}
          {isMinor && <span className="text-xs text-blue-500 flex-shrink-0">Neplnoletý</span>}
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      );
    };

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

            <div className="relative">
              <Input
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="Hľadať podľa mena alebo UID…"
                className="pl-3 pr-8 h-9 text-sm"
                data-testid="input-subject-search"
                autoComplete="off"
              />
              {subjectSearch && (
                <button
                  onClick={() => setSubjectSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-subject-search"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {renderError()}

            {noResults ? (
              <p className="text-sm text-center text-muted-foreground py-4">Žiadny subjekt nezodpovedá hľadaniu</p>
            ) : (
              <div className="space-y-4">
                {atkSections
                  .filter((section) => section.subjects.length > 0)
                  .map((section, idx) => {
                    const meta = ATK_SECTION_META[section.key];
                    return (
                      <div key={section.key} className="space-y-1.5">
                        {useListView ? (
                          <>
                            {idx > 0 && <div className="border-t border-border pt-1" />}
                            <div className={`flex items-center gap-1.5 px-0.5 pb-0.5 ${meta.colorClass}`}>
                              {meta.icon("w-3 h-3")}
                              <p className="text-xs font-semibold uppercase tracking-wide">{meta.label}</p>
                            </div>
                            <div className="space-y-1">
                              {section.subjects.map((s) => <SubjectRowList key={s.id} s={s} />)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={`flex items-center gap-1.5 px-1 ${meta.colorClass}`}>
                              {meta.icon("w-3.5 h-3.5")}
                              <p className="text-xs font-semibold uppercase tracking-wide">{meta.label}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {section.subjects.map((s) => <SubjectCardGrid key={s.id} s={s} />)}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
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
