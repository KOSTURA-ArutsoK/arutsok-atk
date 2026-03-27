import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldCheck, ShieldX, Loader2, MessageSquare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageState = "loading" | "sms" | "done" | "rejected" | "error";

interface TokenInfo {
  tokenId: number;
  guardianName: string;
  guardianEmail: string;
  targetName: string;
  needsSms: boolean;
  emailConfirmed: boolean;
  smsConfirmed: boolean;
  expiresAt: string;
  status: "confirmed" | "sms_required";
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
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setPageState("error"); setError("Chýba overovací token v URL"); return; }
    // GET endpoint auto-confirms email upon access — per spec, link click = email confirmation
    apiFetch<TokenInfo>(`/api/account-link/guardian-confirm?token=${encodeURIComponent(token)}`)
      .then((info) => {
        setTokenInfo(info);
        if (info.status === "confirmed") {
          setPageState("done");
        } else {
          setPageState("sms");
        }
      })
      .catch((err) => {
        setError(err?.message || "Token neexistuje alebo vypršal");
        setPageState("error");
      });
  }, [token]);

  async function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (smsCode.trim().length !== 6) { setError("SMS kód musí mať 6 číslic"); return; }
    setLoading(true);
    try {
      await apiFetch("/api/account-link/guardian-verify-sms", {
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
      await apiFetch(`/api/account-link/guardian-reject?token=${encodeURIComponent(token)}`, { method: "POST" });
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

          {pageState === "sms" && tokenInfo && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-foreground">Overenie SMS kódom</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Používateľ <strong>{tokenInfo.guardianName}</strong> žiada o správu vášho účtu. Zadajte SMS kód zaslaný na vaše telefónne číslo.
                  </p>
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

              <div className="pt-1">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
                  onClick={handleReject}
                  disabled={loading}
                  data-testid="button-guardian-reject"
                >
                  <ShieldX className="w-4 h-4 mr-1" />
                  Odmietnuť žiadosť
                </Button>
              </div>
            </div>
          )}

          {pageState === "done" && tokenInfo && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-guardian-done">Opatrovníctvo potvrdené</h2>
                <p className="text-sm text-muted-foreground">
                  <strong>{tokenInfo.guardianName}</strong> teraz môže spravovať váš účet.
                </p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground text-left mt-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Opatrovníctvo môžete kedykoľvek zrušiť v nastaveniach prepojených účtov.</span>
                </div>
              </div>
            </div>
          )}

          {pageState === "done" && !tokenInfo && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-guardian-done">Opatrovníctvo potvrdené</h2>
                <p className="text-sm text-muted-foreground">Správca teraz môže spravovať váš účet.</p>
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
                <p className="text-sm text-muted-foreground">Žiadosť o opatrovníctvo bola odmietnutá.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
