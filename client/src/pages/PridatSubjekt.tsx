import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useCreateSubject } from "@/hooks/use-subjects";
import { useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatUid, smartPadUid, cn } from "@/lib/utils";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import { getDocumentValidityStatus } from "@/lib/document-validity";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, AlertTriangle, ExternalLink, X, Building2, User, Loader2, Link2,
  Plus, Trash2, ShieldCheck, ListPlus, Eye, CreditCard, Users, CheckCircle2,
  ChevronsUpDown, Check, UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/schema";
import type { ClientType, DocumentEntry, ContactEntry } from "@shared/schema";
import {
  getFieldsForClientTypeId, getSectionsForClientTypeId, getPanelsForClientTypeId,
  type StaticField, type StaticPanel,
} from "@/lib/staticFieldDefs";
import { PRIORITY_COUNTRY_NAMES, ALL_COUNTRY_NAMES, DEFAULT_COUNTRY, getDefaultCountryForState } from "@/lib/countries";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DynamicFieldInput, capitalizeFirst } from "@/components/dynamic-field-input";

const FOLDER_CATEGORY_LABELS: Record<string, string> = {
  povinne: "POVINNE UDAJE",
  doplnkove: "DOPLNKOVE UDAJE",
  volitelne: "VOLITELNE / DOBROVOLNE UDAJE",
};

const FOLDER_CATEGORY_ICONS: Record<string, any> = {
  povinne: ShieldCheck,
  doplnkove: ListPlus,
  volitelne: Eye,
};

const FOLDER_CATEGORY_ORDER = ["povinne", "doplnkove", "volitelne"];

const createSchema = insertSubjectSchema.extend({
  stateId: z.coerce.number().min(1, "Povinne"),
  myCompanyId: z.coerce.number().min(1, "Povinne"),
});

export type InitialData = {
  clientTypeCode: string;
  stateId: number;
  baseValue: string;
  aresData?: {
    name?: string;
    street?: string;
    streetNumber?: string;
    zip?: string;
    city?: string;
    legalForm?: string;
    dic?: string;
    source?: string;
    directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[];
  };
};

export function FullPageEditor({
  initialData,
  onCancel,
  onValidityChange,
}: {
  initialData: InitialData;
  onCancel: () => void;
  onValidityChange?: (isValid: boolean) => void;
}) {
  const { mutate, isPending } = useCreateSubject();
  const { toast } = useToast();
  const { data: companies } = useMyCompanies();
  const { data: allStates, isLoading: statesLoading } = useStates();
  const { data: clientTypes, isLoading: typesLoading } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: appUser } = useAppUser();
  const { data: uidPrefixData } = useQuery<{ prefix: string }>({ queryKey: ["/api/uid-prefix"] });
  const uidPrefix = uidPrefixData?.prefix || "421";
  const timerRef = useRef<number>(performance.now());

  const clientType = clientTypes?.find(ct => ct.code === initialData.clientTypeCode);
  const isPerson = clientType?.baseParameter === "rc";
  const isOsType = clientType?.code === 'OS';
  const state = allStates?.find(s => s.id === initialData.stateId);

  const isSzcoType = clientType?.code === 'SZCO';
  const [szcoData, setSzcoData] = useState({
    obchodne_meno: initialData.aresData?.name || "",
    ico: initialData.baseValue || "",
    dic: initialData.aresData?.dic || "",
    ic_dph: "",
    miesto_podnikania: initialData.aresData ? [initialData.aresData.street, initialData.aresData.streetNumber].filter(Boolean).join(" ") + (initialData.aresData.street || initialData.aresData.streetNumber ? ", " : "") + [initialData.aresData.zip, initialData.aresData.city].filter(Boolean).join(" ") : "",
    register: "",
  });
  const [szcoFoData, setSzcoFoData] = useState({ firstName: "", lastName: "", birthNumber: "", fo_uid: "" });
  const [szcoFoLinkedId, setSzcoFoLinkedId] = useState<number | null>(null);
  const [szcoFoLoading, setSzcoFoLoading] = useState(false);
  const [szcoFoRcError, setSzcoFoRcError] = useState<string | null>(null);
  const [szcoIcoError, setSzcoIcoError] = useState<string | null>(null);
  const [szcoAresLookup, setSzcoAresLookup] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string }[]; found: boolean; message?: string } | null>(null);
  const [szcoAresLoading, setSzcoAresLoading] = useState(false);
  const [pendingRegistrySnapshot, setPendingRegistrySnapshot] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string } | null>(null);

  const [importedFieldKeys] = useState<Set<string>>(() => new Set<string>());
  const [flashingFields, setFlashingFields] = useState<Set<string>>(new Set());
  const [dynamicValues, setDynamicValuesRaw] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = { korespond_rovnaka: "true", kontaktna_rovnaka: "true", tp_stat: DEFAULT_COUNTRY, ka_stat: DEFAULT_COUNTRY, koa_stat: DEFAULT_COUNTRY, sidlo_stat: DEFAULT_COUNTRY, vykon_stat: DEFAULT_COUNTRY };
    if (initialData.clientTypeCode === 'NS') base.typ_organizacie = "Nezisková organizácia";
    if (initialData.clientTypeCode === 'VS') base.typ_organizacie = "Štátna inštitúcia";
    if (initialData.aresData && !isSzcoType) {
      if (initialData.aresData.name) { base.obchodne_meno = initialData.aresData.name; importedFieldKeys.add('obchodne_meno'); }
      if (initialData.aresData.dic) { base.dic = initialData.aresData.dic; importedFieldKeys.add('dic'); }
      if (initialData.aresData.street) { base.sidlo_ulica = initialData.aresData.street + (initialData.aresData.streetNumber ? " " + initialData.aresData.streetNumber : ""); importedFieldKeys.add('sidlo_ulica'); }
      if (initialData.aresData.zip) { base.sidlo_psc = initialData.aresData.zip; importedFieldKeys.add('sidlo_psc'); }
      if (initialData.aresData.city) { base.sidlo_mesto = initialData.aresData.city; importedFieldKeys.add('sidlo_mesto'); }
      if (initialData.aresData.directors?.length) {
        initialData.aresData.directors.slice(0, 5).forEach((dir, i) => {
          const slot = i + 1;
          const nameStr = [dir.titleBefore, dir.firstName, dir.lastName, dir.titleAfter].filter(Boolean).join(" ") || dir.name;
          const fieldKey = `po_statutar_${slot}_meno`;
          base[fieldKey] = nameStr + (dir.role ? ` (${dir.role})` : "");
          importedFieldKeys.add(fieldKey);
        });
      }
    }
    return base;
  });
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [contacts, setContacts] = useState<ContactEntry[]>([{ id: crypto.randomUUID(), type: "phone", value: "", label: "Primárny", isPrimary: true }]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [existingSubjectBanner, setExistingSubjectBanner] = useState<{ id: number; uid: string; name: string; matchedField: string } | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const setDynamicValues: typeof setDynamicValuesRaw = (updater) => {
    setDynamicValuesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const changedKeys = Object.keys(next).filter(k => next[k] !== prev[k]);
      if (changedKeys.length > 0 && validationErrors.size > 0) {
        setValidationErrors(prev => {
          const updated = new Set(prev);
          changedKeys.forEach(k => updated.delete(k));
          return updated.size === prev.size ? prev : updated;
        });
      }
      return next;
    });
  };

  const parseRodneCislo = (rc: string): { pohlavie?: string; datumNarodenia?: string } => {
    const clean = rc.replace(/[\s\/]/g, "");
    if (clean.length < 6 || !/^\d+$/.test(clean)) return {};
    const yy = parseInt(clean.substring(0, 2), 10);
    let mm = parseInt(clean.substring(2, 4), 10);
    const dd = parseInt(clean.substring(4, 6), 10);
    const pohlavie = mm > 50 ? "žena" : "muž";
    if (mm > 50) mm -= 50;
    if (mm > 20) mm -= 20;
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { pohlavie };
    const dateStr = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return { pohlavie };
    return { pohlavie, datumNarodenia: dateStr };
  };

  useEffect(() => {
    if (importedFieldKeys.size > 0) {
      setFlashingFields(new Set(importedFieldKeys));
      const t = setTimeout(() => setFlashingFields(new Set()), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (isPerson && state?.name && !dynamicValues["statna_prislusnost"]) {
      const defaultCountry = getDefaultCountryForState(state.name);
      setDynamicValues(prev => prev["statna_prislusnost"] ? prev : { ...prev, statna_prislusnost: defaultCountry });
    }
  }, [isPerson, state?.name]);

  useEffect(() => {
    if (!isPerson) return;
    const rc = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
    if (!rc) return;
    const parsed = parseRodneCislo(rc);
    if (parsed.pohlavie || parsed.datumNarodenia) {
      setDynamicValues(prev => {
        const updates: Record<string, string> = {};
        if (parsed.pohlavie && prev["pohlavie"] !== parsed.pohlavie) updates["pohlavie"] = parsed.pohlavie;
        if (parsed.datumNarodenia && prev["datum_narodenia"] !== parsed.datumNarodenia) updates["datum_narodenia"] = parsed.datumNarodenia;
        if (parsed.datumNarodenia) {
          const birth = new Date(parsed.datumNarodenia);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const mDiff = today.getMonth() - birth.getMonth();
          if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
          const ageStr = String(age >= 0 ? age : 0);
          if (prev["vek"] !== ageStr) updates["vek"] = ageStr;
        }
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [isPerson, dynamicValues["rodne_cislo"], initialData.baseValue]);

  const editorClientTypeId = clientType?.code === 'SZCO' ? 3 : clientType?.code === 'PO' ? 4 : clientType?.code === 'NS' ? 5 : clientType?.code === 'VS' ? 6 : clientType?.code === 'OS' ? 7 : 1;
  const typeFields = getFieldsForClientTypeId(editorClientTypeId);
  const typeSections = getSectionsForClientTypeId(editorClientTypeId);

  useEffect(() => {
    if (!onValidityChange) return;
    const DOC_KEYS = new Set(["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"]);
    const CONTACT_KEYS = new Set(["telefon", "email", "rodne_cislo"]);
    const visibleRequired = (typeFields || []).filter(f => {
      if (!f.isRequired) return false;
      if (!f.visibilityRule) return true;
      const rule = f.visibilityRule as { dependsOn: string; value: string };
      if (!rule.dependsOn || !rule.value) return true;
      const depField = typeFields?.find(tf => tf.fieldKey === rule.dependsOn);
      if (!depField) return true;
      return (dynamicValues[depField.fieldKey] || "") === rule.value;
    });
    const missing: { fieldKey: string }[] = visibleRequired
      .filter(f => !DOC_KEYS.has(f.fieldKey) && !CONTACT_KEYS.has(f.fieldKey) && !dynamicValues[f.fieldKey]?.trim())
      .map(f => ({ fieldKey: f.fieldKey }));
    if (isPerson) {
      const addrKeys = ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"];
      for (const k of addrKeys) {
        if (!dynamicValues[k]?.trim()) missing.push({ fieldKey: k });
      }
      const hasDoc = documents.some(d => d.documentType?.trim() && d.documentNumber?.trim());
      if (!hasDoc) missing.push({ fieldKey: "typ_dokladu" });
      const rcVal = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
      if (!rcVal) missing.push({ fieldKey: "rodne_cislo" });
    }
    onValidityChange(missing.length === 0);
  }, [typeFields, dynamicValues, documents, isPerson, initialData.baseValue, onValidityChange]);

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const activeCompanyName = companies?.find(c => c.id === appUser?.activeCompanyId)?.name || "";

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : clientType?.code === 'NS' ? "organization" : clientType?.code === 'VS' ? "state" : clientType?.code === 'OS' ? "os" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser?.activeCompanyId || 0,
    },
  });

  const formResetDone = useRef(false);
  if (!formResetDone.current && clientType && state && appUser?.activeCompanyId) {
    formResetDone.current = true;
    form.reset({
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : clientType?.code === 'NS' ? "organization" : clientType?.code === 'VS' ? "state" : clientType?.code === 'OS' ? "os" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser.activeCompanyId,
    });
  }

  if (statesLoading || typesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam udaje...</p>
      </div>
    );
  }

  function onSubmit(data: z.infer<typeof createSchema>) {
    const DOC_KEYS = new Set(["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"]);
    const CONTACT_KEYS = new Set(["telefon", "email", "rodne_cislo"]);
    const requiredFields = (typeFields || []).filter(f => f.isRequired && isFieldVisible(f));
    const missingFields = requiredFields.filter(f => !DOC_KEYS.has(f.fieldKey) && !CONTACT_KEYS.has(f.fieldKey) && !dynamicValues[f.fieldKey]?.trim());

    if (isPerson) {
      const addressRequired: { key: string; label: string }[] = [
        { key: "tp_ulica", label: "Ulica (trvalý pobyt)" },
        { key: "tp_orientacne", label: "Orientačné číslo (trvalý pobyt)" },
        { key: "tp_psc", label: "PSČ (trvalý pobyt)" },
        { key: "tp_mesto", label: "Mesto (trvalý pobyt)" },
      ];
      for (const ar of addressRequired) {
        if (!dynamicValues[ar.key]?.trim()) {
          missingFields.push({ fieldKey: ar.key, label: ar.label } as any);
        }
      }
      const hasValidDoc = documents.some(d => d.documentType?.trim() && d.documentNumber?.trim());
      if (!hasValidDoc) {
        missingFields.push({ fieldKey: "typ_dokladu", label: "Doklad totožnosti (typ a číslo)" } as any);
      }
      const rcValue = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
      if (!rcValue) {
        missingFields.push({ fieldKey: "rodne_cislo", label: "Rodné číslo" } as any);
      } else {
        const rcResult = validateSlovakRC(rcValue);
        if (!rcResult.valid) {
          missingFields.push({ fieldKey: "rodne_cislo", label: `Rodné číslo: ${rcResult.error}` } as any);
        }
      }
    }

    if (missingFields.length > 0) {
      setValidationErrors(new Set(missingFields.map(f => f.fieldKey)));
      toast({ title: "Chýbajúce povinné polia", description: missingFields.map(f => f.label || f.fieldKey).join(", "), variant: "destructive" });
      return;
    }
    setValidationErrors(new Set());

    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const existingDetails = (typeof data.details === "object" && data.details) ? data.details : {};
    const primaryPhone = contacts.find(c => c.type === "phone" && c.isPrimary)?.value || contacts.find(c => c.type === "phone")?.value || "";
    const primaryEmail = contacts.find(c => c.type === "email" && c.isPrimary)?.value || contacts.find(c => c.type === "email")?.value || "";
    const dynWithDocs = { ...dynamicValues, documents, contacts, telefon: primaryPhone };
    const mergedDetails = Object.keys(dynWithDocs).length > 0
      ? { ...(existingDetails as Record<string, any>), dynamicFields: dynWithDocs }
      : existingDetails;
    const submitData: any = { ...data, details: mergedDetails, processingTimeSec };
    if (primaryPhone) submitData.phone = primaryPhone;
    if (primaryEmail) submitData.email = primaryEmail;
    if (isPerson && dynamicValues.meno) submitData.firstName = dynamicValues.meno;
    if (isPerson && dynamicValues.priezvisko) submitData.lastName = dynamicValues.priezvisko;
    if (isSzcoType) {
      if (!szcoFoData.firstName || !szcoFoData.lastName) {
        toast({ title: "Chýbajúce osobné údaje", description: "Vyplňte meno a priezvisko majiteľa SZČO.", variant: "destructive" });
        return;
      }
      if (!szcoData.obchodne_meno) {
        toast({ title: "Chýbajúce obchodné údaje", description: "Vyplňte obchodné meno SZČO.", variant: "destructive" });
        return;
      }
      if (szcoData.ico) {
        const icoCheck = validateSlovakICO(szcoData.ico);
        if (!icoCheck.valid) {
          setSzcoIcoError(icoCheck.error || "Neplatné IČO");
          toast({ title: "Neplatné IČO", description: icoCheck.error || "Kontrolná číslica nesedí", variant: "destructive" });
          return;
        }
      }
      submitData.firstName = szcoFoData.firstName;
      submitData.lastName = szcoFoData.lastName;
      if (szcoFoData.birthNumber) submitData.birthNumber = szcoFoData.birthNumber;
      submitData.companyName = szcoData.obchodne_meno;
      submitData.type = "szco";
      if (szcoFoLinkedId) submitData.linkedFoId = szcoFoLinkedId;
      const existingDet = (typeof submitData.details === "object" && submitData.details) ? submitData.details as Record<string, any> : {};
      const dynFields = existingDet.dynamicFields || {};
      dynFields.ico = szcoData.ico;
      dynFields.dic = szcoData.dic;
      dynFields.ic_dph = szcoData.ic_dph;
      dynFields.miesto_podnikania = szcoData.miesto_podnikania;
      dynFields.register = szcoData.register;
      dynFields.fo_uid = szcoFoData.fo_uid;
      existingDet.dynamicFields = dynFields;
      existingDet.ico = szcoData.ico;
      submitData.details = existingDet;
    }
    mutate(submitData, {
      onSuccess: async (createdSubject: any) => {
        if (createdSubject?.existingSubject) {
          setExistingSubjectBanner(createdSubject.existingSubject);
          setPendingSubmitData(submitData);
          return;
        }
        if (createdSubject?.id) {
          const validContacts = contacts.filter(c => c.value?.trim());
          for (let i = 0; i < validContacts.length; i++) {
            const c = validContacts[i];
            try {
              await apiRequest("POST", `/api/subjects/${createdSubject.id}/contacts`, {
                type: c.type,
                value: c.value.trim(),
                label: c.label || null,
                isPrimary: c.isPrimary ?? (i === 0),
                order: i,
              });
            } catch {}
          }
        }
        if (createdSubject?.id && !isPerson) {
          const snapshotData = initialData.aresData || pendingRegistrySnapshot || (szcoAresLookup?.found ? szcoAresLookup : null);
          const snapshotSource = snapshotData?.source || "ORSR";
          if (snapshotData) {
            try {
              const icoVal = isSzcoType ? szcoData.ico : (dynamicValues.ico || initialData.baseValue);
              if (icoVal) {
                await apiRequest("POST", `/api/subjects/${createdSubject.id}/registry-snapshots`, {
                  source: snapshotSource,
                  ico: icoVal,
                  parsedFields: { name: snapshotData.name, street: snapshotData.street, streetNumber: snapshotData.streetNumber, zip: snapshotData.zip, city: snapshotData.city, legalForm: snapshotData.legalForm, dic: snapshotData.dic },
                  rawData: snapshotData,
                });
              }
            } catch {}
          }
        }
        if (createdSubject?.id) {
          window.location.href = `/profil-subjektu?id=${createdSubject.id}`;
        } else {
          onCancel();
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat
        </Button>
        <div>
          <h2 className="text-xl font-bold">Novy klient - {clientType?.name || initialData.clientTypeCode}</h2>
          <p className="text-xs text-muted-foreground">
            {isPerson ? `RC: ${initialData.baseValue}` : `ICO: ${initialData.baseValue}`}
            {state ? ` | Stat: ${state.name}` : ""}
          </p>
        </div>
      </div>

      {existingSubjectBanner && (
        <div className="border border-yellow-500 bg-yellow-500/10 rounded p-3 flex items-start gap-3" data-testid="banner-existing-subject">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-400">Subjekt už existuje v systéme</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Zhoda podľa: <span className="font-medium text-foreground">{existingSubjectBanner.matchedField}</span>
              {" — "}
              <span className="font-medium text-foreground">{existingSubjectBanner.name}</span>
              {existingSubjectBanner.uid && <span className="ml-1 text-xs text-muted-foreground font-mono">(UID: {formatUid(existingSubjectBanner.uid)})</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Môžete otvoriť existujúci subjekt, registrovať aj tak, alebo upraviť zadané údaje.</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <a href={`/subjects/${existingSubjectBanner.id}`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm" className="text-xs" data-testid="button-open-existing-subject">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Otvoriť existujúci
                </Button>
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                data-testid="button-force-create-subject"
                disabled={isPending}
                onClick={() => {
                  if (!pendingSubmitData) return;
                  setExistingSubjectBanner(null);
                  mutate({ ...pendingSubmitData, _forceCreate: true }, {
                    onSuccess: async (result: any) => {
                      if (result?.id) {
                        const validContacts = contacts.filter(c => c.value?.trim());
                        let contactErrors = 0;
                        for (let i = 0; i < validContacts.length; i++) {
                          const c = validContacts[i];
                          try {
                            await apiRequest("POST", `/api/subjects/${result.id}/contacts`, {
                              type: c.type, value: c.value.trim(), label: c.label || null,
                              isPrimary: c.isPrimary ?? (i === 0), order: i,
                            });
                          } catch { contactErrors++; }
                        }
                        if (contactErrors > 0) console.warn(`[contacts] ${contactErrors} kontaktov sa nepodarilo uložiť pre subjekt ${result.id}`);
                      }
                      if (result?.id && !isPerson) {
                        const snapshotData = pendingRegistrySnapshot || (szcoAresLookup?.found ? szcoAresLookup : null);
                        if (snapshotData) {
                          try {
                            const icoVal = (pendingSubmitData.details as any)?.ico || (pendingSubmitData.details as any)?.dynamicFields?.ico;
                            if (icoVal) await apiRequest("POST", `/api/subjects/${result.id}/registry-snapshots`, { source: snapshotData.source || "ORSR", ico: icoVal, parsedFields: snapshotData, rawData: snapshotData });
                          } catch {}
                        }
                      }
                      if (result?.id) {
                        window.location.href = `/profil-subjektu?id=${result.id}`;
                      } else {
                        onCancel();
                      }
                    },
                  });
                }}
              >
                Registrovať aj tak
              </Button>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExistingSubjectBanner(null)} className="shrink-0 p-1 h-auto" data-testid="button-dismiss-existing-banner">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isSzcoType && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">SZČO - Obchodné údaje</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">ID Subjektu</Label>
                  <Input
                    value="Automaticky generovaný"
                    disabled
                    className="font-mono text-xs"
                    data-testid="input-szco-uid"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Obchodné meno *</Label>
                  <Input
                    value={szcoData.obchodne_meno}
                    onChange={e => setSzcoData(prev => ({ ...prev, obchodne_meno: e.target.value }))}
                    data-testid="input-szco-obchodne-meno"
                  />
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className={`text-xs ${szcoIcoError ? "text-red-500" : "text-muted-foreground"}`}>IČO *</Label>
                  <Input
                    value={szcoData.ico}
                    onChange={e => {
                      setSzcoData(prev => ({ ...prev, ico: e.target.value }));
                      if (szcoIcoError) {
                        const r = validateSlovakICO(e.target.value);
                        if (r.valid) { setSzcoIcoError(null); }
                      }
                    }}
                    onBlur={() => {
                      const val = szcoData.ico.trim();
                      if (!val) { setSzcoIcoError(null); setSzcoAresLookup(null); return; }
                      const result = validateSlovakICO(val);
                      if (!result.valid) {
                        setSzcoIcoError(result.error || "Neplatné IČO");
                        setSzcoAresLookup(null);
                        return;
                      }
                      setSzcoIcoError(null);
                      if (result.normalized) setSzcoData(prev => ({ ...prev, ico: result.normalized! }));
                      setSzcoAresLoading(true);
                      fetch(`/api/lookup/ico/${encodeURIComponent(result.normalized || val)}?type=szco`, { credentials: "include" })
                        .then(r => r.json())
                        .then(data => {
                          if (data.found) {
                            setSzcoAresLookup(data);
                          } else {
                            setSzcoAresLookup({ found: false, message: data.message });
                          }
                        })
                        .catch(() => setSzcoAresLookup({ found: false, message: "Chyba registrov" }))
                        .finally(() => setSzcoAresLoading(false));
                    }}
                    className={szcoIcoError ? "border-red-500 focus-visible:ring-red-500 font-mono" : "font-mono"}
                    data-testid="input-szco-ico"
                  />
                  {szcoIcoError && <p className="text-[10px] text-red-500 leading-tight" data-testid="text-szco-ico-error">{szcoIcoError}</p>}
                  {szcoAresLoading && (
                    <div className="flex items-center gap-2 mt-1" data-testid="text-szco-registry-loading">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className="text-xs text-muted-foreground">DIČ</Label>
                  <Input
                    value={szcoData.dic}
                    onChange={e => setSzcoData(prev => ({ ...prev, dic: e.target.value }))}
                    data-testid="input-szco-dic"
                  />
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className="text-xs text-muted-foreground">IČ DPH</Label>
                  <Input
                    value={szcoData.ic_dph}
                    onChange={e => setSzcoData(prev => ({ ...prev, ic_dph: e.target.value }))}
                    data-testid="input-szco-ic-dph"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Miesto podnikania</Label>
                  <Input
                    value={szcoData.miesto_podnikania}
                    onChange={e => setSzcoData(prev => ({ ...prev, miesto_podnikania: e.target.value }))}
                    data-testid="input-szco-miesto"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Register</Label>
                  <Input
                    value={szcoData.register}
                    onChange={e => setSzcoData(prev => ({ ...prev, register: e.target.value }))}
                    data-testid="input-szco-register"
                  />
                </div>
              </div>
              {szcoAresLookup?.found && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 space-y-2" data-testid="szco-ares-lookup-result">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-blue-400">{szcoAresLookup.source === "ORSR" ? "Obchodný register SR" : szcoAresLookup.source === "ZRSR" ? "Živnostenský register SR" : "ARES Register"}</span>
                  </div>
                  {szcoAresLookup.name && <p className="text-sm font-medium">{szcoAresLookup.name}</p>}
                  {(szcoAresLookup.street || szcoAresLookup.city) && (
                    <p className="text-xs text-muted-foreground">
                      {[szcoAresLookup.street, szcoAresLookup.streetNumber].filter(Boolean).join(" ")}
                      {(szcoAresLookup.street || szcoAresLookup.streetNumber) && (szcoAresLookup.zip || szcoAresLookup.city) ? ", " : ""}
                      {[szcoAresLookup.zip, szcoAresLookup.city].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {szcoAresLookup.legalForm && <p className="text-[10px] text-muted-foreground">{szcoAresLookup.legalForm}{szcoAresLookup.dic ? ` | DIČ: ${szcoAresLookup.dic}` : ""}</p>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setPendingRegistrySnapshot({
                        name: szcoAresLookup.name,
                        street: szcoAresLookup.street,
                        streetNumber: szcoAresLookup.streetNumber,
                        zip: szcoAresLookup.zip,
                        city: szcoAresLookup.city,
                        legalForm: szcoAresLookup.legalForm,
                        dic: szcoAresLookup.dic,
                        source: szcoAresLookup.source,
                      });
                      setSzcoData(prev => ({
                        ...prev,
                        obchodne_meno: szcoAresLookup.name || prev.obchodne_meno,
                        dic: szcoAresLookup.dic || prev.dic,
                        miesto_podnikania: [szcoAresLookup.street, szcoAresLookup.streetNumber, szcoAresLookup.zip, szcoAresLookup.city].filter(Boolean).join(", ") || prev.miesto_podnikania,
                      }));
                      setSzcoAresLookup(null);
                    }}
                    data-testid="button-szco-ares-use"
                  >
                    Použiť údaje z registra
                  </Button>
                </div>
              )}
              {szcoAresLookup && !szcoAresLookup.found && !szcoIcoError && (
                <p className="text-xs text-muted-foreground">{szcoAresLookup.message}</p>
              )}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Fyzická osoba (Majiteľ SZČO)</span>
                {szcoFoLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {szcoFoLinkedId && (
                  <div className="ml-auto flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      <Link2 className="w-3 h-3 mr-1" />
                      Prepojená FO #{szcoFoLinkedId}
                    </Badge>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => { setSzcoFoData(prev => ({ ...prev, fo_uid: "" })); setSzcoFoLinkedId(null); }} data-testid="button-szco-fo-odpojit">Odpojiť</Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1 w-[220px] min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Vyhľadať existujúcu FO (421...)</Label>
                  <Input
                    value={szcoFoData.fo_uid}
                    onChange={e => setSzcoFoData(prev => ({ ...prev, fo_uid: e.target.value }))}
                    onBlur={async () => {
                      let val = szcoFoData.fo_uid.replace(/\s/g, '');
                      if (!val) return;
                      if (val.replace(/\D/g, '').length > 0 && val.replace(/\D/g, '').length < 15) {
                        val = smartPadUid(val, uidPrefix);
                      }
                      if (!val || val.length < 6) return;
                      setSzcoFoLoading(true);
                      try {
                        const resp = await fetch(`/api/subjects/search-fo?q=${encodeURIComponent(val)}`);
                        const data = await resp.json();
                        const match = data.find((fo: any) => fo.uid === val);
                        if (match) {
                          setSzcoFoData({ firstName: match.firstName || "", lastName: match.lastName || "", birthNumber: match.birthNumber || "", fo_uid: match.uid });
                          setSzcoFoLinkedId(match.id);
                        } else {
                          setSzcoFoData(prev => ({ ...prev, fo_uid: "" }));
                          toast({ title: "FO nebola nájdená", description: "Subjekt s týmto UID neexistuje v systéme.", variant: "destructive" });
                        }
                      } catch {
                        setSzcoFoData(prev => ({ ...prev, fo_uid: "" }));
                      }
                      setSzcoFoLoading(false);
                    }}
                    placeholder="421XXXXXXXXX"
                    className="font-mono"
                    data-testid="input-szco-fo-uid"
                  />
                  {!szcoFoData.fo_uid && !szcoFoLinkedId && (
                    <p className="text-[11px] text-muted-foreground">UID bude pridelený automaticky</p>
                  )}
                </div>
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Meno *</Label>
                  <Input
                    value={szcoFoData.firstName}
                    onChange={e => {
                      const raw = e.target.value;
                      setSzcoFoData(prev => ({ ...prev, firstName: capitalizeFirst(raw) }));
                    }}
                    data-testid="input-szco-firstname"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Priezvisko *</Label>
                  <Input
                    value={szcoFoData.lastName}
                    onChange={e => {
                      const raw = e.target.value;
                      setSzcoFoData(prev => ({ ...prev, lastName: capitalizeFirst(raw) }));
                    }}
                    data-testid="input-szco-lastname"
                  />
                </div>
                <div className="space-y-1 w-[180px] min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Rodné číslo</Label>
                  <Input
                    value={szcoFoData.birthNumber}
                    onChange={e => {
                      setSzcoFoData(prev => ({ ...prev, birthNumber: e.target.value }));
                      if (szcoFoRcError) {
                        const result = validateSlovakRC(e.target.value);
                        if (result.valid) setSzcoFoRcError(null);
                      }
                    }}
                    onBlur={async () => {
                      const val = szcoFoData.birthNumber.trim().replace(/[\s\/]/g, "");
                      if (!val || val.length < 6) { setSzcoFoRcError(null); return; }
                      const rcResult = validateSlovakRC(val);
                      if (!rcResult.valid) {
                        setSzcoFoRcError(rcResult.error || "Neplatné rodné číslo");
                        return;
                      }
                      setSzcoFoRcError(null);
                      setSzcoFoLoading(true);
                      try {
                        const resp = await fetch(`/api/subjects/search-fo?q=${encodeURIComponent(val)}`);
                        const data = await resp.json();
                        if (data.length === 1) {
                          const fo = data[0];
                          setSzcoFoData({ firstName: fo.firstName || "", lastName: fo.lastName || "", birthNumber: fo.birthNumber || "", fo_uid: fo.uid });
                          setSzcoFoLinkedId(fo.id);
                        }
                      } catch {}
                      setSzcoFoLoading(false);
                    }}
                    placeholder="XXXXXX/XXXX"
                    className={szcoFoRcError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    data-testid="input-szco-rc"
                  />
                  {szcoFoRcError && (
                    <p className="text-[10px] text-red-500" data-testid="text-szco-rc-error">{szcoFoRcError}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {isPerson ? (() => {
                const FO_POVINNE_ROWS: { keys: string[] }[] = [
                  { keys: ["titul_pred", "meno", "priezvisko", "titul_za"] },
                  { keys: ["rodne_priezvisko", "datum_narodenia", "vek", "pohlavie"] },
                  { keys: ["miesto_narodenia", "statna_prislusnost"] },
                ];

                const DOCUMENT_TYPES = ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"];

                const addNewDocument = () => {
                  const newDoc: DocumentEntry = {
                    id: crypto.randomUUID(),
                    documentType: "",
                    documentNumber: "",
                    validUntil: "",
                    issuedBy: "",
                    issuingAuthorityCode: "",
                  };
                  setDocuments(prev => [...prev, newDoc]);
                };

                const updateDocument = (docId: string, field: keyof DocumentEntry, value: string) => {
                  setDocuments(prev => prev.map(d => d.id === docId ? { ...d, [field]: value } : d));
                };

                const removeDocument = (docId: string) => {
                  setDocuments(prev => prev.filter(d => d.id !== docId));
                };

                const isDocExpired = (validUntil?: string) => getDocumentValidityStatus(validUntil).status === "expired";
                const isDocExpiringSoon = (validUntil?: string) => getDocumentValidityStatus(validUntil).status === "expiring";

                const getFieldWidthClass = (fieldKey: string): string => {
                  switch (fieldKey) {
                    case "titul_pred":
                    case "titul_za":
                      return "w-[100px] min-w-[80px] shrink-0";
                    case "vek":
                      return "w-[80px] min-w-[60px] shrink-0";
                    case "pohlavie":
                      return "w-[130px] min-w-[100px] shrink-0";
                    case "datum_narodenia":
                    case "platnost_dokladu":
                      return "w-[160px] min-w-[140px] shrink-0";
                    case "meno":
                    case "priezvisko":
                    case "rodne_priezvisko":
                      return "flex-1 min-w-[150px]";
                    default:
                      return "flex-1 min-w-[140px]";
                  }
                };

                const ADDRESS_PANEL_FIELDS = {
                  tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
                  ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
                  koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
                };
                const ADDRESS_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];
                const allAddressKeys = new Set([
                  ...Object.values(ADDRESS_PANEL_FIELDS).flatMap(p => p.keys),
                  ...ADDRESS_SWITCH_KEYS,
                ]);

                const DOC_FIELD_KEYS = ["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"];
                const CONTACT_FIELD_KEYS = ["telefon", "email", "rodne_cislo"];
                const allRowKeys = new Set(FO_POVINNE_ROWS.flatMap(r => r.keys).concat(Array.from(allAddressKeys)).concat(CONTACT_FIELD_KEYS).concat(DOC_FIELD_KEYS));

                const povinneSection = typeSections?.find(s => (s as any).folderCategory === "povinne");
                const povinneFields = (typeFields || [])
                  .filter(f => povinneSection && (f.sectionId || 0) === povinneSection.id)
                  .filter(f => isFieldVisible(f));
                const povinneRemainder = povinneFields.filter(f => !allRowKeys.has(f.fieldKey)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

                const nonPovinneGroups: { section: any; fields: StaticField[] }[] = [];
                const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                for (const section of sectionsSorted) {
                  const category = (section as any).folderCategory || "volitelne";
                  if (category === "povinne") continue;
                  const sectionFields = (typeFields || [])
                    .filter(f => (f.sectionId || 0) === section.id)
                    .filter(f => isFieldVisible(f))
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                  if (sectionFields.length > 0) {
                    nonPovinneGroups.push({ section, fields: sectionFields });
                  }
                }

                return (
                  <>
                    <Accordion type="multiple" defaultValue={["povinne", "doplnkove", "volitelne"]} className="space-y-2">
                      <AccordionItem value="povinne" className="border rounded-md px-3" data-testid="editor-accordion-povinne">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS["povinne"]}</span>
                            <Badge variant="secondary" className="text-[10px]">{povinneFields.length + 3}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 space-y-2">
                          <div className="flex flex-wrap gap-4 items-end" data-testid="row-system-fields">
                            <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                              <Label className="text-xs">Kód klienta</Label>
                              <Input value="Automaticky generovaný" disabled className="font-mono text-xs" data-testid="input-kod-klienta" />
                            </div>
                            <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                              <Label className="text-xs">Typ klienta</Label>
                              <Input value={clientType?.name || "Fyzická osoba"} disabled data-testid="input-typ-klienta" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-[180px]">
                              <Label className="text-xs">Identifikátor (Rodné číslo)</Label>
                              <Input value={initialData.baseValue} disabled className="font-mono" data-testid="input-identifikator" />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 items-end" data-testid="row-ziskatel">
                            <div className="space-y-1 w-[250px] min-w-[200px]">
                              <Label className="text-xs">Získateľ</Label>
                              <Input
                                value={appUser ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username : ""}
                                disabled
                                data-testid="input-ziskatel"
                              />
                            </div>
                          </div>

                          <Card data-testid="panel-osobne-udaje">
                            <CardContent className="p-4 space-y-2">
                              <p className="text-sm font-semibold">Osobné údaje</p>
                              {FO_POVINNE_ROWS.map((row, rowIdx) => {
                                const rowEntries = row.keys
                                  .map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
                                const hasAny = rowEntries.some(e => e.field) || rowEntries.some(e => e.key === "statna_prislusnost");
                                if (!hasAny || rowEntries.length === 0) return null;
                                return (
                                  <div key={rowIdx} className="flex flex-wrap gap-4 items-end" data-testid={`row-povinne-${rowIdx + 3}`}>
                                    {rowEntries.map(({ key, field }) => {
                                      const widthClass = getFieldWidthClass(key);
                                      if (key === "statna_prislusnost") {
                                        const label = field?.label || "Štátna príslušnosť";
                                        const shortLbl = field?.shortLabel;
                                        const isReq = field?.isRequired;
                                        const hasErr = validationErrors.has(key);
                                        const prioritySet = new Set(PRIORITY_COUNTRY_NAMES);
                                        const restCountries = ALL_COUNTRY_NAMES.filter(c => !prioritySet.has(c));
                                        return (
                                          <div key={key} className={cn("space-y-1 min-w-0", widthClass)}>
                                            <Label className={`text-xs block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>
                                              {shortLbl ? (
                                                <>
                                                  <span className="hidden lg:inline">{label}</span>
                                                  <span className="inline lg:hidden">{shortLbl}</span>
                                                </>
                                              ) : label}
                                              {isReq ? " *" : ""}
                                            </Label>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", hasErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[key] && "text-muted-foreground")} data-testid="select-statna-prislusnost">
                                                  <span className="truncate">{dynamicValues[key] || ""}</span>
                                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command>
                                                  <CommandInput placeholder="Hľadať krajinu..." />
                                                  <CommandList>
                                                    <CommandEmpty>Krajina nenájdená.</CommandEmpty>
                                                    <CommandGroup heading="Prioritné">
                                                      {PRIORITY_COUNTRY_NAMES.map(c => (
                                                        <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                          <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                          {c}
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                    <CommandGroup heading="Všetky krajiny">
                                                      {restCountries.map(c => (
                                                        <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                          <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                          {c}
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                  </CommandList>
                                                </Command>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        );
                                      }
                                      const rcSource = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim() || "";
                                      const rcParsedResult = rcSource ? parseRodneCislo(rcSource) : {};
                                      const isRcAuto = (key === "pohlavie" && !!rcParsedResult.pohlavie) || (key === "datum_narodenia" && !!rcParsedResult.datumNarodenia) || (key === "vek" && !!rcParsedResult.datumNarodenia);
                                      const rawFieldDef = (typeFields || []).find(f => f.fieldKey === key);
                                      const hasVisibilityRule = rawFieldDef?.visibilityRule;
                                      const isVisibleByRule = hasVisibilityRule ? isFieldVisible(rawFieldDef!) : true;
                                      const resolvedField = field || (hasVisibilityRule ? rawFieldDef : null);
                                      if (resolvedField) {
                                        return (
                                          <div key={key} className={cn("space-y-1 min-w-0", widthClass)} style={!isVisibleByRule ? { display: "none" } : undefined}>
                                            <Label className={`text-xs block ${key === "typ_dokladu_iny" && !dynamicValues[key] ? "text-orange-500 font-semibold" : validationErrors.has(key) ? "text-red-500" : "text-muted-foreground"}`}>
                                              {key === "typ_dokladu_iny" ? (
                                                <span>Uveďte typ dokladu *</span>
                                              ) : resolvedField.shortLabel ? (
                                                <>
                                                  <span className="hidden lg:inline">{resolvedField.label || key}</span>
                                                  <span className="inline lg:hidden">{resolvedField.shortLabel}</span>
                                                </>
                                              ) : (
                                                <span>{resolvedField.label || key}</span>
                                              )}
                                              {key !== "typ_dokladu_iny" && resolvedField.isRequired ? " *" : ""}
                                            </Label>
                                            {resolvedField.fieldType === "number" && resolvedField.fieldKey === "vek" ? (
                                              <div className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap" data-testid={`input-dynamic-${resolvedField.fieldKey}`}>
                                                {dynamicValues[resolvedField.fieldKey] ? `${dynamicValues[resolvedField.fieldKey]} rokov` : ""}
                                              </div>
                                            ) : resolvedField.fieldType === "jedna_moznost" && resolvedField.fieldKey === "pohlavie" ? (
                                              <>
                                                <div style={{ display: isRcAuto ? undefined : "none" }} className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap" data-testid={`display-dynamic-${resolvedField.fieldKey}`}>
                                                  {dynamicValues[resolvedField.fieldKey] === "muž" ? "Muž" : dynamicValues[resolvedField.fieldKey] === "žena" ? "Žena" : dynamicValues[resolvedField.fieldKey] || ""}
                                                </div>
                                                <div style={{ display: isRcAuto ? "none" : undefined }}>
                                                  <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))}>
                                                    <SelectTrigger className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
                                                      <SelectValue placeholder="" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {(resolvedField.options || []).map((opt: string) => (
                                                        <SelectItem key={opt} value={opt}>{opt === "muž" ? "Muž" : opt === "žena" ? "Žena" : opt}</SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </>
                                            ) : resolvedField.fieldType === "jedna_moznost" ? (
                                              <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))}>
                                                <SelectTrigger className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
                                                  <SelectValue placeholder="" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {(resolvedField.options || []).map((opt: string) => (
                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : resolvedField.fieldType === "date" ? (
                                              (() => {
                                                const dateVal = dynamicValues[resolvedField.fieldKey] || "";
                                                let validityClass = "";
                                                let validityLabel = "";
                                                if (resolvedField.fieldKey === "platnost_dokladu" && dateVal) {
                                                  const expiry = new Date(dateVal);
                                                  const now = new Date();
                                                  const threeMonths = new Date();
                                                  threeMonths.setMonth(threeMonths.getMonth() + 3);
                                                  if (expiry < now) {
                                                    validityClass = "border-red-500 bg-red-500/10 ring-1 ring-red-500";
                                                    validityLabel = "Neplatný";
                                                  } else if (expiry < threeMonths) {
                                                    validityClass = "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500";
                                                    validityLabel = "Končiaci";
                                                  }
                                                }
                                                return (
                                                  <div className="relative">
                                                    <Input
                                                      type="date"
                                                      value={dateVal}
                                                      onChange={e => { if (isRcAuto) return; setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: e.target.value })); }}
                                                      readOnly={isRcAuto}
                                                      tabIndex={isRcAuto ? -1 : undefined}
                                                      className={cn(validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : validityClass, isRcAuto && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
                                                      data-testid={`input-dynamic-${resolvedField.fieldKey}`}
                                                    />
                                                    {validityLabel && (
                                                      <span className={cn(
                                                        "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none",
                                                        validityLabel === "Neplatný" ? "text-red-500" : "text-orange-500"
                                                      )} data-testid={`validity-status-${resolvedField.fieldKey}`}>
                                                        {validityLabel}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()
                                            ) : key === "typ_dokladu_iny" ? (
                                              <Input
                                                placeholder="Napr. Preukaz diplomata"
                                                value={dynamicValues[key] || ""}
                                                onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                className={dynamicValues[key] ? "" : "border-orange-500 ring-1 ring-orange-500 bg-orange-500/5"}
                                                data-testid={`input-${key}`}
                                              />
                                            ) : (
                                              <Input
                                                placeholder=""
                                                value={dynamicValues[key] || ""}
                                                onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""}
                                                data-testid={`input-${key}`}
                                              />
                                            )}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={key} className={cn("space-y-1 min-w-0", widthClass)}>
                                          <Label className={`text-xs block text-muted-foreground ${validationErrors.has(key) ? "text-red-500" : ""}`}>{key}</Label>
                                          <Input placeholder="" value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`input-${key}`} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </CardContent>
                          </Card>

                          <Card data-testid="panel-doklady-totoznosti">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-primary" />
                                  <p className="text-sm font-semibold">Doklady totožnosti</p>
                                  <Badge variant="secondary" className="text-[10px]">{documents.length}</Badge>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addNewDocument} data-testid="button-add-document">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Pridať doklad
                                </Button>
                              </div>

                              {documents.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground" data-testid="text-no-documents">
                                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p className="text-sm">Žiadne doklady totožnosti</p>
                                  <p className="text-xs">Kliknite "Pridať doklad" pre pridanie dokladu</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {documents.map((doc, docIdx) => {
                                  const expired = isDocExpired(doc.validUntil);
                                  const expiringSoon = isDocExpiringSoon(doc.validUntil);
                                  const borderColor = expired ? "border-red-500/50" : expiringSoon ? "border-orange-500/50" : "border-border";
                                  return (
                                    <Card key={doc.id} className={cn("relative", borderColor)} data-testid={`card-document-${docIdx}`}>
                                      <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex items-center gap-1.5">
                                            {expired && <Badge variant="destructive" className="text-[10px]">Expirovaný</Badge>}
                                            {expiringSoon && !expired && <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">Expiruje čoskoro</Badge>}
                                            {!expired && !expiringSoon && doc.validUntil && <Badge variant="secondary" className="text-[10px]">Platný</Badge>}
                                          </div>
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(doc.id)} data-testid={`button-remove-document-${docIdx}`}>
                                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                          </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Typ dokladu *</Label>
                                            <Select value={doc.documentType || ""} onValueChange={val => updateDocument(doc.id, "documentType", val)}>
                                              <SelectTrigger data-testid={`select-doc-type-${docIdx}`}>
                                                <SelectValue placeholder="Vyberte typ" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {DOCUMENT_TYPES.map(t => (
                                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          {doc.documentType === "Iný" && (
                                            <div className="space-y-1 flex-1 min-w-[140px]">
                                              <Label className={cn("text-xs", !doc.customDocType ? "text-orange-500 font-semibold" : "text-muted-foreground")}>Špecifikácia dokladu *</Label>
                                              <Input
                                                value={doc.customDocType || ""}
                                                onChange={e => updateDocument(doc.id, "customDocType", e.target.value)}
                                                placeholder="Uveďte typ dokladu"
                                                className={!doc.customDocType ? "border-orange-500/50" : ""}
                                                data-testid={`input-doc-custom-type-${docIdx}`}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Číslo dokladu *</Label>
                                            <Input
                                              value={doc.documentNumber || ""}
                                              onChange={e => updateDocument(doc.id, "documentNumber", e.target.value)}
                                              data-testid={`input-doc-number-${docIdx}`}
                                            />
                                          </div>
                                          <div className="space-y-1 w-[160px] min-w-[140px] shrink-0">
                                            <Label className={cn("text-xs", expired ? "text-red-500 font-semibold" : expiringSoon ? "text-orange-500" : "text-muted-foreground")}>Platnosť do</Label>
                                            <Input
                                              type="date"
                                              value={doc.validUntil || ""}
                                              onChange={e => updateDocument(doc.id, "validUntil", e.target.value)}
                                              className={expired ? "border-red-500/50" : expiringSoon ? "border-orange-500/50" : ""}
                                              data-testid={`input-doc-valid-${docIdx}`}
                                            />
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Vydávajúci orgán</Label>
                                            <Input
                                              value={doc.issuedBy || ""}
                                              onChange={e => updateDocument(doc.id, "issuedBy", e.target.value)}
                                              data-testid={`input-doc-issued-${docIdx}`}
                                            />
                                          </div>
                                          <div className="space-y-1 flex-1 min-w-[120px]">
                                            <Label className="text-xs text-muted-foreground">Kód orgánu</Label>
                                            <Input
                                              value={doc.issuingAuthorityCode || ""}
                                              onChange={e => updateDocument(doc.id, "issuingAuthorityCode", e.target.value)}
                                              data-testid={`input-doc-authority-${docIdx}`}
                                            />
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>

                          {(() => {
                            const korRespondRovnaka = dynamicValues["korespond_rovnaka"] === "true";
                            const kontaktnaRovnaka = dynamicValues["kontaktna_rovnaka"] === "true";

                            const ADDR_FALLBACK_LABELS: Record<string, string> = {
                              ulica: "Ulica", supisne: "Súpisné číslo", orientacne: "Orientačné číslo",
                              psc: "PSČ", mesto: "Mesto", stat: "Štát",
                            };

                            const isAddrFieldHidden = (_key: string) => false;

                            const renderAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                              const findField = (key: string) => povinneFields.find(f => f.fieldKey === key);
                              const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                              const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: isAddrFieldHidden(k) }));
                              const visibleFields = fields.filter(f => !f.hidden);
                              const isRequired = (key: string) => panelDef.requiredKeys.includes(key);

                              if (visibleFields.length === 0) return null;

                              const ADDR_SHORT_LABELS: Record<string, string> = {
                                ulica: "Ulica", supisne: "Súpisné č.", orientacne: "Orient. č.",
                                psc: "PSČ", mesto: "Obec / Mesto", stat: "Štát",
                              };

                              const renderAddrField = (key: string, field: StaticField | undefined, suffix: string, widthPct?: number) => {
                                const label = ADDR_SHORT_LABELS[suffix] || ADDR_FALLBACK_LABELS[suffix] || suffix;
                                const req = isRequired(key);
                                const hasErr = validationErrors.has(key);
                                const wrapStyle = widthPct ? { flex: `0 1 ${widthPct}%`, minWidth: 0 } : {};
                                return (
                                  <div key={key} style={{ ...wrapStyle, pointerEvents: disabled ? "none" : "auto" }}>
                                    <div className="space-y-1">
                                      <Label className={`text-xs truncate block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>{label}{req ? " *" : ""}</Label>
                                      <Input
                                        disabled={disabled}
                                        value={dynamicValues[key] || ""}
                                        onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                        className={hasErr ? "border-red-500 ring-1 ring-red-500" : ""}
                                        data-testid={`input-addr-${key}`}
                                      />
                                    </div>
                                  </div>
                                );
                              };

                              const getF = (suffix: string) => visibleFields.find(f => f.suffix === suffix);
                              const fUlica = getF("ulica");
                              const fSupisne = getF("supisne");
                              const fOrientacne = getF("orientacne");
                              const fPsc = getF("psc");
                              const fMesto = getF("mesto");
                              const fStat = getF("stat");

                              return (
                                <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`panel-address-${prefix}`}>
                                  <CardContent className="p-4 space-y-2">
                                    <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                                    {fUlica && (
                                      <div data-testid={`addr-row-ulica-${prefix}`}>
                                        {renderAddrField(fUlica.key, fUlica.field, fUlica.suffix)}
                                      </div>
                                    )}
                                    {(fSupisne || fOrientacne) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-cisla-${prefix}`}>
                                        {fSupisne && renderAddrField(fSupisne.key, fSupisne.field, fSupisne.suffix, 50)}
                                        {fOrientacne && renderAddrField(fOrientacne.key, fOrientacne.field, fOrientacne.suffix, 50)}
                                      </div>
                                    )}
                                    {(fPsc || fMesto) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-psc-mesto-${prefix}`}>
                                        {fPsc && renderAddrField(fPsc.key, fPsc.field, fPsc.suffix, 30)}
                                        {fMesto && renderAddrField(fMesto.key, fMesto.field, fMesto.suffix, 70)}
                                      </div>
                                    )}
                                    {fStat && (
                                      <div data-testid={`addr-row-stat-${prefix}`}>
                                        {(() => {
                                          const statKey = fStat.key;
                                          const statLabel = ADDR_SHORT_LABELS["stat"] || "Štát";
                                          const statReq = isRequired(statKey);
                                          const statErr = validationErrors.has(statKey);
                                          const pSet = new Set(PRIORITY_COUNTRY_NAMES);
                                          const restC = ALL_COUNTRY_NAMES.filter(c => !pSet.has(c));
                                          return (
                                            <div style={{ pointerEvents: disabled ? "none" : "auto" }}>
                                              <div className="space-y-1">
                                                <Label className={`text-xs truncate block ${statErr ? "text-red-500" : "text-muted-foreground"}`}>{statLabel}{statReq ? " *" : ""}</Label>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", statErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[statKey] && "text-muted-foreground")} data-testid={`select-addr-stat-${prefix}`}>
                                                      <span className="truncate">{dynamicValues[statKey] || "Vyberte štát..."}</span>
                                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                      <CommandInput placeholder="Hľadať štát..." />
                                                      <CommandList>
                                                        <CommandEmpty>Štát nenájdený.</CommandEmpty>
                                                        <CommandGroup heading="Prioritné">
                                                          {PRIORITY_COUNTRY_NAMES.map(c => (
                                                            <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [statKey]: c })); if (statErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(statKey); return n; }); }}>
                                                              <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                                              {c}
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                        <CommandGroup heading="Všetky krajiny">
                                                          {restC.map(c => (
                                                            <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [statKey]: c })); if (statErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(statKey); return n; }); }}>
                                                              <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                                              {c}
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                      </CommandList>
                                                    </Command>
                                                  </PopoverContent>
                                                </Popover>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            };

                            const showKa = !korRespondRovnaka;
                            const showKoa = !kontaktnaRovnaka;
                            const panelCount = 1 + (showKa ? 1 : 0) + (showKoa ? 1 : 0);

                            return (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1" data-testid="row-address-switches">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={korRespondRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))}
                                      data-testid="switch-korespond-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>
                                      Adresa prechodného pobytu je totožná z adresou trvalého pobytu
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={kontaktnaRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))}
                                      data-testid="switch-kontaktna-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>
                                      Kontaktná adresa je totožná z korešpondenčnou adresou
                                    </Label>
                                  </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-3 items-start" data-testid="row-address-panels">
                                  <div className="w-full" style={{ flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("tp", ADDRESS_PANEL_FIELDS.tp, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("ka", ADDRESS_PANEL_FIELDS.ka, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKoa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("koa", ADDRESS_PANEL_FIELDS.koa, false)}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <Card data-testid="panel-kontaktne-udaje">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-primary" />
                                  <p className="text-sm font-semibold">Kontaktné údaje</p>
                                  <Badge variant="secondary" className="text-[10px]">{contacts.length}</Badge>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setContacts(prev => [...prev, { id: crypto.randomUUID(), type: "phone", value: "", label: "" }])} data-testid="button-add-phone">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Telefón
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setContacts(prev => [...prev, { id: crypto.randomUUID(), type: "email", value: "", label: "" }])} data-testid="button-add-email">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Email
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {contacts.map((contact, cIdx) => (
                                  <div key={contact.id} className="flex flex-wrap gap-3 items-end p-2 rounded-md border border-border bg-muted/20" data-testid={`contact-row-${cIdx}`}>
                                    <div className="space-y-1 w-[100px] min-w-[80px] shrink-0">
                                      <Label className="text-xs text-muted-foreground">Typ</Label>
                                      <Select value={contact.type} onValueChange={val => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, type: val as "phone" | "email" } : c))}>
                                        <SelectTrigger data-testid={`select-contact-type-${cIdx}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="phone">Telefón</SelectItem>
                                          <SelectItem value="email">Email</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1 flex-1 min-w-[160px]">
                                      <Label className="text-xs text-muted-foreground">{contact.type === "phone" ? "Telefónne číslo" : "Emailová adresa"} {contact.isPrimary ? "*" : ""}</Label>
                                      {contact.type === "phone" ? (
                                        <PhoneInput
                                          value={contact.value}
                                          onChange={val => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, value: val } : c))}
                                          initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
                                          data-testid={`input-contact-value-${cIdx}`}
                                        />
                                      ) : (
                                        <Input
                                          type="email"
                                          value={contact.value}
                                          onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, value: e.target.value } : c))}
                                          placeholder="meno@priklad.sk"
                                          data-testid={`input-contact-value-${cIdx}`}
                                        />
                                      )}
                                    </div>
                                    <div className="space-y-1 w-[120px] min-w-[100px] shrink-0">
                                      <Label className="text-xs text-muted-foreground">Označenie</Label>
                                      <Input
                                        value={contact.label || ""}
                                        onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, label: e.target.value } : c))}
                                        placeholder="napr. Osobný"
                                        data-testid={`input-contact-label-${cIdx}`}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 pb-0.5">
                                      {!contact.isPrimary && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setContacts(prev => prev.map(c => c.type === contact.type ? { ...c, isPrimary: c.id === contact.id } : c))} title="Nastaviť ako primárny" data-testid={`button-set-primary-${cIdx}`}>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                                        </Button>
                                      )}
                                      {contact.isPrimary && (
                                        <Badge variant="secondary" className="text-[10px]">Primárny</Badge>
                                      )}
                                      {contacts.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => {
                                          setContacts(prev => {
                                            const remaining = prev.filter(c => c.id !== contact.id);
                                            if (contact.isPrimary) {
                                              const nextOfType = remaining.find(c => c.type === contact.type);
                                              if (nextOfType) nextOfType.isPrimary = true;
                                            }
                                            return [...remaining];
                                          });
                                        }} data-testid={`button-remove-contact-${cIdx}`}>
                                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {povinneRemainder.length > 0 && (
                                <div className="flex flex-wrap gap-4 items-end" data-testid="row-kontakt-fields-remainder">
                                  {povinneRemainder.map(field => (
                                    <div key={field.id} className={cn("min-w-0 flex-1 min-w-[140px]", flashingFields.has(field.fieldKey) && "field-imported-flash")}>
                                      <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </AccordionContent>
                      </AccordionItem>

                      {(["doplnkove", "volitelne"] as const).map(category => {
                        const Icon = FOLDER_CATEGORY_ICONS[category];
                        const groups = nonPovinneGroups.filter(g => (g.section as any).folderCategory === category);
                        const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                        if (totalFields === 0) return null;
                        return (
                          <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-2">
                                {groups.map(({ section, fields }) => (
                                  <div key={section.id} className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    {(() => {
                                      const byRow: Record<number, StaticField[]> = {};
                                      for (const f of fields) { const r = f.rowNumber ?? 0; if (!byRow[r]) byRow[r] = []; byRow[r].push(f); }
                                      return Object.keys(byRow).map(Number).sort((a, b) => a - b).map(rowNum => (
                                        <div key={rowNum} className="flex flex-wrap gap-3 items-end">
                                          {byRow[rowNum].map((field: StaticField) => {
                                            const wp = field.widthPercent || 50;
                                            return (
                                              <div key={field.id} className={cn("min-w-0 shrink", flashingFields.has(field.fieldKey) && "field-imported-flash")} style={{ flexBasis: `calc(${wp}% - 0.75rem)`, minWidth: wp <= 20 ? '70px' : '100px' }}>
                                                <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                  </>
                );
              })() : (
                <>
                  {!isSzcoType && (
                    <>
                      <FormField control={form.control} name="companyName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Názov spoločnosti</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-companyname" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div>
                        <Label className="text-xs text-muted-foreground">{isOsType ? "Identifikátor" : "IČO"}</Label>
                        <Input value={initialData.baseValue} disabled className="mt-1" data-testid="input-ico-locked" />
                      </div>
                    </>
                  )}

                  {typeFields && typeFields.length > 0 && (() => {
                    const typePanels = getPanelsForClientTypeId(editorClientTypeId);
                    const editorFieldGroups: Record<string, { section: any; panelGroups: { panel: StaticPanel | null; fields: StaticField[] }[] }[]> = {
                      povinne: [], doplnkove: [], volitelne: [],
                    };
                    const SZCO_HARDCODED_KEYS = new Set([
                      'nazov_firmy', 'nazov_organizacie', 'ico', 'dic', 'ic_dph',
                      'meno', 'priezvisko', 'rodne_cislo',
                      'email', 'telefon',
                    ]);
                    const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    for (const section of sectionsSorted) {
                      const category = (section as any).folderCategory || "volitelne";
                      const sectionFields = (typeFields || [])
                        .filter(f => (f.sectionId || 0) === section.id)
                        .filter(f => isFieldVisible(f))
                        .filter(f => !isSzcoType || !SZCO_HARDCODED_KEYS.has(f.fieldKey));
                      if (sectionFields.length === 0) continue;
                      const sectionPanels = typePanels
                        .filter(p => p.sectionId === section.id)
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                      const panelGroups: { panel: StaticPanel | null; fields: StaticField[] }[] = [];
                      for (const panel of sectionPanels) {
                        const panelFields = sectionFields
                          .filter(f => f.panelId === panel.id)
                          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                        if (panelFields.length > 0) panelGroups.push({ panel, fields: panelFields });
                      }
                      const noPanelFields = sectionFields
                        .filter(f => !f.panelId || !sectionPanels.find(p => p.id === f.panelId))
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                      if (noPanelFields.length > 0) panelGroups.push({ panel: null, fields: noPanelFields });
                      if (panelGroups.length > 0) {
                        if (!editorFieldGroups[category]) editorFieldGroups[category] = [];
                        editorFieldGroups[category].push({ section, panelGroups });
                      }
                    }
                    return (
                      <div className="space-y-2 pt-2">
                        <Separator />
                        <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
                          {FOLDER_CATEGORY_ORDER.map(category => {
                            const Icon = FOLDER_CATEGORY_ICONS[category];
                            const groups = editorFieldGroups[category] || [];
                            const totalFields = groups.reduce((acc, g) => acc + g.panelGroups.reduce((s, pg) => s + pg.fields.length, 0), 0);
                            if (totalFields === 0) return null;
                            return (
                              <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                                <AccordionTrigger className="py-3 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                    <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                  <div className="space-y-4">
                                    {groups.flatMap(({ section, panelGroups }) =>
                                      panelGroups.map(({ panel, fields }, pi) => (
                                        <div key={panel ? panel.id : `no-panel-${section.id}-${pi}`} className="space-y-2">
                                          {panel && (
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{panel.name}</p>
                                          )}
                                          {(() => {
                                            const byRow: Record<number, StaticField[]> = {};
                                            for (const f of fields) { const r = f.rowNumber ?? 0; if (!byRow[r]) byRow[r] = []; byRow[r].push(f); }
                                            return Object.keys(byRow).map(Number).sort((a, b) => a - b).map(rowNum => (
                                              <div key={rowNum} className="flex flex-wrap gap-3 items-end">
                                                {byRow[rowNum].map((field: StaticField) => {
                                                  const wp = field.widthPercent || 50;
                                                  return (
                                                    <div key={field.id} className={cn("min-w-0 shrink", flashingFields.has(field.fieldKey) && "field-imported-flash")} style={{ flexBasis: `calc(${wp}% - 0.75rem)`, minWidth: wp <= 20 ? '70px' : '100px' }}>
                                                      <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ));
                                          })()}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Integritne upozornenie:</strong> Vytvorenie subjektu vygeneruje permanentny, nemenitelny
                  unikatny identifikator. Vsetky budu zmeny archivovane.
                </p>
              </div>

              <div className="flex justify-end gap-2 sticky bottom-0 bg-card pt-3 pb-1 border-t border-border">
                <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-subject">Zrusit</Button>
                <Button type="submit" disabled={isPending} data-testid="button-save-subject">
                  {isPending ? "Registrujem..." : "Registrovat subjekt"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

const INIT_STEP_TYPE_CODES = ["FO", "SZCO", "PO", "OS"];

function InitStep({ onProceed }: { onProceed: (data: InitialData) => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [baseValue, setBaseValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: appUser } = useAppUser();

  const filteredTypes = (clientTypes || []).filter(ct => INIT_STEP_TYPE_CODES.includes(ct.code));
  const selectedClientType = filteredTypes.find(ct => ct.code === selectedType);
  const isRc = selectedClientType?.baseParameter === "rc";
  const isOsSelected = selectedClientType?.code === "OS";
  const isActive = hovered || pressed;

  function handleProceed() {
    if (!selectedType) { setError("Vyberte typ subjektu"); return; }
    if (!baseValue.trim()) { setError(isRc ? "Zadajte rodné číslo" : isOsSelected ? "Zadajte identifikátor" : "Zadajte IČO"); return; }
    const stateId = appUser?.activeStateId ?? 1;
    setError(null);
    onProceed({ clientTypeCode: selectedType, stateId, baseValue: baseValue.trim() });
  }

  const PW = 380; const PH = 96; const PR = 38;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8 p-8">
      {/* Pill – purely decorative, no click action */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        style={{
          position: "relative",
          width: PW,
          height: PH,
          userSelect: "none",
          transition: "transform 0.15s ease",
          transform: pressed ? "scale(0.97)" : hovered ? "scale(1.03)" : "scale(1)",
        }}
      >
        <svg
          width={PW}
          height={PH}
          viewBox={`0 0 ${PW} ${PH}`}
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="pillGlow" x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="12" result="blur" />
            </filter>
            <linearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          <rect
            x="8" y="8" width={PW - 16} height={PH - 16} rx={PR}
            fill={isActive ? "rgba(56,189,248,0.60)" : "rgba(56,189,248,0.30)"}
            filter="url(#pillGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          <rect
            x="8" y="8" width={PW - 16} height={PH - 16} rx={PR}
            fill="url(#pillGrad)"
            stroke={isActive ? "rgba(96,184,248,0.65)" : "rgba(56,189,248,0.25)"}
            strokeWidth="1.5"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute",
          top: 8, left: 8, right: 8, bottom: 8,
          display: "flex",
          alignItems: "center",
          paddingLeft: 32,
          paddingRight: 32,
          gap: 20,
        }}>
          <UserPlus
            size={42}
            strokeWidth={1.4}
            style={{
              color: "#60b8f8",
              filter: `drop-shadow(0 0 ${isActive ? 10 : 6}px rgba(96,184,248,${isActive ? 0.9 : 0.55}))`,
              transition: "filter 0.15s ease",
              flexShrink: 0,
            }}
          />
          <div style={{ width: 1, height: 44, background: "rgba(96,184,248,0.22)", flexShrink: 0 }} />
          <span style={{
            fontFamily: "sans-serif",
            fontSize: 19,
            fontWeight: 700,
            color: "#b8d0f0",
            letterSpacing: "0.05em",
          }}>
            Pridať subjekt
          </span>
        </div>
      </div>

      {/* Simple form */}
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="init-type">Typ subjektu</Label>
          <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setBaseValue(""); setError(null); }}>
            <SelectTrigger id="init-type" data-testid="select-subject-type">
              <SelectValue placeholder="Vyberte typ..." />
            </SelectTrigger>
            <SelectContent>
              {filteredTypes.map(ct => (
                <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedType && (
          <div className="space-y-1.5">
            <Label htmlFor="init-base">{isRc ? "Rodné číslo" : isOsSelected ? "Identifikátor" : "IČO"}</Label>
            <Input
              id="init-base"
              data-testid="input-base-value"
              placeholder={isRc ? "napr. 900101/1234" : isOsSelected ? "Zadajte identifikátor (číslo registrácie / ID)..." : "napr. 12345678"}
              value={baseValue}
              onChange={e => { setBaseValue(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === "Enter") handleProceed(); }}
              autoFocus
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel-init">
            Zrušiť
          </Button>
          <Button type="button" onClick={handleProceed} data-testid="button-proceed-init">
            Pokračovať
          </Button>
        </div>
      </div>
    </div>
  );
}


export default function PridatSubjekt() {
  const [initialData, setInitialData] = useState<InitialData | null>(() => {
    const raw = sessionStorage.getItem('pridat_subjekt_data');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('pridat_subjekt_data');
      return parsed;
    } catch {
      return null;
    }
  });

  if (!initialData) {
    return <InitStep onProceed={(data) => setInitialData(data)} />;
  }

  return (
    <FullPageEditor
      initialData={initialData}
      onCancel={() => window.history.back()}
    />
  );
}
