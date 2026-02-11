import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import type { ClientType, ClientTypeSection, ClientTypeField } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, Settings2, Layers, ArrowLeft, GripVertical,
  Type, AlignLeft, List, CheckSquare, ToggleLeft, Phone, Mail,
  Hash, Image, Calendar, CreditCard, Pencil, ChevronRight,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "short_text", label: "Kratky text", icon: Type },
  { value: "long_text", label: "Dlhy text", icon: AlignLeft },
  { value: "combobox", label: "Combobox", icon: List },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "switch", label: "Ano/Nie", icon: ToggleLeft },
  { value: "phone", label: "Telefon", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "number", label: "Cislo", icon: Hash },
  { value: "file", label: "Foto/Subor", icon: Image },
  { value: "date", label: "Datum", icon: Calendar },
  { value: "iban", label: "IBAN", icon: CreditCard },
];

function AddTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [basePar, setBasePar] = useState("rc");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/client-types", { code: code.toUpperCase(), name, baseParameter: basePar });
    },
    onSuccess: () => {
      toast({ title: "Vytvorene" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types"] });
      onOpenChange(false);
      setCode(""); setName(""); setBasePar("rc");
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] flex flex-col items-stretch justify-start">
        <DialogHeader><DialogTitle>Novy typ klienta</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Kod</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="napr. FO" data-testid="input-type-code" />
          </div>
          <div>
            <Label className="text-xs">Nazov</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Fyzicka osoba" data-testid="input-type-name" />
          </div>
          <div>
            <Label className="text-xs">Zakladny parameter</Label>
            <Select value={basePar} onValueChange={setBasePar}>
              <SelectTrigger data-testid="select-base-param"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rc">Rodne cislo (RC)</SelectItem>
                <SelectItem value="ico">ICO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button onClick={() => mutation.mutate()} disabled={!code.trim() || !name.trim() || mutation.isPending} data-testid="button-save-type">
            Vytvorit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddFieldDialog({
  open,
  onOpenChange,
  clientTypeId,
  sections,
  existingFields,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientTypeId: number;
  sections: ClientTypeSection[];
  existingFields: ClientTypeField[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("short_text");
  const [sectionId, setSectionId] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [dependsOn, setDependsOn] = useState("");
  const [dependsValue, setDependsValue] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const visibilityRule = dependsOn && dependsValue
        ? { dependsOn, value: dependsValue }
        : null;
      await apiRequest("POST", `/api/client-types/${clientTypeId}/fields`, {
        fieldKey: fieldKey.trim(),
        label: label.trim(),
        fieldType,
        sectionId: sectionId ? Number(sectionId) : null,
        isRequired,
        options: options ? options.split(",").map(o => o.trim()).filter(Boolean) : [],
        visibilityRule,
        sortOrder: existingFields.length,
      });
    },
    onSuccess: () => {
      toast({ title: "Pole vytvorene" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "fields"] });
      onOpenChange(false);
      setFieldKey(""); setLabel(""); setFieldType("short_text"); setSectionId("");
      setIsRequired(false); setOptions(""); setDependsOn(""); setDependsValue("");
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const showOptions = fieldType === "combobox";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col items-stretch justify-start">
        <DialogHeader><DialogTitle>Nove pole</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Kluc pola</Label>
              <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="napr. korespondencna_adresa" data-testid="input-field-key" />
            </div>
            <div>
              <Label className="text-xs">Nazov (label)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="napr. Korespondencna adresa" data-testid="input-field-label" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Typ pola</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger data-testid="select-field-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sekcia</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger data-testid="select-field-section"><SelectValue placeholder="Bez sekcie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez sekcie</SelectItem>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showOptions && (
            <div>
              <Label className="text-xs">Moznosti (oddelene ciarkou)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Moznost 1, Moznost 2, Moznost 3" data-testid="input-field-options" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Checkbox
              id="field-required"
              checked={isRequired}
              onCheckedChange={(c) => setIsRequired(!!c)}
              data-testid="checkbox-field-required"
            />
            <Label htmlFor="field-required" className="text-sm cursor-pointer">Povinne pole</Label>
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-semibold">Podmienena viditelnost</Label>
            <p className="text-xs text-muted-foreground mb-2">Toto pole sa zobrazi len ak ine pole ma urcitu hodnotu.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Zavisi od pola</Label>
                <Select value={dependsOn} onValueChange={setDependsOn}>
                  <SelectTrigger data-testid="select-depends-on"><SelectValue placeholder="Ziadne" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ziadne</SelectItem>
                    {existingFields.map(f => (
                      <SelectItem key={f.fieldKey} value={f.fieldKey}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Hodnota</Label>
                <Input value={dependsValue} onChange={(e) => setDependsValue(e.target.value)} placeholder="napr. Ano" data-testid="input-depends-value" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button onClick={() => mutation.mutate()} disabled={!fieldKey.trim() || !label.trim() || mutation.isPending} data-testid="button-save-field">
            Vytvorit pole
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeDetailView({ clientType, onBack }: { clientType: ClientType; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addSectionName, setAddSectionName] = useState("");
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  const { data: sections = [] } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientType.id, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType.id}/sections`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: fields = [] } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientType.id, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType.id}/fields`, { credentials: "include" });
      return res.json();
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", `/api/client-types/${clientType.id}/sections`, {
        name,
        sortOrder: sections.length,
      });
    },
    onSuccess: () => {
      toast({ title: "Sekcia vytvorena" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientType.id, "sections"] });
      setAddSectionName("");
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/client-type-sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientType.id, "sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientType.id, "fields"] });
      toast({ title: "Sekcia odstranena" });
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/client-type-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientType.id, "fields"] });
      toast({ title: "Pole odstranene" });
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const groupedFields: Record<string, ClientTypeField[]> = {};
  const unsectionedFields: ClientTypeField[] = [];
  fields.forEach(f => {
    if (f.sectionId) {
      const key = f.sectionId.toString();
      if (!groupedFields[key]) groupedFields[key] = [];
      groupedFields[key].push(f);
    } else {
      unsectionedFields.push(f);
    }
  });

  const fieldTypeIcon = (ft: string) => {
    const found = FIELD_TYPES.find(t => t.value === ft);
    return found ? found.icon : Type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-types">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat
        </Button>
        <div>
          <h2 className="text-xl font-bold" data-testid="text-type-detail-name">{clientType.name} ({clientType.code})</h2>
          <p className="text-xs text-muted-foreground">
            Zakladny parameter: {clientType.baseParameter === "ico" ? "ICO" : "Rodne cislo"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Sekcie</CardTitle>
            <Layers className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {sections.map(s => (
              <div key={s.id} className="flex items-center gap-2" data-testid={`section-row-${s.id}`}>
                <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{s.name}</span>
                <Button size="icon" variant="ghost" onClick={() => deleteSectionMutation.mutate(s.id)} data-testid={`button-delete-section-${s.id}`}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
            {sections.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Ziadne sekcie</p>
            )}
            <Separator />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nazov sekcie"
                value={addSectionName}
                onChange={(e) => setAddSectionName(e.target.value)}
                className="flex-1"
                data-testid="input-new-section-name"
              />
              <Button
                size="icon"
                onClick={() => { if (addSectionName.trim()) addSectionMutation.mutate(addSectionName.trim()); }}
                disabled={!addSectionName.trim() || addSectionMutation.isPending}
                data-testid="button-add-section"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Polia</CardTitle>
            <Button size="sm" onClick={() => setAddFieldOpen(true)} data-testid="button-add-field">
              <Plus className="w-3 h-3 mr-1" />
              Pridat pole
            </Button>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Ziadne polia definovane</p>
            ) : (
              <div className="space-y-4">
                {unsectionedFields.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Bez sekcie</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Pole</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Povinne</TableHead>
                          <TableHead>Podmienka</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unsectionedFields.map(f => {
                          const Icon = fieldTypeIcon(f.fieldType);
                          return (
                            <TableRow key={f.id} data-testid={`field-row-${f.id}`}>
                              <TableCell><GripVertical className="w-3 h-3 text-muted-foreground" /></TableCell>
                              <TableCell>
                                <div>
                                  <span className="text-sm font-medium">{f.label}</span>
                                  <span className="text-xs text-muted-foreground ml-1 font-mono">({f.fieldKey})</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Icon className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs">{FIELD_TYPES.find(t => t.value === f.fieldType)?.label || f.fieldType}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {f.isRequired ? <Badge variant="default" className="bg-emerald-600 text-white">Ano</Badge> : <Badge variant="outline">Nie</Badge>}
                              </TableCell>
                              <TableCell>
                                {f.visibilityRule ? (
                                  <span className="text-xs text-muted-foreground">
                                    {(f.visibilityRule as any).dependsOn} = {(f.visibilityRule as any).value}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell>
                                <Button size="icon" variant="ghost" onClick={() => deleteFieldMutation.mutate(f.id)} data-testid={`button-delete-field-${f.id}`}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {sections.map(s => {
                  const sectionFields = groupedFields[s.id.toString()] || [];
                  return (
                    <div key={s.id}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{s.name}</p>
                      {sectionFields.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">Ziadne polia v tejto sekcii</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Pole</TableHead>
                              <TableHead>Typ</TableHead>
                              <TableHead>Povinne</TableHead>
                              <TableHead>Podmienka</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sectionFields.map(f => {
                              const Icon = fieldTypeIcon(f.fieldType);
                              return (
                                <TableRow key={f.id} data-testid={`field-row-${f.id}`}>
                                  <TableCell><GripVertical className="w-3 h-3 text-muted-foreground" /></TableCell>
                                  <TableCell>
                                    <div>
                                      <span className="text-sm font-medium">{f.label}</span>
                                      <span className="text-xs text-muted-foreground ml-1 font-mono">({f.fieldKey})</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Icon className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs">{FIELD_TYPES.find(t => t.value === f.fieldType)?.label || f.fieldType}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {f.isRequired ? <Badge variant="default" className="bg-emerald-600 text-white">Ano</Badge> : <Badge variant="outline">Nie</Badge>}
                                  </TableCell>
                                  <TableCell>
                                    {f.visibilityRule ? (
                                      <span className="text-xs text-muted-foreground">
                                        {(f.visibilityRule as any).dependsOn} = {(f.visibilityRule as any).value}
                                      </span>
                                    ) : <span className="text-xs text-muted-foreground">-</span>}
                                  </TableCell>
                                  <TableCell>
                                    <Button size="icon" variant="ghost" onClick={() => deleteFieldMutation.mutate(f.id)} data-testid={`button-delete-field-${f.id}`}>
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddFieldDialog
        open={addFieldOpen}
        onOpenChange={setAddFieldOpen}
        clientTypeId={clientType.id}
        sections={sections}
        existingFields={fields}
      />
    </div>
  );
}

export default function ClientTypeRules() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: clientTypes = [], isLoading } = useQuery<ClientType[]>({
    queryKey: ["/api/client-types"],
  });

  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ClientType | null>(null);

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/client-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types"] });
      toast({ title: "Typ odstraneny" });
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  if (selectedType) {
    return <TypeDetailView clientType={selectedType} onBack={() => setSelectedType(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-client-types-title">Pravidla typov klientov</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sprava typov klientov, ich poli a sekcii formulara.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddTypeOpen(true)} data-testid="button-add-client-type">
            <Plus className="w-4 h-4 mr-2" />
            Novy typ
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Nazov</TableHead>
                <TableHead>Zakladny parameter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
              )}
              {!isLoading && clientTypes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Ziadne typy klientov</TableCell></TableRow>
              )}
              {clientTypes.map(ct => (
                <TableRow key={ct.id} data-testid={`row-client-type-${ct.id}`}>
                  <TableCell className="font-mono font-bold">{ct.code}</TableCell>
                  <TableCell className="font-medium">{ct.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ct.baseParameter === "ico" ? "ICO" : "Rodne cislo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ct.isActive ? "default" : "destructive"} className={ct.isActive ? "bg-emerald-600 text-white" : ""}>
                      {ct.isActive ? "Aktivny" : "Neaktivny"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setSelectedType(ct)} data-testid={`button-edit-type-${ct.id}`}>
                        <Settings2 className="w-3 h-3 mr-1" />
                        Upravit polia
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" onClick={() => deleteTypeMutation.mutate(ct.id)} data-testid={`button-delete-type-${ct.id}`}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddTypeDialog open={addTypeOpen} onOpenChange={setAddTypeOpen} />
    </div>
  );
}
