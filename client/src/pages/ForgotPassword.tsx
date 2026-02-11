import { Shield, ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Zabudnute heslo</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">ArutsoK CRM</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Prihlasenie do systemu ArutsoK CRM prebieha cez Replit autentifikaciu. Ak mate problemy s pristupom, kontaktujte vasho administratora.
          </p>
          <Link href="/">
            <Button variant="outline" className="w-full" data-testid="button-back-to-login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Spat na prihlasenie
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
