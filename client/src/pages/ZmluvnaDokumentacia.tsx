import { useState } from "react";
import { useLocation } from "wouter";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, FolderOpen, Loader2 } from "lucide-react";

export default function ZmluvnaDokumentacia() {
  const [location] = useLocation();
  const { data: appUser } = useAppUser();
  const isPridat = location === "/zmluvna-dokumentacia/pridat";

  if (isPridat) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Pridať dokumenty</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Plus className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Nahrávanie zmluvnej dokumentácie</p>
            <p className="text-sm mt-2">Táto sekcia bude čoskoro dostupná.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Zmluvná dokumentácia</h1>
        </div>
        <Button onClick={() => window.location.href = "/zmluvna-dokumentacia/pridat"} data-testid="button-pridat-dokumenty">
          <Plus className="w-4 h-4 mr-2" />
          Pridať dokumenty
        </Button>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Zoznam zmluvnej dokumentácie</p>
          <p className="text-sm mt-2">Zatiaľ žiadne dokumenty. Táto sekcia bude čoskoro dostupná.</p>
        </CardContent>
      </Card>
    </div>
  );
}
