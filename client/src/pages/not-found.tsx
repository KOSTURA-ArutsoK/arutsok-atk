import { ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground font-mono">
      <ShieldAlert className="w-24 h-24 text-destructive mb-6" />
      <h1 className="text-4xl font-bold mb-2" data-testid="text-404-title">404 - PRISTUP ZAMIETNUTY</h1>
      <p className="text-muted-foreground mb-8" data-testid="text-404-description">Pozadovany zdroj neexistuje alebo nemate dostatocne opravnenia.</p>
      <Link href="/">
        <Button variant="outline" className="border-primary text-primary" data-testid="button-back-dashboard">
          Spat na prehlad
        </Button>
      </Link>
    </div>
  );
}
