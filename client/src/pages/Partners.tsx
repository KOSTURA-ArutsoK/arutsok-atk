import { useState, useRef, useCallback } from "react";
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner, usePartnerContracts, usePartnerContacts, usePartnerProducts, useCreatePartnerContract, useCreatePartnerContact, useCreatePartnerProduct } from "@/hooks/use-partners";
import { useMyCompanies } from "@/hooks/use-companies";
import { Plus, Briefcase, Pencil, Trash2, Eye, Clock, FileText, Users, Package, Link2, X, Calendar, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { insertPartnerSchema } from "@shared/schema";
import type { Partner, InsertPartner } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RichTextEditor } from "@/components/rich-text-editor";

const partnerFormSchema = insertPartnerSchema.extend({
  name: z.string().min(1, "Nazov je povinny"),
});

type PartnerFormData = z.infer<typeof partnerFormSchema>;

function PartnerFormDialog({
  open,
  onOpenChange,
  editingPartnerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPartnerId: number | null;
}) {
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const { data: allPartners } = usePartners();
  const timerRef = useRef<number>(0);
  const [notesHtml, setNotesHtml] = useState("");

  const editingPartner = editingPartnerId
    ? allPartners?.find(p => p.id === editingPartnerId) || null
    : null;

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      name: "",
      code: "",
      notes: "",
    },
  });

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      timerRef.current = performance.now();
      if (editingPartner) {
        form.reset({
          name: editingPartner.name,
          code: editingPartner.code || "",
          notes: editingPartner.notes || "",
        });
        setNotesHtml(editingPartner.notes || "");
      } else {
        form.reset({ name: "", code: "", notes: "" });
        setNotesHtml("");
      }
    }
    onOpenChange(isOpen);
  }, [editingPartner, form, onOpenChange]);

  function onSubmit(data: PartnerFormData) {
    const payload = { ...data, notes: notesHtml };

    if (editingPartner) {
      updateMutation.mutate(
        { id: editingPartner.id, data: { ...payload, changeReason: "User edit" } },
        { onSuccess: () => handleOpenChange(false) }
      );
    } else {
      createMutation.mutate(payload as InsertPartner, {
        onSuccess: () => handleOpenChange(false),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-partner-dialog-title">
            {editingPartner ? "Upravit partnera" : "Pridat noveho partnera"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nazov partnera</FormLabel>
                <FormControl><Input {...field} data-testid="input-partner-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Kod partnera</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} maxLength={10} className="font-mono uppercase" data-testid="input-partner-code" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Poznamky</label>
              <RichTextEditor
                content={notesHtml}
                onChange={setNotesHtml}
                placeholder="Zadajte poznamky k partnerovi..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-partner-cancel">
                Zrusit
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-partner-save">
                {isPending ? "Ukladam..." : "Ulozit"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PartnerDetailDialog({
  partner,
  onClose,
}: {
  partner: Partner;
  onClose: () => void;
}) {
  const { data: contracts } = usePartnerContracts(partner.id);
  const { data: pContacts } = usePartnerContacts(partner.id);
  const { data: pProducts } = usePartnerProducts(partner.id);
  const { data: companies } = useMyCompanies();
  const createContract = useCreatePartnerContract();
  const createContact = useCreatePartnerContact();
  const createProduct = useCreatePartnerProduct();

  const [newContractCompanyId, setNewContractCompanyId] = useState<string>("");
  const [newContractNumber, setNewContractNumber] = useState("");
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactPosition, setNewContactPosition] = useState("");
  const [newContactValidFrom, setNewContactValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [newContactValidTo, setNewContactValidTo] = useState("");
  const [showArchivedContacts, setShowArchivedContacts] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductType, setNewProductType] = useState("Financny");
  const [newProductCode, setNewProductCode] = useState("");

  function handleAddContract() {
    if (!newContractCompanyId) return;
    createContract.mutate({
      partnerId: partner.id,
      data: { companyId: parseInt(newContractCompanyId), contractNumber: newContractNumber, partnerId: partner.id },
    });
    setNewContractCompanyId("");
    setNewContractNumber("");
  }

  function handleAddContact() {
    if (!newContactFirst || !newContactLast) return;
    const contactData: any = { 
      firstName: newContactFirst, lastName: newContactLast, email: newContactEmail, 
      phone: newContactPhone, position: newContactPosition, partnerId: partner.id,
      validFrom: newContactValidFrom ? new Date(newContactValidFrom).toISOString() : new Date().toISOString(),
    };
    if (newContactValidTo) {
      contactData.validTo = new Date(newContactValidTo).toISOString();
    }
    createContact.mutate({ partnerId: partner.id, data: contactData });
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactPosition("");
    setNewContactValidFrom(new Date().toISOString().split("T")[0]);
    setNewContactValidTo("");
  }

  function handleAddProduct() {
    if (!newProductName) return;
    createProduct.mutate({
      partnerId: partner.id,
      data: { name: newProductName, productType: newProductType, code: newProductCode, partnerId: partner.id },
    });
    setNewProductName("");
    setNewProductCode("");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-partner-detail-name">{partner.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {partner.code && <Badge variant="secondary" className="font-mono">{partner.code}</Badge>}
                {partner.uid && <span className="text-xs font-mono text-muted-foreground">{partner.uid}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full mt-2">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="info" data-testid="partner-tab-info">Info</TabsTrigger>
            <TabsTrigger value="contracts" data-testid="partner-tab-contracts">Zmluvy</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="partner-tab-contacts">Kontakty</TabsTrigger>
            <TabsTrigger value="products" data-testid="partner-tab-products">Produkty</TabsTrigger>
            <TabsTrigger value="notes" data-testid="partner-tab-notes">Poznamky</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">UID</span>
                <p className="text-sm font-mono">{partner.uid || "-"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Kod</span>
                <p className="text-sm font-mono">{partner.code || "-"}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Clock className="w-3 h-3" />
              <span>Vytvorene: {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString("sk-SK") : "-"}</span>
              <span>|</span>
              <span>Aktualizovane: {partner.updatedAt ? new Date(partner.updatedAt).toLocaleDateString("sk-SK") : "-"}</span>
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Zmluvy s mojimi spolocnostami</h4>
              <Badge variant="secondary" className="ml-auto">{contracts?.length || 0}</Badge>
            </div>
            {contracts && contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`contract-${c.id}`}>
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">{companies?.find(co => co.id === c.companyId)?.name || `ID: ${c.companyId}`}</span>
                    {c.contractNumber && <span className="text-xs font-mono text-muted-foreground">{c.contractNumber}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Ziadne zmluvy</p>
            )}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Pridat zmluvu</h4>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newContractCompanyId} onValueChange={setNewContractCompanyId}>
                  <SelectTrigger data-testid="select-contract-company">
                    <SelectValue placeholder="Vyberte spolocnost" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.filter(c => !c.isDeleted).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Cislo zmluvy"
                  value={newContractNumber}
                  onChange={e => setNewContractNumber(e.target.value)}
                  data-testid="input-contract-number"
                />
              </div>
              <Button type="button" size="sm" onClick={handleAddContract} disabled={!newContractCompanyId} data-testid="button-add-contract">
                <Plus className="w-4 h-4 mr-1" /> Pridat zmluvu
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Externy kontakty partnera</h4>
              <Badge variant="secondary" className="ml-auto">{pContacts?.filter(c => c.isActive !== false).length || 0} aktivnych</Badge>
            </div>
            {(() => {
              const activeContacts = pContacts?.filter(c => c.isActive !== false) || [];
              const archivedContacts = pContacts?.filter(c => c.isActive === false) || [];
              return (
                <>
                  {activeContacts.length > 0 ? (
                    <div className="space-y-2">
                      {activeContacts.map(c => (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`pcontact-${c.id}`}>
                          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{c.titleBefore ? `${c.titleBefore} ` : ""}{c.firstName} {c.lastName}{c.titleAfter ? `, ${c.titleAfter}` : ""}</p>
                            <p className="text-xs text-muted-foreground">{c.position || ""} {c.email ? `| ${c.email}` : ""} {c.phone ? `| ${c.phone}` : ""}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Od: {c.validFrom ? new Date(c.validFrom).toLocaleDateString("sk-SK") : "-"}</span>
                              <span>Do: {c.validTo ? new Date(c.validTo).toLocaleDateString("sk-SK") : "Neurcito"}</span>
                            </div>
                          </div>
                          {c.isPrimary && <Badge variant="secondary">Primarny</Badge>}
                          <Badge variant="outline">SL{c.securityLevel}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Ziadne aktivne kontakty</p>
                  )}
                  {archivedContacts.length > 0 && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowArchivedContacts(!showArchivedContacts)}
                        data-testid="button-toggle-archived-contacts"
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        {showArchivedContacts ? "Skryt archiv" : `Zobrazit archiv (${archivedContacts.length})`}
                      </Button>
                      {showArchivedContacts && archivedContacts.map(c => (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border/50 text-sm opacity-60" data-testid={`pcontact-archived-${c.id}`}>
                          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{c.titleBefore ? `${c.titleBefore} ` : ""}{c.firstName} {c.lastName}{c.titleAfter ? `, ${c.titleAfter}` : ""}</p>
                            <p className="text-xs text-muted-foreground">{c.position || ""} {c.email ? `| ${c.email}` : ""} {c.phone ? `| ${c.phone}` : ""}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Od: {c.validFrom ? new Date(c.validFrom).toLocaleDateString("sk-SK") : "-"}</span>
                              <span>Do: {c.validTo ? new Date(c.validTo).toLocaleDateString("sk-SK") : "-"}</span>
                            </div>
                          </div>
                          <Badge variant="secondary">Archivovany</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Pridat kontakt</h4>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Meno" value={newContactFirst} onChange={e => setNewContactFirst(e.target.value)} data-testid="input-contact-first" />
                <Input placeholder="Priezvisko" value={newContactLast} onChange={e => setNewContactLast(e.target.value)} data-testid="input-contact-last" />
                <Input placeholder="Email" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} data-testid="input-contact-email" />
                <Input placeholder="Telefon" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} data-testid="input-contact-phone" />
                <Input placeholder="Pozicia" value={newContactPosition} onChange={e => setNewContactPosition(e.target.value)} className="col-span-2" data-testid="input-contact-position" />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Aktivny od</label>
                  <Input type="date" value={newContactValidFrom} onChange={e => setNewContactValidFrom(e.target.value)} data-testid="input-contact-valid-from" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Aktivny do (prazdne = neurcito)</label>
                  <Input type="date" value={newContactValidTo} onChange={e => setNewContactValidTo(e.target.value)} data-testid="input-contact-valid-to" />
                </div>
              </div>
              <Button type="button" size="sm" onClick={handleAddContact} disabled={!newContactFirst || !newContactLast} data-testid="button-add-contact">
                <Plus className="w-4 h-4 mr-1" /> Pridat kontakt
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Katalog produktov partnera</h4>
              <Badge variant="secondary" className="ml-auto">{pProducts?.length || 0}</Badge>
            </div>
            {pProducts && pProducts.length > 0 ? (
              <div className="space-y-2">
                {pProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-sm" data-testid={`pproduct-${p.id}`}>
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.code && <p className="text-xs font-mono text-muted-foreground">{p.code}</p>}
                    </div>
                    <Badge variant="outline">{p.productType}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Ziadne produkty</p>
            )}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Pridat produkt</h4>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Nazov produktu" value={newProductName} onChange={e => setNewProductName(e.target.value)} data-testid="input-product-name" />
                <Select value={newProductType} onValueChange={setNewProductType}>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Financny">Financny</SelectItem>
                    <SelectItem value="Realitny">Realitny</SelectItem>
                    <SelectItem value="Poistny">Poistny</SelectItem>
                    <SelectItem value="Iny">Iny</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Kod" value={newProductCode} onChange={e => setNewProductCode(e.target.value)} className="font-mono" data-testid="input-product-code" />
              </div>
              <Button type="button" size="sm" onClick={handleAddProduct} disabled={!newProductName} data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-1" /> Pridat produkt
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            {partner.notes ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-md border border-border"
                dangerouslySetInnerHTML={{ __html: partner.notes }}
                data-testid="text-partner-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-partner-notes">Ziadne poznamky</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function Partners() {
  const { data: partners, isLoading } = usePartners();
  const deleteMutation = useDeletePartner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [viewTarget, setViewTarget] = useState<Partner | null>(null);

  function openCreate() {
    setEditingPartnerId(null);
    setDialogOpen(true);
  }

  function openEdit(partner: Partner) {
    setEditingPartnerId(partner.id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-partners-title">Zoznam partnerov</h2>
          <p className="text-sm text-muted-foreground mt-1">Sprava externych obchodnych partnerov.</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-partner">
          <Plus className="w-4 h-4 mr-2" />
          Pridat noveho partnera
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazov</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Vytvorene</TableHead>
                <TableHead className="w-[120px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!partners || partners.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground" data-testid="text-partners-empty">
                    Ziadni partneri. Kliknite na "Pridat noveho partnera".
                  </TableCell>
                </TableRow>
              )}
              {partners?.map(partner => (
                <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell className="font-mono text-xs">{partner.code || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{partner.uid || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString("sk-SK") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewTarget(partner)} data-testid={`button-view-partner-${partner.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(partner)} data-testid={`button-edit-partner-${partner.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(partner)} data-testid={`button-delete-partner-${partner.id}`}>
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

      <PartnerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingPartnerId={editingPartnerId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat partnera?</AlertDialogTitle>
            <AlertDialogDescription>
              Partner "{deleteTarget?.name}" bude presunuty do archivu. Tato akcia je vratna cez administratora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-partner">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-partner"
            >
              Vymazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewTarget && (
        <PartnerDetailDialog
          partner={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
}
