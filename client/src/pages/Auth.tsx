import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, Mail, Eye, EyeOff, Phone, CheckCircle, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

type LoginStep = "credentials" | "subject_select" | "phone_verify";

interface SubjectOption {
  id: number;
  uid: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string | null;
}

interface SelectedSubject {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
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

  const [newPhone, setNewPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
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
      const res = await apiRequest("POST", "/api/login", {
        email: email.trim(),
        password,
      });
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
    try {
      const res = await apiRequest("POST", "/api/login/select-subject", { subjectId });
      const data = await res.json();
      if (data.selectedSubject) {
        setSelectedSubject(data.selectedSubject);
        setStep("phone_verify");
      }
    } catch (err: any) {
      setError("Chyba pri výbere identity");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/login/verify-phone", { confirmed: true });
      setPhoneConfirmed(true);
      setTimeout(async () => {
        await login({ email: email.trim(), password } as any);
      }, 500);
    } catch {
      setError("Chyba pri overení telefónu");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPhone.trim()) {
      setError("Zadajte nové telefónne číslo");
      return;
    }
    if (!smsCode.trim() || smsCode.length !== 6) {
      setError("SMS kód musí mať 6 číslic");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("POST", "/api/login/verify-phone", {
        confirmed: false,
        newPhone: newPhone.trim(),
        smsCode: smsCode.trim(),
      });
      setPhoneConfirmed(true);
      setTimeout(async () => {
        await login({ email: email.trim(), password } as any);
      }, 500);
    } catch (err: any) {
      setError("Chyba pri zmene telefónneho čísla");
    } finally {
      setLoading(false);
    }
  };

  const handleSendSms = () => {
    setSmsSent(true);
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

  if (step === "subject_select") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-subject-select-title">Vyberte identitu</h1>
                <p className="text-sm text-muted-foreground mt-1">K vášmu e-mailu je priradených viacero osôb</p>
              </div>
            </div>

            {renderError()}

            <div className="space-y-2">
              {subjectOptions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSubject(s.id)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-colors text-left"
                  data-testid={`button-select-subject-${s.id}`}
                >
                  <div>
                    <p className="font-medium">
                      {s.firstName} {s.lastName}
                    </p>
                    {s.companyName && (
                      <p className="text-sm text-muted-foreground">{s.companyName}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">{s.uid}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
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
                    onClick={handleSendSms}
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
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="pl-10"
                      autoFocus
                      data-testid="input-new-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smsCode">SMS overovací kód (6 číslic)</Label>
                  <Input
                    id="smsCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                  disabled={loading || smsCode.length !== 6}
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
