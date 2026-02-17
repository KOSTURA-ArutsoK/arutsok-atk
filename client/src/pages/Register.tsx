import { useState, useRef, useCallback } from "react";
import { Shield, ArrowLeft, Mail, Phone, KeyRound, ShieldCheck, UserCheck, AlertTriangle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
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
  const [idCardNumber, setIdCardNumber] = useState("");

  const [clientData, setClientData] = useState<ClientData | null>(null);

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
      setStep("welcome");
    } catch {
      setError("Chyba pripojenia k serveru");
    } finally {
      setLoading(false);
    }
  }

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
                      onChange={(e) => setPhone(e.target.value)}
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
                      const cleanVal = e.target.value.replace(/[^0-9]/g, "");
                      if (cleanVal.length >= 9 && cleanVal.length <= 10) {
                        setTimeout(() => {
                          const idCardInput = document.getElementById("id-card");
                          if (idCardInput) idCardInput.focus();
                        }, 50);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const idCardInput = document.getElementById("id-card");
                        if (idCardInput) idCardInput.focus();
                      }
                    }}
                    className="font-mono"
                    data-testid="input-full-birth-number"
                  />
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
                    {clientData.phone || "—"}
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
