import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Subject } from "@shared/schema";
import { SubjectProfileModuleC } from "@/components/subject-profile-module-c";
import { Loader2, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfilSubjektu() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get("id");

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  const subject = subjectId ? subjects?.find(s => s.id === parseInt(subjectId)) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="profil-loading">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subjectId || !subject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4" data-testid="profil-no-subject">
        <Users className="w-12 h-12 text-muted-foreground/30" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Žiadny subjekt nie je vybraný</p>
          <p className="text-xs text-muted-foreground/70">Vyberte subjekt zo Zoznamu klientov pre zobrazenie jeho profilu.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/subjects")} data-testid="btn-go-to-subjects">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Prejsť na Zoznam klientov
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" data-testid="profil-subjektu-page">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/subjects")} data-testid="btn-back-to-list">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Späť na zoznam
        </Button>
        <span className="text-xs text-muted-foreground">|</span>
        <span className="text-sm font-medium">{subject.companyName || `${subject.firstName || ""} ${subject.lastName || ""}`.trim() || subject.uid}</span>
      </div>
      <SubjectProfileModuleC subject={subject} />
    </div>
  );
}
