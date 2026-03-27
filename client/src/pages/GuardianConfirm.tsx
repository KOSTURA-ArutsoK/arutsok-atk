import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, CheckCircle, ShieldCheck, ShieldX, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageState = "loading" | "confirm" | "sms" | "done" | "rejected" | "error";

interface TokenInfo {
  tokenId: number;
  guardianName: string;
  guardianEmail: string;
  targetName: string;
  needsSms: boolean;
  emailConfirmed: boolean;
  smsConfirmed: boolean;
  expiresAt: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); if (b?.message) msg = b.message; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export default function GuardianConfirm() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setPageState("error"); setError("Chýba overovací token v URL"); return; }
    apiFetch<TokenInfo>(`/api/guardian-confirm?token=${encodeURIComponent(token)}`)
      .then((info) => {
        setTokenInfo(info);
        if (info.emailConfirmed && (!info.needsSms || info.smsConfirmed)) {
          setPageState("done");
        } else if (info.emailConfirmed && info.needsSms) {
          setPageState("sms");
        } else {
          setPageState("confirm");
        }
      })
      .catch((err) => {
        setError(err?.message || "Token neexistuje alebo vypršal");
        setPageState("error");
      });
  }, [token]);

  async function handleConfirm() {
    if (!tokenInfo) return;
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ status: string }>("/api/guardian-confirm/confirm", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (result.status === "confirmed") {
        setPageState("done");
      } else if (result.status === "sms_required") {
        setPageState("sms");
      }
    } catch (err: any) {
      setError(err?.message || "Chyba pri potvrdení");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (smsCode.trim().length !== 6) { setError("SMS kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      await apiFetch("/api/guardian-confirm/verify-sms", {
        method: "POST",
        body: JSON.stringify({ token, smsCode: smsCode.trim() }),
      });
      setPageState("done");
    } catch (err: any) {
      setError(err?.message || "Nesprávny SMS kód");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/guardian-confirm/reject", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setPageState("rejected");
    } catch (err: any) {
      setError(err?.message || "Chyba pri odmietnutí");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8 space-y-6">
          <div className="text-center mb-2">
            <h1 className="text-lg font-bold text-foreground tracking-tight">ArutsoK (ATK)</h1>
            <p className="text-xs text-muted-foreground">Systém správy finančných služieb</p>
          </div>

          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Overujem žiadosť...</span>
            </div>
          )}

          {pageState === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-base font-semibold text-foreground">Žiadosť neplatná</h2>
                <p className="text-sm text-muted-foreground">{error || "Tento odkaz nie je platný alebo vypršal."}</p>
              </div>
            </div>
          )}

          {pageState === "confirm" && tokenInfo && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-foreground">Žiadosť o opatrovníctvo</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tento používateľ žiada o prístup k správe vášho účtu:
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Správca (žiadateľ):</p>
                  <p className="text-sm font-semibold text-foreground" data-testid="text-guardian-name">{tokenInfo.guardianName}</p>
                  <p className="text-xs text-muted-foreground">{tokenInfo.guardianEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Váš účet:</p>
                  <p className="text-sm font-medium text-foreground">{tokenInfo.targetName}</p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
                Potvrdením udeľujete tejto osobe právo spravovať váš účet — môže sa prihlasovať a konať vo vašom mene. Opatrovníctvo môžete kedykoľvek zrušiť.
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleReject}
                  disabled={loading}
                  data-testid="button-guardian-reject"
                >
                  <ShieldX className="w-4 h-4 mr-1" />
                  Odmietnuť
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={loading}
                  data-testid="button-guardian-confirm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                  Potvrdiť
                </Button>
              </div>
            </div>
          )}

          {pageState === "sms" && tokenInfo && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-foreground">Overenie SMS kódom</h2>
                  <p className="text-sm text-muted-foreground mt-1">Email bol potvrdený. Zadajte SMS kód zaslaný na vaše telefónne číslo.</p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifySms} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-code">6-ciferný SMS kód</Label>
                  <Input
                    id="sms-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl font-mono tracking-widest"
                    autoFocus
                    data-testid="input-guardian-sms"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || smsCode.trim().length !== 6} data-testid="button-guardian-verify-sms">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Potvrdiť SMS
                </Button>
              </form>
            </div>
          )}

          {pageState === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-guardian-done">Opatrovníctvo potvrdené</h2>
                <p className="text-sm text-muted-foreground">
                  Správca teraz môže spravovať váš účet. Opatrovníctvo môžete kedykoľvek zrušiť v nastaveniach účtu.
                </p>
              </div>
            </div>
          )}

          {pageState === "rejected" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShieldX className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-guardian-rejected">Žiadosť odmietnutá</h2>
                <p className="text-sm text-muted-foreground">Žiadosť o opatrovníctvo bola odmietnutá. Žiadateľ bol informovaný.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
