import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import type { ContractTemplate } from "@shared/schema";
import { Plus, Pencil, Trash2, Upload, FileText, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProcessingSaveButton } from "@/components/processing-save-button";

function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate: ContractTemplate | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [productType, setProductType] = useState("");
  const [stateId, setStateId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contract-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Uspech", description: "Sablona vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit sablonu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-templates/${editingTemplate?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Uspech", description: "Sablona aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat sablonu", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editingTemplate) {
        setName(editingTemplate.name || "");
        setDescription(editingTemplate.description || "");
        setContent(editingTemplate.content || "");
        setProductType(editingTemplate.productType || "");
        setStateId(editingTemplate.stateId?.toString() || "");
        setIsActive(editingTemplate.isActive ?? true);
      } else {
        setName("");
        setDescription("");
        setContent("");
        setProductType("");
        setStateId(activeStateId?.toString() || "");
        setIsActive(true);
      }
    }
  }, [open, editingTemplate, activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      description: description || null,
      content: content || null,
      productType: productType || null,
      stateId: stateId ? parseInt(stateId) : null,
      isActive,
    };

    if (editingTemplate) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-template-dialog-title">
            {editingTemplate ? "Upravit sablonu" : "Pridat sablonu"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nazov sablony"
              data-testid="input-template-name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Popis sablony"
              rows={3}
              data-testid="input-template-description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Obsah sablony</label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Text sablony..."
              rows={6}
              data-testid="input-template-content"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Typ produktu</label>
              <Input
                value={productType}
                onChange={e => setProductType(e.target.value)}
                placeholder="Typ produktu"
                data-testid="input-template-product-type"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Stat</label>
              <Select value={stateId} onValueChange={setStateId}>
                <SelectTrigger data-testid="select-template-state">
                  <SelectValue placeholder="Vyberte stat" />
                </SelectTrigger>
                <SelectContent>
                  {allStates?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              data-testid="checkbox-template-active"
            />
            <label className="text-sm font-medium cursor-pointer">Aktivna sablona</label>
          </div>

          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-template-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: ContractTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contract-templates/${template.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Uspech", description: "Sablona vymazana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat sablonu", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat sablonu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat sablonu <span className="font-semibold text-foreground">{template.name}</span>? Tuto akciu nie je mozne vratit.
          </p>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
              Zrusit
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mazem...
                </>
              ) : (
                "Vymazat"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractTemplates() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ContractTemplate | null>(null);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const { data: templates, isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/contract-templates/${id}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Uspech", description: "Subor nahany" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa nahrat subor", variant: "destructive" }),
  });

  function openCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function openEdit(template: ContractTemplate) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  function openDelete(template: ContractTemplate) {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }

  function handleFileUpload(templateId: number, file: File) {
    uploadMutation.mutate({ id: templateId, file });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sprava sablon</h1>
        <Button onClick={openCreate} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />
          Pridat sablonu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !templates || templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-templates">
              Ziadne sablony
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Typ produktu</TableHead>
                  <TableHead className="w-24">Stav</TableHead>
                  <TableHead>Subor</TableHead>
                  <TableHead className="w-40 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                    <TableCell data-testid={`text-template-name-${template.id}`}>
                      {template.name}
                    </TableCell>
                    <TableCell data-testid={`text-template-product-type-${template.id}`}>
                      {template.productType || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={template.isActive ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}
                        data-testid={`badge-template-active-${template.id}`}
                      >
                        {template.isActive ? "Aktivna" : "Neaktivna"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-template-file-${template.id}`}>
                      {template.fileOriginalName && template.fileUrl ? (
                        <a
                          href={template.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          data-testid={`link-template-file-${template.id}`}
                        >
                          <FileText className="w-4 h-4" />
                          {template.fileOriginalName}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <input
                          type="file"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[template.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(template.id, file);
                              e.target.value = "";
                            }
                          }}
                          data-testid={`input-file-upload-${template.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => fileInputRefs.current[template.id]?.click()}
                          disabled={uploadMutation.isPending}
                          data-testid={`button-upload-file-${template.id}`}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(template)}
                          data-testid={`button-edit-template-${template.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDelete(template)}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTemplate={editingTemplate}
        activeStateId={activeStateId}
      />

      {deletingTemplate && (
        <DeleteTemplateDialog
          template={deletingTemplate}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
