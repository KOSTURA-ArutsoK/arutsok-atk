import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { isAdmin as checkIsAdmin } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileDown, Trash2, Upload, Loader2, Download,
  FileText, FileSpreadsheet, FileImage, File,
} from "lucide-react";
import type { DownloadableDocument } from "@shared/schema";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-red-400 shrink-0" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-green-400 shrink-0" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return <FileImage className="w-5 h-5 text-blue-400 shrink-0" />;
  if (["doc", "docx"].includes(ext)) return <FileText className="w-5 h-5 text-blue-300 shrink-0" />;
  return <File className="w-5 h-5 text-muted-foreground shrink-0" />;
}

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDrag, setIsDrag] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Vyber súbor");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name || file.name);
      fd.append("description", description);
      const res = await fetch("/api/downloadable-documents", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Chyba nahrávania");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloadable-documents"] });
      toast({ title: "Dokument nahraný", description: name || file?.name || "" });
      handleClose();
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  function handleClose() {
    setFile(null);
    setName("");
    setDescription("");
    onClose();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); if (!name) setName(f.name); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-base font-semibold flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Nahrať dokument
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Súbor bude dostupný na stiahnutie pre všetkých používateľov.
        </DialogDescription>

        <div className="space-y-4 mt-2">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDrag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <FileIcon fileName={file.name} />
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span className="text-muted-foreground text-xs shrink-0">({formatFileSize(file.size)})</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Upload className="w-6 h-6" />
                <p className="text-sm font-medium">Pretiahni súbor alebo klikni</p>
                <p className="text-xs">PDF, Word, Excel, obrázky</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              data-testid="input-file-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); if (!name) setName(f.name); }
              }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="doc-name" className="text-xs font-medium">Názov dokumentu</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Napr. Vzor zmluvy 2025"
              data-testid="input-doc-name"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="doc-desc" className="text-xs font-medium">Popis (voliteľný)</Label>
            <Input
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krátky popis obsahu dokumentu"
              data-testid="input-doc-description"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={mutation.isPending}>
              Zrušiť
            </Button>
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={!file || mutation.isPending}
              data-testid="button-upload-submit"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Nahrať
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DokumentyNaStiahnutie() {
  const { data: appUser, isLoading: userLoading } = useAppUser();
  const isAdmin = !userLoading && checkIsAdmin(appUser);
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: docs = [], isLoading } = useQuery<DownloadableDocument[]>({
    queryKey: ["/api/downloadable-documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/downloadable-documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Chyba mazania");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloadable-documents"] });
      toast({ title: "Dokument bol odstránený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Dokument sa nepodarilo odstrániť.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileDown className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Dokumenty na stiahnutie</h1>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            data-testid="button-add-document"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Nahrať dokument
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Načítavam dokumenty…</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <FileDown className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Zatiaľ žiadne dokumenty</p>
          {isAdmin && (
            <p className="text-xs">Nahrajte prvý dokument tlačidlom vyššie alebo cez Kokpit.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              data-testid={`card-document-${doc.id}`}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
            >
              <FileIcon fileName={doc.fileName} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" data-testid={`text-doc-name-${doc.id}`}>
                  {doc.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {doc.description && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{doc.description}</p>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(doc.fileSize)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(doc.createdAt).toLocaleDateString("sk-SK")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={doc.fileUrl}
                  download={doc.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`button-download-${doc.id}`}
                >
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1">
                    <Download className="w-3.5 h-3.5" />
                    Stiahnuť
                  </Button>
                </a>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-document-${doc.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
