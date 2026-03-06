import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleMessage, setIdleMessage] = useState<string | null>(null);
  const { login, isLoggingIn } = useAuth();

  useEffect(() => {
    const msg = sessionStorage.getItem("idle_logout_message");
    if (msg) {
      setIdleMessage(msg);
      sessionStorage.removeItem("idle_logout_message");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Zadajte meno a heslo");
      return;
    }

    try {
      await login({ username: username.trim(), password });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("401")) {
        setError("Nesprávne meno alebo heslo");
      } else {
        setError("Chyba pri prihlásení. Skúste znova.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
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
              <p className="text-sm text-muted-foreground mt-1">Prihlaste sa pre pristup do systemu</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="text-login-error">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Meno</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Zadajte prihlasovacie meno"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                  autoFocus
                  data-testid="input-username"
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
              className="w-full bg-emerald-600 text-white border-emerald-700"
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              <Lock className="w-4 h-4 mr-2" />
              {isLoggingIn ? "Prihlasovanie..." : "Prihlasit sa"}
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
