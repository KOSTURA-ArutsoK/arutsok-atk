import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useMyCompanies, useCreateMyCompany, useUpdateMyCompany, useDeleteMyCompany } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { Plus, Building2, Pencil, Trash2, Eye, Upload, FileText, X, Download, Clock, MapPin, FileCheck, Image } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak } from "@/lib/utils";
import { useToast as useToastCompanyDiv } from "@/hooks/use-toast";
import type { CompanyLogoHistory, Division } from "@shared/schema";

import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMyCompanySchema } from "@shared/schema";
import type { MyCompany, InsertMyCompany } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";


const COMPANY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nazov" },
  { key: "ico", label: "ICO" },
  { key: "specialization", label: "Zameranie" },
  { key: "city", label: "Mesto" },
  { key: "state", label: "Stat" },
];

const COMPANY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Nazov", type: "text" },
  { key: "ico", label: "ICO", type: "text" },
  { key: "specialization", label: "Zameranie", type: "text" },
  { key: "city", label: "Mesto", type: "text" },
];

const formSchema = insertMyCompanySchema.extend({
  name: z.string().min(1, "Nazov je povinny"),
  ico: z.string().min(1, "ICO je povinne"),
  dic: z.string().min(1, "DIC je povinne"),
  icDph: z.string().optional(),
  street: z.string().min(1, "Ulica je povinna"),
  streetNumber: z.string().min(1, "Popisne cislo je povinne"),
  orientNumber: z.string().min(1, "Orientacne cislo je povinne"),
  postalCode: z.string().min(1, "PSC je povinne"),
  city: z.string().min(1, "Mesto je povinne"),
  stateId: z.number({ required_error: "Stat je povinny" }),
  description: z.string().min(1, "Charakteristika je povinna"),
  specialization: z.string().min(1, "Zameranie je povinne"),
  code: z.string().min(1, "Kod je povinny").max(25, "Max 25 znakov"),
  foundedDate: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

type DocEntry = { name: string; url: string; uploadedAt: string };

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function FileUploadSection({
  companyId,
  section,
  docs,
  label,
  sublabel,
  readOnly,
}: {
  companyId: number | null;
  section: "official" | "work";
  docs: DocEntry[];
  label: string;
  sublabel: string;
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/my-companies/${companyId}/files/${section}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Subor nahrany", description: `${file.name} bol uspesne nahrany.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrat subor.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileUrl: string, fileName: string) {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/my-companies/${companyId}/files/${section}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Subor vymazany", description: `${fileName} bol odstraneny.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa vymazat subor.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-medium">{label}</h4>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        {!readOnly && companyId && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              data-testid={`input-file-${section}`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              data-testid={`button-upload-${section}`}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahravam..." : "Nahrat subor"}
            </Button>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground" data-testid={`text-no-files-${section}`}>
          {companyId
            ? "Ziadne subory. Kliknite na 'Nahrat subor'."
            : "Najprv ulozte firmu, potom mozete nahravat subory."}
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border"
              data-testid={`file-entry-${section}-${idx}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{doc.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDateSlovak(doc.uploadedAt)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(doc.url, "_blank")}
                  data-testid={`button-download-${section}-${idx}`}
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(doc.url, doc.name)}
                    data-testid={`button-delete-file-${section}-${idx}`}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyFormDialog({
  open,
  onOpenChange,
  editingCompanyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompanyId: number | null;
}) {
  const createMutation = useCreateMyCompany();
  const updateMutation = useUpdateMyCompany();
  const { data: allStates } = useStates();
  const { data: allCompanies } = useMyCompanies();
  const timerRef = useRef<number>(0);
  const [notesHtml, setNotesHtml] = useState("");
  const [platcaDph, setPlatcaDph] = useState(false);

  const editingCompany = editingCompanyId
    ? allCompanies?.find(c => c.id === editingCompanyId) || null
    : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      specialization: "SFA",
      code: "",
      ico: "",
      dic: "",
      icDph: "",
      street: "",
      streetNumber: "",
      orientNumber: "",
      postalCode: "",
      city: "",
      stateId: undefined,
      description: "",
      notes: "",
      foundedDate: null,
    },
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingCompany) {
        const hasIcDph = !!(editingCompany.icDph && editingCompany.icDph.trim());
        setPlatcaDph(hasIcDph);
        form.reset({
          name: editingCompany.name,
          specialization: editingCompany.specialization,
          code: editingCompany.code,
          ico: editingCompany.ico || "",
          dic: editingCompany.dic || "",
          icDph: editingCompany.icDph || "",
          street: editingCompany.street || "",
          streetNumber: editingCompany.streetNumber || "",
          orientNumber: editingCompany.orientNumber || "",
          postalCode: editingCompany.postalCode || "",
          city: editingCompany.city || "",
          stateId: editingCompany.stateId || undefined,
          description: editingCompany.description || "",
          notes: editingCompany.notes || "",
          foundedDate: (editingCompany as any).foundedDate ? new Date((editingCompany as any).foundedDate).toISOString().split("T")[0] : null,
        });
        setNotesHtml(editingCompany.notes || "");
      } else {
        setPlatcaDph(false);
        form.reset({
          name: "",
          specialization: "SFA",
          code: "",
          ico: "",
          dic: "",
          icDph: "",
          street: "",
          streetNumber: "",
          orientNumber: "",
          postalCode: "",
          city: "",
          stateId: undefined,
          description: "",
          notes: "",
          foundedDate: null,
        });
        setNotesHtml("");
      }
    }
  }, [open, editingCompany, form]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function onSubmit(data: FormData) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = { ...data, notes: notesHtml, processingTimeSec, foundedDate: data.foundedDate ? new Date(data.foundedDate).toISOString() : null };

    if (editingCompany) {
      updateMutation.mutate(
        { id: editingCompany.id, data: { ...payload, changeReason: "User edit" } },
        { onSuccess: () => handleOpenChange(false) }
      );
    } else {
      createMutation.mutate(payload as InsertMyCompany, {
        onSuccess: () => handleOpenChange(false),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const officialDocs = (editingCompany?.officialDocs as DocEntry[]) || [];
  const workDocs = (editingCompany?.workDocs as DocEntry[]) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {editingCompany ? "Upravit spolocnost" : "Pridat novu spolocnost"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="w-full justify-between">
                <TabsTrigger value="basic" data-testid="tab-basic">Zakladne udaje</TabsTrigger>
                <TabsTrigger value="address" data-testid="tab-address">Adresa</TabsTrigger>
                <TabsTrigger value="divisions" data-testid="tab-divisions">Divizie</TabsTrigger>
                <TabsTrigger value="docs" data-testid="tab-docs">Dokumenty</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Poznamky</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazov spolocnosti</FormLabel>
                    <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="specialization" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zameranie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-specialization">
                            <SelectValue placeholder="Vyberte zameranie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SFA">SFA (Financne sprostredkovanie)</SelectItem>
                          <SelectItem value="Reality">Reality</SelectItem>
                          <SelectItem value="Prenajom">Prenajom</SelectItem>
                          <SelectItem value="Weapons">Predaj zbrani</SelectItem>
                          <SelectItem value="Obchod">Obchod</SelectItem>
                          <SelectItem value="Poistenie">Zdravotne poistenie</SelectItem>
                          <SelectItem value="Dochodok">Dochodkove sporenie</SelectItem>
                          <SelectItem value="Ine">Ine</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod firmy</FormLabel>
                      <FormControl><Input {...field} maxLength={25} className="font-mono uppercase" data-testid="input-company-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="ico" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICO *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-ico" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DIC *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-dic" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={platcaDph}
                        onCheckedChange={(checked) => {
                          setPlatcaDph(checked);
                          if (!checked) form.setValue("icDph", "");
                        }}
                        data-testid="switch-platca-dph"
                      />
                      <span className="text-sm font-medium">Platca DPH</span>
                    </div>
                    {platcaDph && (
                      <FormField control={form.control} name="icDph" render={({ field }) => (
                        <FormItem>
                          <FormLabel>IC DPH *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} data-testid="input-icdph" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charakteristika (Cim sa firma zaobera) *</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={4} data-testid="input-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="foundedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum zalozenia spolocnosti</FormLabel>
                    <FormControl><Input type="date" value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="input-founded-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="address" className="space-y-4 mt-4">
                <FormField control={form.control} name="street" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica *</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-street" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="streetNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popisne cislo *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-street-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="orientNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orientacne cislo *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-orient-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PSC *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-postal-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mesto / Obec *</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-city" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="stateId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stat *</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(parseInt(val))}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Vyberte stat" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allStates?.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name} ({s.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="divisions" className="mt-4">
                <CompanyDivisionsTab companyId={editingCompany?.id || null} />
              </TabsContent>

              <TabsContent value="docs" className="mt-4 space-y-6">
                <FileUploadSection
                  companyId={editingCompany?.id || null}
                  section="official"
                  docs={officialDocs}
                  label="Sekcia A: Oficialne dokumenty"
                  sublabel="Zakladatelska listina, Vypis z OR, Zivnostensky list"
                />
                <Separator />
                <FileUploadSection
                  companyId={editingCompany?.id || null}
                  section="work"
                  docs={workDocs}
                  label="Sekcia B: Pracovne dokumenty"
                  sublabel="Priebezna dokumentacia, prilohy k poznamkam"
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Poznamkovy blok</label>
                  <RichTextEditor
                    content={notesHtml}
                    onChange={setNotesHtml}
                    placeholder="Zadajte poznamky k firme..."
                    data-testid="editor-notes"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
              {editingCompany && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Cas spracovania: {formatProcessingTime(editingCompany.processingTimeSec || 0)}</span>
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel">
                  Zrusit
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-save">
                  {isPending ? "Ukladam..." : "Ulozit"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDetailDialog({
  company,
  onClose,
  getStateName,
}: {
  company: MyCompany;
  onClose: () => void;
  getStateName: (id: number | null) => string;
}) {
  const officialDocs = (company.officialDocs as DocEntry[]) || [];
  const workDocs = (company.workDocs as DocEntry[]) || [];

  const addressParts = [
    company.street,
    company.streetNumber ? `${company.streetNumber}` : null,
    company.orientNumber ? `/ ${company.orientNumber}` : null,
  ].filter(Boolean).join(" ");

  const cityLine = [
    company.postalCode,
    company.city,
  ].filter(Boolean).join(" ");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-detail-company-name">{company.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary">{company.specialization}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{company.code}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full mt-2">
          <TabsList className="w-full justify-between">
            <TabsTrigger value="basic" data-testid="detail-tab-basic">Zakladne udaje</TabsTrigger>
            <TabsTrigger value="address" data-testid="detail-tab-address">Adresa</TabsTrigger>
            <TabsTrigger value="docs" data-testid="detail-tab-docs">Dokumenty</TabsTrigger>
            <TabsTrigger value="notes" data-testid="detail-tab-notes">Poznamky</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="ICO" value={company.ico} testId="text-detail-ico" />
              <InfoRow label="DIC" value={company.dic} testId="text-detail-dic" />
              <InfoRow label="IC DPH" value={company.icDph} testId="text-detail-icdph" />
              <InfoRow label="Zameranie" value={company.specialization} testId="text-detail-spec" />
              <InfoRow label="Kod firmy" value={company.code} mono testId="text-detail-code" />
              <InfoRow label="Datum zalozenia" value={(company as any).foundedDate ? formatDateSlovak((company as any).foundedDate) : "-"} testId="text-detail-founded-date" />
            </div>
            {company.description && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">Cim sa firma zaobera</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-detail-description">{company.description}</p>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Clock className="w-3 h-3" />
              <span>Cas spracovania: {formatProcessingTime(company.processingTimeSec || 0)}</span>
              <span>|</span>
              <span>Vytvorene: {formatDateSlovak(company.createdAt)}</span>
              <span>|</span>
              <span>Aktualizovane: {formatDateSlovak(company.updatedAt)}</span>
            </div>
          </TabsContent>

          <TabsContent value="address" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-1">
                  <p data-testid="text-detail-address">{addressParts || "Nezadana adresa"}</p>
                  <p className="text-muted-foreground" data-testid="text-detail-city">{cityLine || "-"}</p>
                  <p data-testid="text-detail-state">{getStateName(company.stateId)}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia A: Oficialne dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{officialDocs.length}</Badge>
              </div>
              {officialDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Ziadne oficialne dokumenty</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {officialDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border" data-testid={`detail-file-official-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateSlovak(doc.uploadedAt)}</span>
                      <Button size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-detail-download-official-${idx}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Sekcia B: Pracovne dokumenty</h4>
                <Badge variant="secondary" className="ml-auto">{workDocs.length}</Badge>
              </div>
              {workDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">Ziadne pracovne dokumenty</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {workDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border" data-testid={`detail-file-work-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateSlovak(doc.uploadedAt)}</span>
                      <Button size="icon" variant="ghost" onClick={() => window.open(doc.url, "_blank")} data-testid={`button-detail-download-work-${idx}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            {company.notes ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-md border border-border"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(company.notes) }}
                data-testid="text-detail-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-detail-notes">Ziadne poznamky</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LogoHistoryDialog({
  company,
  onClose,
}: {
  company: MyCompany | null;
  onClose: () => void;
}) {
  const { data: history } = useQuery<CompanyLogoHistory[]>({
    queryKey: ["/api/my-companies", company?.id, "logo-history"],
    queryFn: async () => {
      const res = await fetch(`/api/my-companies/${company!.id}/logo-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!company,
  });

  if (!company) return null;

  return (
    <Dialog open={!!company} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="text-logo-history-title">Historia log - {company.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-logo-history">Ziadna historia log</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 border border-border rounded-md" data-testid={`logo-history-entry-${entry.id}`}>
                <div className="w-12 h-12 rounded-md border border-border overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {entry.logoUrl ? (
                    <img src={entry.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.originalName || "Logo"}</p>
                  <p className="text-xs text-muted-foreground">
                    Nahradene: {formatDateTimeSlovak(entry.replacedAt)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(entry.logoUrl, "_blank")}
                  data-testid={`button-view-old-logo-${entry.id}`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, mono, testId }: { label: string; value: string | null | undefined; mono?: boolean; testId?: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm ${mono ? "font-mono" : ""}`} data-testid={testId}>{value || "-"}</p>
    </div>
  );
}

export default function Companies() {
  const { data: companies, isLoading } = useMyCompanies();
  const { data: allStates } = useStates();
  const deleteMutation = useDeleteMyCompany();
  const tableFilter = useSmartFilter(companies || [], COMPANY_FILTER_COLUMNS, "companies");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("companies", COMPANY_COLUMNS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyCompany | null>(null);
  const [viewTarget, setViewTarget] = useState<MyCompany | null>(null);
  const [logoHistoryTarget, setLogoHistoryTarget] = useState<MyCompany | null>(null);

  function openCreate() {
    setEditingCompanyId(null);
    setDialogOpen(true);
  }

  function openEdit(company: MyCompany) {
    setEditingCompanyId(company.id);
    setDialogOpen(true);
  }

  function getStateName(stateId: number | null) {
    if (!stateId || !allStates) return "-";
    return allStates.find(s => s.id === stateId)?.name || "-";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-companies-title">Zoznam spolocnosti</h2>
          <p className="text-sm text-muted-foreground mt-1">Sprava vaseho portfelia firiem.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={openCreate} data-testid="button-add-company">
            <Plus className="w-4 h-4 mr-2" />
            Pridat novu spolocnost
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov</TableHead>}
                {columnVisibility.isVisible("ico") && <TableHead sortKey="ico" sortDirection={sortKey === "ico" ? sortDirection : null} onSort={requestSort}>ICO</TableHead>}
                {columnVisibility.isVisible("specialization") && <TableHead sortKey="specialization" sortDirection={sortKey === "specialization" ? sortDirection : null} onSort={requestSort}>Zameranie</TableHead>}
                {columnVisibility.isVisible("city") && <TableHead sortKey="city" sortDirection={sortKey === "city" ? sortDirection : null} onSort={requestSort}>Mesto</TableHead>}
                {columnVisibility.isVisible("state") && <TableHead>Stat</TableHead>}
                <TableHead className="w-[160px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!companies || companies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
                    Ziadne spolocnosti nenajdene. Kliknite na "Pridat novu spolocnost".
                  </TableCell>
                </TableRow>
              )}
              {sortedData.map(company => (
                <TableRow key={company.id} data-testid={`row-company-${company.id}`} onRowClick={() => openEdit(company)}>
                  {columnVisibility.isVisible("name") && <TableCell className="font-medium">{company.name}</TableCell>}
                  {columnVisibility.isVisible("ico") && <TableCell className="font-mono text-xs">{company.ico || "-"}</TableCell>}
                  {columnVisibility.isVisible("specialization") && <TableCell>
                    <Badge variant="secondary">{company.specialization}</Badge>
                  </TableCell>}
                  {columnVisibility.isVisible("city") && <TableCell>{company.city || "-"}</TableCell>}
                  {columnVisibility.isVisible("state") && <TableCell>{getStateName(company.stateId)}</TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewTarget(company)} data-testid={`button-view-${company.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setLogoHistoryTarget(company)} data-testid={`button-logo-history-${company.id}`} title="Historia log">
                        <Image className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(company)} data-testid={`button-edit-${company.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(company)} data-testid={`button-delete-${company.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CompanyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingCompanyId={editingCompanyId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat spolocnost?</AlertDialogTitle>
            <AlertDialogDescription>
              Spolocnost "{deleteTarget?.name}" bude presunuty do archivu. Tato akcia je vratna cez administratora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Vymazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewTarget && (
        <CompanyDetailDialog
          company={viewTarget}
          onClose={() => setViewTarget(null)}
          getStateName={getStateName}
        />
      )}

      <LogoHistoryDialog
        company={logoHistoryTarget}
        onClose={() => setLogoHistoryTarget(null)}
      />
    </div>
  );
}

function CompanyDivisionsTab({ companyId }: { companyId: number | null }) {
  const { toast } = useToastCompanyDiv();
  const [selectedDivisionId, setSelectedDivisionId] = useState("");

  const { data: companyDivisions, isLoading } = useQuery<any[]>({
    queryKey: [`/api/companies/${companyId}/divisions`],
    enabled: !!companyId,
  });

  const { data: allDivisions } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
    enabled: !!companyId,
  });

  const linkedDivisionIds = (companyDivisions || []).map((cd: any) => cd.division?.id || cd.divisionId);
  const availableDivisions = (allDivisions || []).filter(d => d.isActive && !linkedDivisionIds.includes(d.id));

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/companies/${companyId}/divisions`, { divisionId: parseInt(selectedDivisionId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/divisions`] });
      toast({ title: "Uspech", description: "Divizia priradena" });
      setSelectedDivisionId("");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa priradit diviziu", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (linkId: number) => apiRequest("DELETE", `/api/company-divisions/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/divisions`] });
      toast({ title: "Uspech", description: "Prepojenie odstranene" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa odstranit prepojenie", variant: "destructive" }),
  });

  if (!companyId) {
    return <div className="text-sm text-muted-foreground py-4">Najprv ulozte spolocnost, potom priradite divizie.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
          <SelectTrigger className="flex-1" data-testid="select-company-division">
            <SelectValue placeholder="Vyberte diviziu na priradenie" />
          </SelectTrigger>
          <SelectContent>
            {availableDivisions.map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.name}{d.code ? ` (${d.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!selectedDivisionId || addMutation.isPending}
          size="sm"
          data-testid="button-add-division-to-company"
        >
          <Plus className="w-4 h-4 mr-1" /> Priradit
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-2">Nacitavam...</div>
      ) : !(companyDivisions || []).length ? (
        <div className="text-center text-muted-foreground py-2">Ziadne priradene divizie</div>
      ) : (
        <div className="space-y-2">
          {(companyDivisions || []).map((link: any) => (
            <div key={link.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <span className="font-medium" data-testid={`text-company-division-${link.id}`}>{link.division?.name || "-"}</span>
                {link.division?.code && <Badge variant="secondary" className="ml-2 font-mono">{link.division.code}</Badge>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(link.id)} data-testid={`button-remove-division-${link.id}`}>
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
