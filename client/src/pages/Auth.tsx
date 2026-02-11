import { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthPage() {
  const [idleMessage, setIdleMessage] = useState<string | null>(null);

  useEffect(() => {
    const msg = sessionStorage.getItem("idle_logout_message");
    if (msg) {
      setIdleMessage(msg);
      sessionStorage.removeItem("idle_logout_message");
    }
  }, []);

  const handleLogin = () => {
    window.location.href = "/api/login";
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
              <h1 className="text-xl font-bold">ArutsoK CRM</h1>
              <p className="text-sm text-muted-foreground mt-1">Prihlaste sa pre pristup do systemu</p>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            className="w-full"
            data-testid="button-login"
          >
            <Lock className="w-4 h-4 mr-2" />
            Prihlasit sa cez Replit
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Vsetky aktivity su monitorovane a logovane.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
