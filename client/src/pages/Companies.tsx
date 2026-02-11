import { useState, useRef, useCallback } from "react";
import { useMyCompanies, useCreateMyCompany, useUpdateMyCompany, useDeleteMyCompany } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { Plus, Building2, Pencil, Trash2, Eye } from "lucide-react";
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

const formSchema = insertMyCompanySchema.extend({
  name: z.string().min(1, "Nazov je povinny"),
  specialization: z.string().min(1, "Zameranie je povinne"),
  code: z.string().min(1, "Kod je povinny").max(4, "Max 4 znaky"),
});

type FormData = z.infer<typeof formSchema>;

function CompanyFormDialog({
  open,
  onOpenChange,
  editingCompany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompany: MyCompany | null;
}) {
  const createMutation = useCreateMyCompany();
  const updateMutation = useUpdateMyCompany();
  const { data: allStates } = useStates();
  const timerRef = useRef<number>(0);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingCompany?.name || "",
      specialization: editingCompany?.specialization || "SFA",
      code: editingCompany?.code || "",
      ico: editingCompany?.ico || "",
      dic: editingCompany?.dic || "",
      icDph: editingCompany?.icDph || "",
      street: editingCompany?.street || "",
      streetNumber: editingCompany?.streetNumber || "",
      orientNumber: editingCompany?.orientNumber || "",
      postalCode: editingCompany?.postalCode || "",
      city: editingCompany?.city || "",
      stateId: editingCompany?.stateId || undefined,
      description: editingCompany?.description || "",
      notes: editingCompany?.notes || "",
    },
  });

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      timerRef.current = performance.now();
      if (editingCompany) {
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
        });
      } else {
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
        });
      }
    }
    onOpenChange(isOpen);
  }, [editingCompany, form, onOpenChange]);

  function onSubmit(data: FormData) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = { ...data, processingTimeSec };

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {editingCompany ? "Upravit spolocnost" : "Pridat novu spolocnost"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="basic" data-testid="tab-basic">Zakladne</TabsTrigger>
                <TabsTrigger value="address" data-testid="tab-address">Adresa</TabsTrigger>
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
                          <SelectItem value="SFA">SFA (Financie)</SelectItem>
                          <SelectItem value="Reality">Reality</SelectItem>
                          <SelectItem value="Weapons">Obchod / Zbrane</SelectItem>
                          <SelectItem value="Obchod">Obchod</SelectItem>
                          <SelectItem value="Poistenie">Zdravotne poistenie</SelectItem>
                          <SelectItem value="Dochodok">Dochodkove sporenie</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod firmy</FormLabel>
                      <FormControl><Input {...field} maxLength={4} className="font-mono uppercase" data-testid="input-company-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="ico" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICO</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-ico" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DIC</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-dic" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="icDph" render={({ field }) => (
                    <FormItem>
                      <FormLabel>IC DPH</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-icdph" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cim sa firma zaobera</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={3} data-testid="input-description" /></FormControl>
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="address" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="street" render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Ulica</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-street" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="streetNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popisne cislo</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-street-number" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="orientNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orientacne cislo</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-orient-number" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PSC</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-postal-code" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mesto / Obec</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-city" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="stateId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stat</FormLabel>
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
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="docs" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sekcia A: Oficialne dokumenty</h4>
                    <p className="text-xs text-muted-foreground">Zakladatelska listina, Vypis z OR, atd.</p>
                    <div className="mt-2 p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground">
                      Nahratie suborov bude dostupne v dalsej verzii
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sekcia B: Pracovne dokumenty</h4>
                    <p className="text-xs text-muted-foreground">Priebezna dokumentacia a prilohy.</p>
                    <div className="mt-2 p-6 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground">
                      Nahratie suborov bude dostupne v dalsej verzii
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poznamkovy blok</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        rows={8}
                        className="text-sm"
                        data-testid="input-notes"
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel">
                Zrusit
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save">
                {isPending ? "Ukladam..." : "Ulozit"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Companies() {
  const { data: companies, isLoading } = useMyCompanies();
  const { data: allStates } = useStates();
  const deleteMutation = useDeleteMyCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<MyCompany | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyCompany | null>(null);
  const [viewTarget, setViewTarget] = useState<MyCompany | null>(null);

  function openCreate() {
    setEditingCompany(null);
    setDialogOpen(true);
  }

  function openEdit(company: MyCompany) {
    setEditingCompany(company);
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
        <Button onClick={openCreate} data-testid="button-add-company">
          <Plus className="w-4 h-4 mr-2" />
          Pridat novu spolocnost
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazov</TableHead>
                <TableHead>ICO</TableHead>
                <TableHead>Zameranie</TableHead>
                <TableHead>Mesto</TableHead>
                <TableHead>Stat</TableHead>
                <TableHead className="w-[120px]">Akcie</TableHead>
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
              {companies?.map(company => (
                <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="font-mono text-xs">{company.ico || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{company.specialization}</Badge>
                  </TableCell>
                  <TableCell>{company.city || "-"}</TableCell>
                  <TableCell>{getStateName(company.stateId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewTarget(company)} data-testid={`button-view-${company.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(company)} data-testid={`button-edit-${company.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(company)} data-testid={`button-delete-${company.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CompanyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingCompany={editingCompany} />

      {/* Delete confirmation */}
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

      {/* View detail dialog */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewTarget?.name}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="basic">Zakladne</TabsTrigger>
                <TabsTrigger value="address">Adresa</TabsTrigger>
                <TabsTrigger value="notes">Poznamky</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">ICO:</span> {viewTarget.ico || "-"}</div>
                  <div><span className="text-muted-foreground">DIC:</span> {viewTarget.dic || "-"}</div>
                  <div><span className="text-muted-foreground">IC DPH:</span> {viewTarget.icDph || "-"}</div>
                  <div><span className="text-muted-foreground">Zameranie:</span> {viewTarget.specialization}</div>
                  <div><span className="text-muted-foreground">Kod:</span> <span className="font-mono">{viewTarget.code}</span></div>
                </div>
                {viewTarget.description && (
                  <div className="pt-2">
                    <span className="text-muted-foreground">Popis:</span>
                    <p className="mt-1">{viewTarget.description}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="address" className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Ulica:</span> {viewTarget.street || "-"} {viewTarget.streetNumber || ""}/{viewTarget.orientNumber || ""}</div>
                  <div><span className="text-muted-foreground">PSC:</span> {viewTarget.postalCode || "-"}</div>
                  <div><span className="text-muted-foreground">Mesto:</span> {viewTarget.city || "-"}</div>
                  <div><span className="text-muted-foreground">Stat:</span> {getStateName(viewTarget.stateId)}</div>
                </div>
              </TabsContent>
              <TabsContent value="notes" className="mt-4 text-sm">
                <p className="whitespace-pre-wrap">{viewTarget.notes || "Ziadne poznamky"}</p>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
