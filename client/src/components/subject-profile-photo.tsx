import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, History, Check, User, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SubjectPhoto {
  id: number;
  subjectId: number;
  fileName: string;
  filePath: string;
  source: string;
  sourceDocumentId: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string | null;
}

interface SubjectProfilePhotoProps {
  subjectId: number;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  showHistory?: boolean;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sourceLabel(s: string) {
  switch (s) {
    case "manual": return "Manuálne";
    case "id_card": return "Občiansky preukaz";
    case "passport": return "Pas";
    case "document": return "Dokument";
    default: return s;
  }
}

export function SubjectProfilePhoto({ subjectId, size = "md", editable = false, showHistory = false }: SubjectProfilePhotoProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const { data: activePhoto } = useQuery<SubjectPhoto | null>({
    queryKey: ["/api/subjects", subjectId, "active-photo"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/active-photo`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!subjectId,
  });

  const { data: allPhotos } = useQuery<SubjectPhoto[]>({
    queryKey: ["/api/subjects", subjectId, "photos"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/photos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!subjectId && historyOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, cropFace, source }: { file: File; cropFace: boolean; source: string }) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("cropFace", String(cropFace));
      formData.append("source", source);
      const res = await fetch(`/api/subjects/${subjectId}/photos/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "active-photo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects/batch-photos"] });
      toast({ title: "Fotka nahraná" });
    },
    onError: () => toast({ title: "Chyba pri nahrávaní fotky", variant: "destructive" }),
  });

  const docUploadMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("documentType", documentType);
      const res = await fetch(`/api/subjects/${subjectId}/photos/from-document`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "active-photo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects/batch-photos"] });
      toast({ title: "Fotka z dokumentu spracovaná" });
    },
    onError: () => toast({ title: "Chyba pri spracovaní dokumentu", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const res = await apiRequest("PATCH", `/api/subjects/${subjectId}/photos/${photoId}/activate`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "active-photo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects/batch-photos"] });
      toast({ title: "Fotka aktivovaná" });
    },
  });

  const handleManualUpload = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate({ file, cropFace: false, source: "manual" });
    }
    e.target.value = "";
  };

  const handleDocUpload = (docType: string) => {
    const input = docInputRef.current;
    if (input) {
      input.setAttribute("data-doc-type", docType);
      input.click();
    }
  };

  const handleDocFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = (e.target as any).getAttribute("data-doc-type") || "id_card";
    if (file) {
      docUploadMutation.mutate({ file, documentType: docType });
    }
    e.target.value = "";
  };

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses[size]} rounded-full border-2 border-zinc-600 bg-zinc-800 overflow-hidden flex items-center justify-center cursor-pointer group relative`}
        onClick={editable ? handleManualUpload : undefined}
        data-testid="subject-profile-photo"
      >
        {activePhoto?.filePath ? (
          <img
            src={activePhoto.filePath}
            alt="Profilová fotka"
            className="w-full h-full object-cover"
          />
        ) : (
          <User className={`${size === "sm" ? "w-4 h-4" : size === "md" ? "w-8 h-8" : "w-12 h-12"} text-zinc-500`} />
        )}
        {editable && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className={`${size === "sm" ? "w-3 h-3" : "w-5 h-5"} text-white`} />
          </div>
        )}
      </div>

      {size !== "sm" && (
        <div className="flex gap-1 mt-1">
          {editable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[9px]"
                onClick={handleManualUpload}
                data-testid="btn-upload-photo"
              >
                <Upload className="w-3 h-3 mr-0.5" />
                Nahrať
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[9px]"
                onClick={() => handleDocUpload("id_card")}
                data-testid="btn-upload-from-op"
              >
                <ImageIcon className="w-3 h-3 mr-0.5" />
                Z OP
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[9px]"
                onClick={() => handleDocUpload("passport")}
                data-testid="btn-upload-from-pas"
              >
                <ImageIcon className="w-3 h-3 mr-0.5" />
                Z Pasu
              </Button>
            </>
          )}
          {showHistory && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[9px]"
              onClick={() => setHistoryOpen(true)}
              data-testid="btn-photo-history"
            >
              <History className="w-3 h-3 mr-0.5" />
              Archív
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDocFileSelected}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Archív identít – História fotografií</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {(!allPhotos || allPhotos.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Žiadne fotky v archíve</p>
            ) : (
              allPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className={`flex items-center gap-3 p-2 rounded border ${photo.isActive ? "border-green-700 bg-green-950/30" : "border-zinc-700 bg-zinc-900/50"}`}
                  data-testid={`photo-history-item-${photo.id}`}
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-zinc-600 shrink-0">
                    <img src={photo.filePath} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{sourceLabel(photo.source)}</Badge>
                      {photo.isActive && (
                        <Badge className="text-[10px] bg-green-800 text-green-200">Aktívna</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Platná od: {formatDate(photo.validFrom)}
                      {photo.validTo && ` do: ${formatDate(photo.validTo)}`}
                    </div>
                  </div>
                  {!photo.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => activateMutation.mutate(photo.id)}
                      data-testid={`btn-activate-photo-${photo.id}`}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Aktivovať
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SubjectPhotoThumbnail({ subjectId, photoPath }: { subjectId: number; photoPath?: string }) {
  if (!photoPath) {
    return (
      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center shrink-0" data-testid={`thumb-photo-${subjectId}`}>
        <User className="w-3.5 h-3.5 text-zinc-500" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-600 shrink-0" data-testid={`thumb-photo-${subjectId}`}>
      <img src={photoPath} alt="" className="w-full h-full object-cover" />
    </div>
  );
}
