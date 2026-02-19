import { useState, useRef, useCallback, useEffect } from "react";
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner, usePartnerContacts, usePartnerProducts, useCreatePartnerContact, useCreatePartnerProduct } from "@/hooks/use-partners";
import { useStates } from "@/hooks/use-hierarchy";
import { useAppUser } from "@/hooks/use-app-user";
import { formatDateSlovak } from "@/lib/utils";
import { Plus, Briefcase, Pencil, Trash2, Clock, Users, Package, Calendar, Archive, MapPin } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";

const PARTNER_COLUMNS: ColumnDef[] = [
  { key: "uid", label: "UID" },
  { key: "name", label: "Nazov" },
  { key: "code", label: "Kod" },
  { key: "specialization", label: "Zameranie" },
  { key: "ico", label: "ICO" },
  { key: "city", label: "Mesto" },
  { key: "stateId", label: "Stat" },
  { key: "collaborationDate", label: "Datum spoluprace" },
];

const PARTNER_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "uid", label: "UID", type: "text" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "code", label: "Kod", type: "text" },
  { key: "specialization", label: "Zameranie", type: "text" },
  { key: "ico", label: "ICO", type: "text" },
  { key: "city", label: "Mesto", type: "text" },
  { key: "collaborationDate", label: "Datum spoluprace", type: "date" },
];

const specializationOptions = [
  { value: "SFA", label: "SFA" },
  { value: "Reality", label: "Reality" },
  { value: "Prenajom", label: "Prenajom" },
  { value: "Predaj zbrani", label: "Predaj zbrani" },
  { value: "Obchod", label: "Obchod" },
  { value: "Poistenie", label: "Poistenie" },
  { value: "Dochodok", label: "Dochodok" },
  { value: "Ine", label: "Ine" },
];

const partnerFormSchema = insertPartnerSchema.extend({
  name: z.string().min(1, "Nazov je povinny"),
  collaborationDate: z.string().optional(),
});

type PartnerFormData = z.infer<typeof partnerFormSchema>;

function PartnerUnifiedDialog({
  open,
  onOpenChange,
  partnerId,
  getStateName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number | null;
  getStateName: (id: number | null) => string;
}) {
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const { data: allPartners } = usePartners();
  const { data: allStates } = useStates();
  const { data: appUser } = useAppUser();
  const timerRef = useRef<number>(0);
  const [notesHtml, setNotesHtml] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const editingPartner = partnerId
    ? allPartners?.find(p => p.id === partnerId) || null
    : null;

  const isEditing = !!editingPartner;

  const { data: pContacts } = usePartnerContacts(isEditing ? partnerId : null);
  const { data: pProducts } = usePartnerProducts(isEditing ? partnerId : null);
  const createContact = useCreatePartnerContact();
  const createProduct = useCreatePartnerProduct();

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

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      name: "",
      code: "",
      specialization: "",
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
      collaborationDate: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingPartner) {
        form.reset({
          name: editingPartner.name,
          code: editingPartner.code || "",
          specialization: editingPartner.specialization || "",
          ico: editingPartner.ico || "",
          dic: editingPartner.dic || "",
          icDph: editingPartner.icDph || "",
          street: editingPartner.street || "",
          streetNumber: editingPartner.streetNumber || "",
          orientNumber: editingPartner.orientNumber || "",
          postalCode: editingPartner.postalCode || "",
          city: editingPartner.city || "",
          stateId: editingPartner.stateId || undefined,
          description: editingPartner.description || "",
          notes: editingPartner.notes || "",
          collaborationDate: editingPartner.collaborationDate ? new Date(editingPartner.collaborationDate).toISOString().split("T")[0] : "",
        });
        setNotesHtml(editingPartner.notes || "");
      } else {
        form.reset({
          name: "",
          code: "",
          specialization: "",
          ico: "",
          dic: "",
          icDph: "",
          street: "",
          streetNumber: "",
          orientNumber: "",
          postalCode: "",
          city: "",
          stateId: appUser?.activeStateId || undefined,
          description: "",
          notes: "",
          collaborationDate: undefined,
        });
        setNotesHtml("");
      }
      setNewContactFirst("");
      setNewContactLast("");
      setNewContactEmail("");
      setNewContactPhone("");
      setNewContactPosition("");
      setNewContactValidFrom(new Date().toISOString().split("T")[0]);
      setNewContactValidTo("");
      setShowArchivedContacts(false);
      setNewProductName("");
      setNewProductCode("");
      setActiveTab("info");
    }
  }, [open, editingPartner, form, appUser?.activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function onSubmit(data: PartnerFormData) {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const { collaborationDate, ...rest } = data;
    const payload: any = {
      ...rest,
      notes: notesHtml,
      processingTimeSec,
      collaborationDate: collaborationDate ? new Date(collaborationDate) : null,
    };

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

  function handleAddContact() {
    if (!newContactFirst || !newContactLast || !partnerId) return;
    const contactData: any = {
      firstName: newContactFirst, lastName: newContactLast, email: newContactEmail,
      phone: newContactPhone, position: newContactPosition, partnerId,
      validFrom: newContactValidFrom ? new Date(newContactValidFrom).toISOString() : new Date().toISOString(),
    };
    if (newContactValidTo) {
      contactData.validTo = new Date(newContactValidTo).toISOString();
    }
    createContact.mutate({ partnerId, data: contactData });
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactPosition("");
    setNewContactValidFrom(new Date().toISOString().split("T")[0]);
    setNewContactValidTo("");
  }

  function handleAddProduct() {
    if (!newProductName || !partnerId) return;
    createProduct.mutate({
      partnerId,
      data: { name: newProductName, productType: newProductType, code: newProductCode, partnerId },
    });
    setNewProductName("");
    setNewProductCode("");
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-partner-dialog-title">
                {editingPartner ? editingPartner.name : "Pridat noveho partnera"}
              </DialogTitle>
              <div style={{ display: editingPartner ? undefined : 'none' }} className="flex items-center gap-2 mt-1 flex-wrap">
                {editingPartner?.code && <Badge variant="secondary" className="font-mono">{editingPartner.code}</Badge>}
                {editingPartner?.specialization && <Badge variant="outline">{editingPartner.specialization}</Badge>}
                {editingPartner?.uid && <span className="text-xs font-mono text-muted-foreground">{editingPartner.uid}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
              <TabsList className="w-full grid" style={{ gridTemplateColumns: isEditing ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                <TabsTrigger value="info" data-testid="partner-tab-info">Info</TabsTrigger>
                <TabsTrigger value="contacts" data-testid="partner-tab-contacts" disabled={!isEditing} style={{ display: isEditing ? undefined : 'none' }}>Kontakty</TabsTrigger>
                <TabsTrigger value="products" data-testid="partner-tab-products" disabled={!isEditing} style={{ display: isEditing ? undefined : 'none' }}>Produkty</TabsTrigger>
                <TabsTrigger value="notes" data-testid="partner-tab-notes">Poznamky</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazov partnera</FormLabel>
                    <FormControl><Input {...field} data-testid="input-partner-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod partnera</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} maxLength={10} className="font-mono uppercase" data-testid="input-partner-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="specialization" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zameranie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-partner-specialization">
                            <SelectValue placeholder="Vyberte zameranie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {specializationOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="ico" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICO</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-ico" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dic" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DIC</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-dic" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="icDph" render={({ field }) => (
                    <FormItem>
                      <FormLabel>IC DPH</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-icdph" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charakteristika / popis cinnosti</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} rows={3} data-testid="input-partner-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="collaborationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum zacatia spoluprace</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? (typeof field.value === 'string' ? field.value : new Date(field.value).toISOString().split("T")[0]) : ""}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        data-testid="input-partner-collaboration-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>Adresa</span>
                </div>

                <FormField control={form.control} name="street" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-street" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="streetNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popisne cislo</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-street-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="orientNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orientacne cislo</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-orient-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PSC</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-postal-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mesto</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-partner-city" /></FormControl>
                      <FormMessage />
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
                          <SelectTrigger data-testid="select-partner-state">
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

                <div style={{ display: isEditing ? undefined : 'none' }}>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Clock className="w-3 h-3" />
                    <span>Cas spracovania: {editingPartner?.processingTimeSec || 0}s</span>
                    <span>|</span>
                    <span>Vytvorene: {formatDateSlovak(editingPartner?.createdAt)}</span>
                    <span>|</span>
                    <span>Aktualizovane: {formatDateSlovak(editingPartner?.updatedAt)}</span>
                  </div>
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
                                  <span>Od: {formatDateSlovak(c.validFrom)}</span>
                                  <span>Do: {c.validTo ? formatDateSlovak(c.validTo) : "Neurcito"}</span>
                                </div>
                              </div>
                              {c.isPrimary && <Badge variant="secondary">Primarny</Badge>}
                              <Badge variant="outline">SL{c.securityLevel}</Badge>
                              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
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
                                  <span>Od: {formatDateSlovak(c.validFrom)}</span>
                                  <span>Do: {formatDateSlovak(c.validTo)}</span>
                                </div>
                              </div>
                              <Badge variant="destructive">Archivovany</Badge>
                              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
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
                    <Input placeholder="Pozicia" value={newContactPosition} onChange={e => setNewContactPosition(e.target.value)} data-testid="input-contact-position" />
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Poznamkovy blok</label>
                  <RichTextEditor
                    content={notesHtml}
                    onChange={setNotesHtml}
                    placeholder="Zadajte poznamky k partnerovi..."
                    data-testid="editor-partner-notes"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <ProcessingSaveButton isPending={isPending} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Partners() {
  const { data: partners, isLoading } = usePartners();
  const tableFilter = useSmartFilter(partners || [], PARTNER_FILTER_COLUMNS, "partners");
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("partners", PARTNER_COLUMNS);
  const { data: allStates } = useStates();
  const deleteMutation = useDeletePartner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  function getStateName(stateId: number | null): string {
    if (!stateId || !allStates) return "-";
    const state = allStates.find(s => s.id === stateId);
    return state ? `${state.name} (${state.code})` : "-";
  }

  function openCreate() {
    setEditingPartnerId(null);
    setDialogOpen(true);
  }

  function openPartner(partner: Partner) {
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
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={openCreate} data-testid="button-add-partner">
            <Plus className="w-4 h-4 mr-2" />
            Pridat noveho partnera
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("uid") && <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>}
                {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov</TableHead>}
                {columnVisibility.isVisible("code") && <TableHead sortKey="code" sortDirection={sortKey === "code" ? sortDirection : null} onSort={requestSort}>Kod</TableHead>}
                {columnVisibility.isVisible("specialization") && <TableHead sortKey="specialization" sortDirection={sortKey === "specialization" ? sortDirection : null} onSort={requestSort}>Zameranie</TableHead>}
                {columnVisibility.isVisible("ico") && <TableHead sortKey="ico" sortDirection={sortKey === "ico" ? sortDirection : null} onSort={requestSort}>ICO</TableHead>}
                {columnVisibility.isVisible("city") && <TableHead sortKey="city" sortDirection={sortKey === "city" ? sortDirection : null} onSort={requestSort}>Mesto</TableHead>}
                {columnVisibility.isVisible("stateId") && <TableHead>Stat</TableHead>}
                {columnVisibility.isVisible("collaborationDate") && <TableHead sortKey="collaborationDate" sortDirection={sortKey === "collaborationDate" ? sortDirection : null} onSort={requestSort}>Datum spoluprace</TableHead>}
                <TableHead className="w-[80px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!partners || partners.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground" data-testid="text-partners-empty">
                    Ziadni partneri. Kliknite na "Pridat noveho partnera".
                  </TableCell>
                </TableRow>
              )}
              {sortedData.map(partner => (
                <TableRow
                  key={partner.id}
                  data-testid={`row-partner-${partner.id}`}
                  onRowClick={() => openPartner(partner)}
                >
                  {columnVisibility.isVisible("uid") && <TableCell className="font-mono text-xs text-muted-foreground">{partner.uid || "-"}</TableCell>}
                  {columnVisibility.isVisible("name") && <TableCell className="font-medium">{partner.name}</TableCell>}
                  {columnVisibility.isVisible("code") && <TableCell>{partner.code ? <Badge variant="secondary" className="font-mono">{partner.code}</Badge> : "-"}</TableCell>}
                  {columnVisibility.isVisible("specialization") && <TableCell className="text-sm">{partner.specialization || "-"}</TableCell>}
                  {columnVisibility.isVisible("ico") && <TableCell className="text-sm">{partner.ico || "-"}</TableCell>}
                  {columnVisibility.isVisible("city") && <TableCell className="text-sm">{partner.city || "-"}</TableCell>}
                  {columnVisibility.isVisible("stateId") && <TableCell className="text-sm">{getStateName(partner.stateId)}</TableCell>}
                  {columnVisibility.isVisible("collaborationDate") && <TableCell className="text-xs text-muted-foreground">
                    {formatDateSlovak(partner.collaborationDate)}
                  </TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openPartner(partner); }} data-testid={`button-edit-partner-${partner.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteTarget(partner); }} data-testid={`button-delete-partner-${partner.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zmazat partnera</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PartnerUnifiedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partnerId={editingPartnerId}
        getStateName={getStateName}
      />

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
    </div>
  );
}
