import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Subject } from "@shared/schema";
import { SubjectProfileModuleC } from "@/components/subject-profile-module-c";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const EMPTY_SUBJECT: Subject = {
  id: 0,
  uid: "",
  type: "person",
  linkedFoId: null,
  firstName: "",
  lastName: "",
  companyName: null,
  continentId: null,
  stateId: null,
  myCompanyId: null,
  email: null,
  phone: null,
  birthNumber: null,
  idCardNumber: null,
  kikId: null,
  iban: null,
  swift: null,
  commissionLevel: null,
  details: {},
  uiPreferences: { summary_fields: {} },
  processingTimeSec: 0,
  isActive: true,
  isDeceased: false,
  listStatus: null,
  listStatusChangedBy: null,
  listStatusChangedAt: null,
  listStatusReason: null,
  bonitaPoints: 0,
  cgnRating: null,
  registeredByUserId: null,
  isAnonymized: false,
  anonymizedAt: null,
  anonymizedByUserId: null,
  anonymizedData: null,
  supplementaryIndex: null,
  createdAt: new Date(),
  deletedAt: null,
} as Subject;

export default function ProfilSubjektu() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get("id");

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    enabled: !!subjectId,
  });

  const subject = useMemo(() => {
    if (!subjectId) return EMPTY_SUBJECT;
    return subjects?.find(s => s.id === parseInt(subjectId)) || null;
  }, [subjectId, subjects]);

  if (subjectId && isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="profil-loading">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subjectId && !isLoading && !subject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4" data-testid="profil-not-found">
        <p className="text-sm text-muted-foreground">Subjekt s ID {subjectId} nebol nájdený.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/subjects")} data-testid="btn-go-to-subjects">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Prejsť na Zoznam klientov
        </Button>
      </div>
    );
  }

  const resolvedSubject = subject || EMPTY_SUBJECT;

  return (
    <div className="p-4 space-y-4" data-testid="profil-subjektu-page">
      {subjectId && (
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/subjects")} data-testid="btn-back-to-list">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Späť na zoznam
          </Button>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-sm font-medium">
            {resolvedSubject.companyName || `${resolvedSubject.firstName || ""} ${resolvedSubject.lastName || ""}`.trim() || resolvedSubject.uid}
          </span>
        </div>
      )}
      <SubjectProfileModuleC subject={resolvedSubject} />
    </div>
  );
}
