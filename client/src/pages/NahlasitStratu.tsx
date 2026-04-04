import { useState } from "react";
import { Shield, Mail, CheckCircle, AlertTriangle, ChevronLeft, LogOut } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

const REASON_MESSAGES: Record<string, string> = {
  invalid: "Neplatný odkaz.",
  notfound: "Token nebol nájdený. Odkaz je neplatný.",
  used: "Tento odkaz bol už použitý.",
  expired: "Platnosť odkazu vypršala (30 minút). Požiadajte o nový.",
  server: "Nastala serverová chyba. Skúste znova.",
};

export default function NahlasitStratu() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const status = params.get("status");
  const reason = params.get("reason") ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await apiRequest("POST", "/api/auth/emergency-logout", { email: email.trim() });
      setSubmitted(true);
    } catch {
      setErrorMsg("Nastala chyba. Skúste znova.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "confirmed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-confirmed-title">Odhlásenie dokončené</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Váš účet bol úspešne odhlásený zo všetkých zariadení.
                </p>
              </div>
            </div>
            <Link href="/">
              <Button className="w-full" data-testid="button-go-to-login">
                Prihlásiť sa znova
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    const message = REASON_MESSAGES[reason] ?? "Nastala neznáma chyba.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-error-title">Chyba</h1>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-error-message">{message}</p>
              </div>
            </div>
            <Link href="/nahlasit-stratu">
              <Button variant="outline" className="w-full" data-testid="button-try-again">
                Skúsiť znova
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="w-full text-sm" data-testid="button-back-to-login-error">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na prihlásenie
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-success-title">Skontrolujte e-mail</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Ak sa e-mail nachádza v systéme, odoslali sme potvrdzovací odkaz. Skontrolujte svoju schránku.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
              Odkaz je platný <strong>30 minút</strong>. Kliknite naň a odhlásenie prebehne okamžite. Ak e-mail nedostanete, skontrolujte priečinok Spam.
            </div>

            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-back-to-login-success">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na prihlásenie
              </Button>
            </Link>
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
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-md bg-destructive/10 flex items-center justify-center mx-auto">
                <LogOut className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-emergency-logout-title">Núdzové odhlásenie</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Ak ste stratili prístup k zariadeniu alebo máte podozrenie na neoprávnený prístup, odhlásime váš účet zo všetkých zariadení.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emergency-email">E-mailová adresa</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="emergency-email"
                    type="email"
                    placeholder="Zadajte váš e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                    autoFocus
                    data-testid="input-emergency-email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Odošleme jednorazový odkaz (platný 30 minút). Odhlásenie nastane automaticky po kliknutí naň.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-destructive hover:bg-destructive/90 text-white"
                disabled={loading || !email.trim()}
                data-testid="button-send-emergency-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loading ? "Odosielajú sa..." : "Odoslať potvrdzovací e-mail"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2" data-testid="link-back-to-login">
            <ChevronLeft className="w-3 h-3 inline mr-0.5" />
            Späť na prihlásenie
          </Link>
        </div>
      </div>
    </div>
  );
}
