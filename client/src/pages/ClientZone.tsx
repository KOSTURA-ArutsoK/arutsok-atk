import { Shield, User, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ClientZone() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg" data-testid="text-client-zone-title">Osobna zona</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">ArutsoK CRM</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-md bg-primary/5 border border-border">
            <Shield className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Osobna zona klienta</p>
              <p className="text-xs text-muted-foreground">
                Tato sekcia je urcena pre registrovanych klientov. Tu budete moct spravovat vase udaje, sledovat stav vasich zaznamov a komunikovat s vasou spolocnostou.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Funkcionality klientskej zony su pripravovane.
          </p>
          <Link href="/">
            <Button variant="outline" className="w-full" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Spat na prihlasenie
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
