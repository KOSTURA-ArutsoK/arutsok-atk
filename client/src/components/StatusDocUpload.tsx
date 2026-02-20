import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Upload, X, FileText, Image, File as FileIcon, Grid3X3, List, Tag, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type FileWithMeta = {
  file: File;
  hash: string;
  isDuplicate: boolean;
};

function fileKey(f: File): string {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-red-400" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return <Image className="w-5 h-5 text-blue-400" />;
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return <FileText className="w-5 h-5 text-blue-600" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileText className="w-5 h-5 text-green-500" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type StatusDocUploadHandle = {
  getFileHashes: () => Record<string, string>;
};

type StatusDocUploadProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  contractId?: number | null;
  renamePrefix: string;
  onRenamePrefixChange: (v: string) => void;
};

const StatusDocUpload = forwardRef<StatusDocUploadHandle, StatusDocUploadProps>(({
  files,
  onFilesChange,
  contractId,
  renamePrefix,
  onRenamePrefixChange,
}, ref) => {
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [fileMetas, setFileMetas] = useState<FileWithMeta[]>([]);
  const [hashingProgress, setHashingProgress] = useState<{ current: number; total: number } | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hashMapRef = useRef<Map<string, string>>(new Map());

  useImperativeHandle(ref, () => ({
    getFileHashes: () => {
      const result: Record<string, string> = {};
      for (const meta of fileMetas) {
        if (!meta.isDuplicate) {
          const key = `${meta.file.name}::${meta.file.size}::${meta.file.lastModified}`;
          result[key] = meta.hash;
        }
      }
      return result;
    },
  }), [fileMetas]);

  useEffect(() => {
    if (files.length === 0 && fileMetas.length > 0) {
      setFileMetas([]);
      setSkippedCount(0);
      hashMapRef.current.clear();
      return;
    }
    const fileSet = new Set(files.map(f => fileKey(f)));
    const currentMetas = fileMetas.filter(m => fileSet.has(fileKey(m.file)));
    if (currentMetas.length !== fileMetas.length) {
      setFileMetas(currentMetas);
    }
  }, [files]);

  const processNewFiles = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    setHashingProgress({ current: 0, total: newFiles.length });

    const processed: FileWithMeta[] = [];
    const existingHashes = new Set(fileMetas.map(m => m.hash));
    let skipped = 0;

    const BATCH_SIZE = 5;
    for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
      const batch = newFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const hash = await computeSHA256(file);
          return { file, hash };
        })
      );

      for (const { file, hash } of results) {
        if (existingHashes.has(hash)) {
          skipped++;
          continue;
        }
        existingHashes.add(hash);
        hashMapRef.current.set(fileKey(file), hash);
        processed.push({
          file,
          hash,
          isDuplicate: false,
        });
      }

      setHashingProgress({ current: Math.min(i + batch.length, newFiles.length), total: newFiles.length });
    }

    if (contractId && processed.length > 0) {
      try {
        const newHashes = processed.map(p => p.hash);
        const res = await fetch(`/api/contracts/${contractId}/check-doc-duplicates`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hashes: newHashes }),
        });
        if (res.ok) {
          const { duplicates } = await res.json();
          const dupSet = new Set(duplicates as string[]);
          for (const p of processed) {
            if (dupSet.has(p.hash)) {
              p.isDuplicate = true;
              skipped++;
            }
          }
        }
      } catch {}
    }

    setSkippedCount(prev => prev + skipped);
    const nonDups = processed.filter(p => !p.isDuplicate);

    setFileMetas(prev => [...prev, ...processed]);
    onFilesChange([...files, ...nonDups.map(p => p.file)]);
    setHashingProgress(null);
  }, [fileMetas, files, contractId, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processNewFiles(droppedFiles);
  }, [processNewFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processNewFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processNewFiles]);

  const removeFile = useCallback((index: number) => {
    const meta = fileMetas[index];
    if (!meta) return;
    const newMetas = fileMetas.filter((_, i) => i !== index);
    setFileMetas(newMetas);
    hashMapRef.current.delete(fileKey(meta.file));
    const newFiles = files.filter(f => fileKey(f) !== fileKey(meta.file));
    onFilesChange(newFiles);
  }, [fileMetas, files, onFilesChange]);

  const readyFiles = fileMetas.filter(m => !m.isDuplicate);
  const dupFiles = fileMetas.filter(m => m.isDuplicate);

  return (
    <div className="space-y-3" data-testid="status-doc-upload">
      <div
        className={cn(
          "border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-area"
      >
        <Upload className={cn("w-8 h-8 mx-auto mb-2", dragActive ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-medium">
          {dragActive ? "Pustite subory sem" : "Potiahnite subory sem alebo kliknite"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, obrazky, dokumenty - neobmedzene mnozstvo naraz
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          accept="*/*"
          data-testid="input-file-multi"
        />
      </div>

      {hashingProgress && (
        <div className="space-y-1" data-testid="hashing-progress">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzujem subory... {hashingProgress.current}/{hashingProgress.total}</span>
          </div>
          <Progress value={(hashingProgress.current / hashingProgress.total) * 100} className="h-1.5" />
        </div>
      )}

      {skippedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-500" data-testid="text-skipped-duplicates">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Preskocených {skippedCount} duplicitných suborov</span>
        </div>
      )}

      {fileMetas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs" data-testid="badge-file-count">
                {readyFiles.length} {readyFiles.length === 1 ? "subor" : readyFiles.length < 5 ? "subory" : "suborov"}
              </Badge>
              {dupFiles.length > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground" data-testid="badge-dup-count">
                  {dupFiles.length} duplicit
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("toggle-elevate", viewMode === "grid" && "toggle-elevated")}
                onClick={(e) => { e.stopPropagation(); setViewMode("grid"); }}
                data-testid="button-view-grid"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("toggle-elevate", viewMode === "list" && "toggle-elevated")}
                onClick={(e) => { e.stopPropagation(); setViewMode("list"); }}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="Prefix pre premenovanie (napr. podklady_421)"
              value={renamePrefix}
              onChange={e => onRenamePrefixChange(e.target.value)}
              className="text-sm h-8"
              data-testid="input-rename-prefix"
            />
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" data-testid="files-grid-view">
              {fileMetas.map((meta, idx) => (
                <div
                  key={`fg-${fileKey(meta.file)}`}
                  className={cn(
                    "relative border rounded-md p-2 flex flex-col items-center gap-1 group",
                    meta.isDuplicate
                      ? "border-muted bg-muted/30 opacity-60"
                      : "border-border"
                  )}
                  data-testid={`file-grid-item-${idx}`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0.5 right-0.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ visibility: "visible" }}
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    data-testid={`button-remove-grid-${idx}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <div className="w-10 h-10 flex items-center justify-center">
                    {getFileIcon(meta.file.name)}
                  </div>
                  <span className="text-[10px] text-center truncate w-full" title={meta.file.name}>
                    {renamePrefix ? `${renamePrefix}_${meta.file.name}` : meta.file.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {formatFileSize(meta.file.size)}
                  </span>
                  {meta.isDuplicate ? (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">Duplicita</Badge>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                      <span className="text-[9px] text-green-500">Novy</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1" data-testid="files-list-view">
              {fileMetas.map((meta, idx) => (
                <div
                  key={`fl-${fileKey(meta.file)}`}
                  className={cn(
                    "flex items-center justify-between gap-2 p-2 border rounded-md",
                    meta.isDuplicate
                      ? "border-muted bg-muted/30 opacity-60"
                      : "border-border"
                  )}
                  data-testid={`file-list-item-${idx}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(meta.file.name)}
                    <div className="min-w-0">
                      <span className="text-sm truncate block" title={meta.file.name}>
                        {renamePrefix ? `${renamePrefix}_${meta.file.name}` : meta.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(meta.file.size)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {meta.isDuplicate ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Duplicita</Badge>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] text-green-500">Novy</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      data-testid={`button-remove-list-${idx}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

StatusDocUpload.displayName = "StatusDocUpload";
export default StatusDocUpload;
