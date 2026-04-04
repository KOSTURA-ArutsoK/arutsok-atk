import { useState } from "react";
import { Shield, Mail, CheckCircle, AlertTriangle, ChevronLeft, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

type PageState = "form" | "success" | "confirming" | "confirmed" | "error";

export default function NahlasitStratu() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const confirmToken = params.get("confirm");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await apiRequest("POST", "/api/auth/emergency-logout", { email: email.trim() });
      setPageState("success");
    } catch {
      setErrorMsg("Nastala chyba. Skúste znova.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmToken) return;
    setLoading(true);
    setPageState("confirming");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auth/emergency-logout/confirm?token=${encodeURIComponent(confirmToken)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPageState("confirmed");
      } else {
        setErrorMsg(data.message || "Token je neplatný alebo vypršal.");
        setPageState("error");
      }
    } catch {
      setErrorMsg("Nastala chyba. Skúste znova.");
      setPageState("error");
    } finally {
      setLoading(false);
    }
  };

  if (confirmToken && pageState === "form") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <LogOut className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-confirm-logout-title">Núdzové odhlásenie</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Kliknutím odhlásíte váš účet zo všetkých zariadení.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              Táto akcia okamžite zneplatní všetky aktívne relácie pre váš účet.
            </div>

            <Button
              onClick={handleConfirm}
              className="w-full bg-destructive hover:bg-destructive/90 text-white"
              disabled={loading}
              data-testid="button-confirm-emergency-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {loading ? "Odhlasovanie..." : "Odhlásiť zo všetkých zariadení"}
            </Button>

            <Link href="/login">
              <Button variant="ghost" className="w-full text-sm" data-testid="button-back-to-login-confirm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na prihlásenie
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "confirming") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Odhlasovanie prebieha...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "confirmed") {
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
            <Button
              onClick={() => navigate("/")}
              className="w-full"
              data-testid="button-go-to-login"
            >
              Prihlásiť sa znova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="pt-8 pb-6 px-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Chyba</h1>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg || "Nastala neznáma chyba."}</p>
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

  if (pageState === "success") {
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
                  Ak sa e-mail nachádza v systéme, odoslali sme potvrdzovací odkaz na odhlásenie. Skontrolujte svoju schránku.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
              Odkaz je platný <strong>2 hodiny</strong>. Ak e-mail nedostanete, skontrolujte priečinok Nevyžiadaná pošta (Spam).
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
                  Odošleme potvrdzovací odkaz na tento e-mail. Odhlásenie nastane až po kliknutí na odkaz.
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
