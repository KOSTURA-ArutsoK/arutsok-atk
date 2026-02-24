import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, ClientDataTab, ClientDataCategory, ClientMarketingConsent, ClientType, SubjectCollaborator, SubjectFieldHistory, SubjectAddress } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, type StaticField } from "@/lib/staticFieldDefs";
import { useSubjectSchema, type DynamicField } from "@/hooks/use-subject-schema";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair, getValidityFromDateStatus, isValidityFromDateField } from "@/lib/document-validity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive, FileText, Eye, EyeOff, ChevronRight, Check, X, Plus, AlertTriangle, ShieldAlert, Ban, Link2, Unlink, Building2, User, ArrowLeftRight, History, UserPlus, ShieldCheck, Clock, Pencil, Save, MessageSquare, FileDown, MapPin, Mail, Trash2, Star, Network, ExternalLink, Heart, Baby, Crown, TreePine, Home, Bell, CheckCircle, Search, Shield, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateSlovak } from "@/lib/utils";
import { SubjectProfilePhoto } from "@/components/subject-profile-photo";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";

const SK_BANK_CODES: Record<string, string> = {
  "0200": "Všeobecná úverová banka (VÚB)",
  "0720": "Národná banka Slovenska",
  "0900": "Slovenská sporiteľňa",
  "1100": "Tatra banka",
  "1111": "UniCredit Bank",
  "3000": "Slovenská záručná a rozvojová banka",
  "3100": "Sberbank Slovensko",
  "5200": "OTP Banka Slovensko",
  "5600": "Prima banka Slovensko",
  "5900": "Prvá stavebná sporiteľňa",
  "6500": "Poštová banka",
  "7500": "Československá obchodná banka (ČSOB)",
  "8050": "Commerzbank",
  "8100": "Komerční banka",
  "8120": "Privatbanka",
  "8130": "Citibank Europe",
  "8160": "EXIMBANKA SR",
  "8170": "Komerční banka Bratislava",
  "8180": "Štátna pokladnica",
  "8320": "OTP Banka",
  "8330": "Fio banka",
  "8360": "mBank",
  "8370": "Oberbank",
  "8410": "365.bank",
};

function getBankFromIban(iban: string): string | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!cleaned.startsWith("SK") || cleaned.length !== 24) return null;
  const bankCode = cleaned.substring(4, 8);
  return SK_BANK_CODES[bankCode] || null;
}

function validateIban(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) return false;
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  const numStr = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }
  return remainder === 1;
}

const TAB_ICONS: Record<string, typeof UserCheck> = {
  UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive,
  FileText, Shield: Scale, Heart: Users, Building2,
};

function getTabIcon(iconName: string) {
  return TAB_ICONS[iconName] || FileText;
}

const FIELD_HINTS: Record<string, string> = {
  pep: "Politicky exponovaná osoba podľa AML zákona 297/2008 Z.z.",
  pep_funkcia: "Konkrétna verejná funkcia, ktorú osoba zastáva alebo zastávala",
  pep_vztah: "Vzťah k PEP osobe (rodinný príslušník, blízky spolupracovník)",
  kuv_meno_1: "Konečný užívateľ výhod – osoba s podielom ≥25% alebo kontrolou nad subjektom",
  kuv_rc_1: "Rodné číslo KUV pre jednoznačnú identifikáciu",
  kuv_podiel_1: "Percentuálny podiel KUV na základnom imaní alebo hlasovacích právach",
  kuv_meno_2: "Druhý konečný užívateľ výhod",
  kuv_rc_2: "Rodné číslo druhého KUV",
  kuv_podiel_2: "Podiel druhého KUV",
  kuv_meno_3: "Tretí konečný užívateľ výhod",
  kuv_rc_3: "Rodné číslo tretieho KUV",
  kuv_podiel_3: "Podiel tretieho KUV",
  cgn_rating: "Interný kreditný rating klienta (A=najlepší, E=najhorší)",
  marketing_email: "Súhlas so zasielaním marketingových emailov podľa GDPR",
  marketing_sms: "Súhlas so zasielaním SMS správ s ponukami",
  marketing_phone: "Súhlas s telefonickým oslovením s ponukami",
  data_processing: "Súhlas so spracovaním osobných údajov nad rámec zmluvy",
  third_party: "Súhlas s poskytnutím údajov partnerským spoločnostiam",
  profiling: "Súhlas s automatizovaným profilovaním na základe správania",
  ekon_pracovny_pomer: "Aktuálny pracovný pomer klienta – dôležitý pre posudzovanie bonity",
  ekon_zamestnavatel: "Názov zamestnávateľa alebo vlastnej firmy (SZČO/SRO)",
  ekon_pozicia: "Pracovná pozícia u zamestnávateľa",
  ekon_datum_nastupu: "Dátum nástupu do pracovného pomeru",
  ekon_cisty_prijem: "Čistý mesačný príjem po zdanení a odvodoch",
  ekon_zdroj_prijmu: "Zdroj príjmu (mzda, predaj majetku, dedičstvo) – dôležité pre AML",
  ekon_hlavny_iban: "Hlavný bankový účet klienta vo formáte IBAN (napr. SK31 1200 0000 1987 4263 7541)",
  ekon_banka: "Názov banky – automaticky doplnený podľa IBAN kódu",
  ekon_peo: "Politicky exponovaná osoba podľa AML zákona – verejná funkcia alebo vzťah k nej",
  ekon_peo_zdovodnenie: "Zdôvodnenie PEO statusu – konkrétna funkcia alebo vzťah",
  ekon_kuv: "Konečný užívateľ výhod – osoba profitujúca z obchodného vzťahu",
  voz_ecv: "Evidenčné číslo vozidla (ŠPZ) – povinný údaj z technického preukazu",
  voz_vin: "Identifikačné číslo vozidla – 17-miestny kód z technického preukazu",
  voz_cislo_tp: "Číslo technického preukazu (osvedčenia o evidencii vozidla)",
  voz_znacka: "Značka (výrobca) vozidla z technického preukazu",
  voz_model: "Model (typ) vozidla z technického preukazu",
  voz_vykon: "Najväčší čistý výkon motora v kW z technického preukazu",
  voz_objem: "Zdvihový objem motora v cm³ z technického preukazu",
  voz_hmotnost: "Najväčšia prípustná celková hmotnosť vozidla v kg",
  voz_palivo: "Druh paliva/pohonu vozidla z technického preukazu",
  voz_stk_platnost: "Dátum platnosti STK – semafor: zelená >90d, oranžová ≤90d, červená = neplatná",
  voz_ek_platnost: "Dátum platnosti emisnej kontroly – semafor: zelená >90d, oranžová ≤90d, červená = neplatná",
  voz_tachometer: "Aktuálny stav tachometra v km pri poslednej kontrole",
  voz_zabezpecenie: "Typ zabezpečenia vozidla (napr. VAM, Pandora, Jablotron, GPS lokátor)",
  real_typ_nehnutelnosti: "Typ nehnuteľnosti podľa poistnej zmluvy alebo znaleckého posudku",
  real_supisne_cislo: "Súpisné číslo nehnuteľnosti z listu vlastníctva",
  real_parcelne_cislo: "Parcelné číslo pozemku z listu vlastníctva (napr. 1234/5)",
  real_katastralne_uzemie: "Katastrálne územie, v ktorom sa nehnuteľnosť nachádza",
  real_cislo_lv: "Číslo listu vlastníctva z katastra nehnuteľností",
  real_rok_kolaudacie: "Rok kolaudácie nehnuteľnosti – kľúčové pre rizikovosť poistenia",
  real_rekon_strecha: "Rok poslednej rekonštrukcie strechy – znižuje riziko poistnej udalosti",
  real_rekon_rozvody: "Rok poslednej rekonštrukcie rozvodov (elektrina, voda, plyn)",
  real_rekon_kurenie: "Rok poslednej rekonštrukcie vykurovacieho systému",
  real_rozloha: "Rozloha obytnej plochy v m² – kľúčový parameter pre výpočet poistného",
  real_pocet_podlazi: "Počet podlaží nehnuteľnosti podľa znaleckého posudku",
  real_typ_konstrukcie: "Typ konštrukcie stavby – ovplyvňuje výšku poistného",
  real_typ_dveri: "Bezpečnostná trieda vstupných dverí (RC2–RC6) – zľava na poistnom",
  real_elektro_zabezpecenie: "Elektronický zabezpečovací systém – zľava na poistnom",
  real_protipoz_ochrana: "Protipožiarne zariadenia (senzory dymu/plynu, hasiace prístroje)",
  zdrav_vyska: "Výška klienta v centimetroch – údaj zo zdravotného dotazníka",
  zdrav_vaha: "Váha klienta v kilogramoch – údaj zo zdravotného dotazníka",
  zdrav_fajciar: "Fajčiarsky status klienta – ovplyvňuje sadzby životného poistenia",
  zdrav_rizikovy_sport: "Rizikové športové aktivity (paragliding, potápanie, motoršport) – príplatok k poistnému",
  zdrav_diagnozy: "Závažné zdravotné diagnózy v minulosti – citlivý údaj s obmedzeným prístupom",
  inv_typ_investora: "Profil investora podľa investičného dotazníka – určuje vhodnú investičnú stratégiu",
  inv_datum_dotaznika: "Dátum vyplnenia investičného dotazníka – semafor: zelená <12 mes., oranžová >12 mes. (zákonná revízia)",
  inv_skusenosti: "Úroveň skúseností klienta s investovaním podľa MiFID II",
};

const HINTED_CATEGORIES = new Set(["aml", "marketingove", "bonita", "behavioralne", "ekonomika", "vozidla", "reality", "zdravotny", "investicny"]);

const CATEGORY_HINTS: Record<string, string> = {
  aml: "Údaje vyžadované zákonom o AML (297/2008 Z.z.) – identifikácia konečných užívateľov výhod a politicky exponovaných osôb",
  marketingove: "Marketingové súhlasy a preferencie klienta podľa GDPR nariadenia",
  bonita: "Bodový systém hodnotenia klienta – automatický výpočet na základe histórie zmlúv",
  behavioralne: "Sledovanie správania klienta v digitálnom prostredí pre personalizáciu služieb",
  nezatriedene: "Údaje zo zmlúv, ktoré nie sú priradené do žiadnej štandardnej kategórie. Ak sa typ údaja vyskytne u viac ako 20 klientov, je označený ako nový trend.",
  ekonomika: "Ekonomický profil klienta – zamestnanie, príjmy, finančné údaje a AML legislatívny status. Každá zmena príjmu alebo zamestnávateľa je sledovaná v histórii.",
  vozidla: "Údaje o vozidle z technického preukazu. Platnosť STK a EK je sledovaná semaforom (zelená >90d, oranžová ≤90d, červená = neplatná). Každá zmena sa zapisuje do histórie.",
  reality: "Údaje o nehnuteľnostiach klienta z poistnej zmluvy na majetok alebo znaleckého posudku. Technický stav a zabezpečenie ovplyvňujú výpočet poistného. Každá zmena sa zapisuje do histórie.",
  zdravotny: "Zdravotný profil klienta zo zdravotného dotazníka alebo poistnej zmluvy na život. Citlivé údaje (diagnózy) majú obmedzený prístup. Fajčiarsky status a rizikové športy ovplyvňujú sadzby poistného.",
  investicny: "Investičný profil klienta podľa MiFID II. Dátum dotazníka je sledovaný semaforom – po 12 mesiacoch vyžaduje zákonná revízia opätovné vyplnenie. Každá zmena profilu sa zapisuje do histórie.",
};

const FIELD_TO_CATEGORY: Record<string, string> = {
  titul_pred: "povinne", meno: "povinne", priezvisko: "povinne", titul_za: "povinne",
  rodne_cislo: "povinne", datum_narodenia: "povinne", vek: "povinne", pohlavie: "povinne",
  miesto_narodenia: "povinne", statna_prislusnost: "povinne", rodne_priezvisko: "dobrovolne",
  typ_dokladu: "dokumentacne", typ_dokladu_iny: "dokumentacne", cislo_dokladu: "dokumentacne",
  platnost_dokladu: "dokumentacne", vydal_organ: "dokumentacne", kod_vydavajuceho_organu: "dokumentacne",
  telefon: "komunikacne", email: "komunikacne",
  tp_ulica: "povinne", tp_supisne: "povinne", tp_orientacne: "povinne",
  tp_mesto: "povinne", tp_psc: "povinne", tp_stat: "povinne",
  korespond_rovnaka: "povinne", ka_ulica: "povinne", ka_supisne: "povinne",
  ka_orientacne: "povinne", ka_mesto: "povinne", ka_psc: "povinne", ka_stat: "povinne",
  kontaktna_rovnaka: "povinne", koa_ulica: "povinne", koa_supisne: "povinne",
  koa_orientacne: "povinne", koa_mesto: "povinne", koa_psc: "povinne", koa_stat: "povinne",
  nazov_organizacie: "povinne", ico: "povinne", sk_nace: "firemny_profil",
  sidlo_ulica: "povinne", sidlo_supisne: "povinne", sidlo_orientacne: "povinne",
  sidlo_mesto: "povinne", sidlo_psc: "povinne", sidlo_stat: "povinne",
  vykon_rovnaky: "povinne", vykon_ulica: "povinne", vykon_supisne: "povinne",
  vykon_orientacne: "povinne", vykon_mesto: "povinne", vykon_psc: "povinne", vykon_stat: "povinne",
  dic: "zakonne", ic_dph: "zakonne",
  pep: "aml", pep_funkcia: "aml", pep_vztah: "aml",
  kuv_meno_1: "aml", kuv_rc_1: "aml", kuv_podiel_1: "aml",
  kuv_meno_2: "aml", kuv_rc_2: "aml", kuv_podiel_2: "aml",
  kuv_meno_3: "aml", kuv_rc_3: "aml", kuv_podiel_3: "aml",
  obrat: "firemny_profil", pocet_zamestnancov: "firemny_profil",
  iban: "zmluvne", bic: "zmluvne", cislo_uctu: "zmluvne",
  rodinny_kontakt_meno: "komunikacne", rodinny_kontakt_telefon: "komunikacne",
  rodinny_kontakt_vztah: "komunikacne", zastihnutie: "komunikacne",
  doruc_ulica: "geolokacne", doruc_mesto: "geolokacne", doruc_psc: "geolokacne",
  doruc_stat: "geolokacne", doruc_rovnaka: "geolokacne",
  spz: "majetkove", vin: "majetkove",
  statutar_meno_1: "pravne", statutar_rc_1: "pravne", statutar_funkcia_1: "pravne",
  statutar_meno_2: "pravne", statutar_rc_2: "pravne", statutar_funkcia_2: "pravne",
  cgn_rating: "bonita",
  ekon_pracovny_pomer: "ekonomika", ekon_zamestnavatel: "ekonomika", ekon_pozicia: "ekonomika", ekon_datum_nastupu: "ekonomika",
  ekon_cisty_prijem: "ekonomika", ekon_zdroj_prijmu: "ekonomika", ekon_hlavny_iban: "ekonomika", ekon_banka: "ekonomika",
  ekon_peo: "ekonomika", ekon_peo_zdovodnenie: "ekonomika", ekon_kuv: "ekonomika",
  voz_ecv: "vozidla", voz_vin: "vozidla", voz_cislo_tp: "vozidla", voz_znacka: "vozidla", voz_model: "vozidla",
  voz_vykon: "vozidla", voz_objem: "vozidla", voz_hmotnost: "vozidla", voz_palivo: "vozidla",
  voz_stk_platnost: "vozidla", voz_ek_platnost: "vozidla", voz_tachometer: "vozidla", voz_zabezpecenie: "vozidla",
  real_typ_nehnutelnosti: "reality", real_supisne_cislo: "reality", real_parcelne_cislo: "reality",
  real_katastralne_uzemie: "reality", real_cislo_lv: "reality", real_rok_kolaudacie: "reality",
  real_rekon_strecha: "reality", real_rekon_rozvody: "reality", real_rekon_kurenie: "reality",
  real_rozloha: "reality", real_pocet_podlazi: "reality", real_typ_konstrukcie: "reality",
  real_typ_dveri: "reality", real_elektro_zabezpecenie: "reality", real_protipoz_ochrana: "reality",
  zdrav_vyska: "zdravotny", zdrav_vaha: "zdravotny", zdrav_fajciar: "zdravotny",
  zdrav_rizikovy_sport: "zdravotny", zdrav_diagnozy: "zdravotny",
  inv_typ_investora: "investicny", inv_datum_dotaznika: "investicny", inv_skusenosti: "investicny",
};

const CONSENT_TYPES = [
  { code: "marketing_email", label: "Email marketing" },
  { code: "marketing_sms", label: "SMS marketing" },
  { code: "marketing_phone", label: "Telefonický marketing" },
  { code: "data_processing", label: "Spracovanie osobných údajov" },
  { code: "third_party", label: "Poskytnutie údajov tretím stranám" },
  { code: "profiling", label: "Profilovanie" },
];

function UnclassifiedTrendsNotice() {
  const { data: trendsData } = useQuery<{ trends: Array<{ fieldKey: string; count: number }> }>({
    queryKey: ["/api/data-trends/unclassified"],
  });

  if (!trendsData?.trends || trendsData.trends.length === 0) return null;

  return (
    <div className="mt-2 rounded border border-amber-700/50 bg-amber-950/30 p-3" data-testid="unclassified-trends-notice">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">Nový trend - nezatriedené údaje</span>
      </div>
      <div className="space-y-1">
        {trendsData.trends.map(t => (
          <div key={t.fieldKey} className="flex items-center justify-between text-[11px]">
            <span className="text-amber-200/80 font-mono">{t.fieldKey}</span>
            <Badge variant="outline" className="text-[9px] border-amber-600 text-amber-300">
              {t.count} klientov
            </Badge>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Tieto údaje sa vyskytujú u viac ako 20 klientov a mali by byť zatriedené do príslušnej kategórie.
      </p>
    </div>
  );
}

function SubjectViewField({
  field, value, isSummary, hasNote, noteText, pdfSidebarOpen, toggleSummaryField, onInlineSave, allFieldValues, subjectId,
}: {
  field: StaticField; value: string; isSummary: boolean; hasNote: boolean; noteText?: string;
  pdfSidebarOpen: boolean; toggleSummaryField: (key: string) => void;
  onInlineSave?: (fieldKey: string, newValue: string) => void;
  allFieldValues?: Record<string, string>;
  subjectId?: number;
}) {
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditVal(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const isValField = isValidityField(field.fieldKey);
  const validity = isValField && value ? getDocumentValidityStatus(value) : null;
  const fromDateValidity = isValidityFromDateField(field.fieldKey) && value ? getValidityFromDateStatus(field.fieldKey, value) : null;
  const activeValidity = validity || fromDateValidity;
  const numValidity = allFieldValues ? isNumberFieldWithExpiredPair(field.fieldKey, allFieldValues) : null;
  const isExpiredNumber = numValidity?.status === "expired";

  const displayValue = field.fieldType === "switch"
    ? value === "true" ? "Áno" : value === "false" ? "Nie" : "-"
    : field.fieldType === "date" && value
      ? formatDateSlovak(value)
      : field.unit && value
        ? `${value} ${field.unit}`
        : value || "-";

  const commitEdit = () => {
    setEditing(false);
    if (onInlineSave && editVal !== value) onInlineSave(field.fieldKey, editVal);
  };

  const handleClick = () => {
    if (editing) return;
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => { clickTimer.current = null; setVerified(v => !v); }, 250);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (!onInlineSave || field.fieldType === "switch" || field.fieldType === "select") return;
    setEditing(true);
    setEditVal(value === "-" ? "" : value);
  };

  if (editing) {
    return (
      <div className="h-10 flex items-center gap-2 px-3 rounded-md border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-sm" data-testid={`field-${field.fieldKey}`}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{field.shortLabel || field.label}:</span>
        <input
          ref={inputRef}
          type={field.fieldType === "date" ? "date" : "text"}
          className="flex-1 bg-transparent outline-none text-sm font-medium"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditing(false); setEditVal(value); } }}
          onBlur={commitEdit}
          data-testid={`field-${field.fieldKey}-input`}
        />
      </div>
    );
  }

  const borderCls = verified
    ? "border-blue-400/60 bg-blue-500/10 dark:bg-blue-500/15"
    : isExpiredNumber
      ? "border-red-500/60 bg-red-500/10"
      : activeValidity && activeValidity.status !== "unknown"
        ? `${activeValidity.borderClass} ${activeValidity.bgClass}`
        : isSummary ? "border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/15" : "border-border bg-muted/30";

  return (
    <div
      className={`h-10 flex items-center gap-2 px-3 rounded-md border transition-colors duration-150 select-none cursor-pointer ${borderCls}`}
      title={hasNote ? `Poznámka: ${noteText}` : activeValidity ? activeValidity.label : undefined}
      data-testid={`field-${field.fieldKey}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-xs text-muted-foreground whitespace-nowrap">{field.shortLabel || field.label}:</span>
      <span className={`text-sm font-medium truncate max-w-[200px] ${activeValidity?.textClass || ""} ${isExpiredNumber ? "text-red-500" : ""}`}>{displayValue}</span>
      {subjectId && (
        <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={field.label || field.fieldKey} />
      )}
      {activeValidity && activeValidity.status !== "unknown" && value && (
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeValidity.dotClass}`} data-testid={`validity-dot-${field.fieldKey}`} />
      )}
      {verified && <Check className="w-3 h-3 text-blue-500 flex-none" />}
      {hasNote && !verified && <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />}
      <button
        onClick={e => { e.stopPropagation(); toggleSummaryField(field.fieldKey); }}
        className={`ml-auto shrink-0 transition-opacity ${isSummary ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
        data-testid={`toggle-summary-${field.fieldKey}`}
        title={isSummary ? "Odstrániť zo zhrnutia" : "Pridať do zhrnutia"}
      >
        {isSummary ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3 h-3" />}
      </button>
    </div>
  );
}

interface CategoriesAccordionProps {
  tabCode: string;
  tabCats: ClientDataCategory[];
  fieldsByCategory: Record<string, StaticField[]>;
  isEditing: boolean;
  getFieldValue: (key: string) => string;
  getEditableValue: (key: string) => string;
  editValues: Record<string, string>;
  setEditFieldValue: (key: string, value: string) => void;
  summaryFields: Record<string, boolean>;
  pdfSidebarOpen: boolean;
  toggleSummaryField: (key: string) => void;
  isSuperAdmin?: boolean;
  fieldNotes?: Record<string, string>;
  onFieldNoteChange?: (key: string, note: string) => void;
  onInlineSave?: (fieldKey: string, newValue: string) => void;
  activeFieldHints?: Record<string, string>;
  collectionCategories?: Record<string, { sectionCode: string; sectionName: string; fields: any[] }>;
  dynamicFields?: Record<string, any>;
  onCollectionAdd?: (sectionCode: string) => void;
  onCollectionRemove?: (sectionCode: string, instanceIndex: number) => void;
  collectionCounts?: Record<string, number>;
  subjectId?: number;
}

function CategoriesAccordion({
  tabCode, tabCats, fieldsByCategory, isEditing,
  getFieldValue, getEditableValue, editValues, setEditFieldValue,
  summaryFields, pdfSidebarOpen, toggleSummaryField,
  isSuperAdmin, fieldNotes, onFieldNoteChange, onInlineSave,
  activeFieldHints, collectionCategories, dynamicFields,
  onCollectionAdd, onCollectionRemove, collectionCounts, subjectId,
}: CategoriesAccordionProps) {
  const visibleCats = useMemo(() => {
    if (isEditing) return tabCats;
    return tabCats.filter(cat => {
      const catFields = fieldsByCategory[cat.code] || [];
      if (catFields.length === 0) return false;
      return catFields.some(f => !!getFieldValue(f.fieldKey));
    });
  }, [isEditing, tabCats, fieldsByCategory, getFieldValue]);

  if (visibleCats.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground" data-testid={`empty-tab-${tabCode}`}>
        {isEditing ? "Žiadne kategórie v tejto záložke" : "Žiadne vyplnené údaje v tejto záložke"}
      </div>
    );
  }

  const defaultOpen = visibleCats
    .filter(c => (fieldsByCategory[c.code]?.length || 0) > 0)
    .map(c => c.code);

  return (
    <Accordion
      key={isEditing ? "edit" : "view"}
      type="multiple"
      defaultValue={defaultOpen}
      className="space-y-2"
    >
      {visibleCats.map(cat => {
        const catFields = fieldsByCategory[cat.code] || [];
        const isCollection = !!(collectionCategories && collectionCategories[cat.code]);
        const collectionInfo = collectionCategories?.[cat.code];

        const getCollectionInstanceCount = () => {
          if (!isCollection || !dynamicFields) return 0;
          let maxIdx = -1;
          const prefix = (collectionInfo?.sectionCode || cat.code) + "_";
          for (const key of Object.keys(dynamicFields)) {
            if (key.startsWith(prefix)) {
              const parts = key.slice(prefix.length).split("_");
              const idx = parseInt(parts[0], 10);
              if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
            }
          }
          return maxIdx + 1;
        };

        const sectionCode = collectionInfo?.sectionCode || cat.code;
        const stateCount = collectionCounts?.[sectionCode] || 0;
        const instanceCount = isCollection ? Math.max(1, getCollectionInstanceCount(), stateCount) : 0;

        const filledCount = isCollection
          ? catFields.filter(f => {
              for (let i = 0; i < instanceCount; i++) {
                const key = `${collectionInfo?.sectionCode || cat.code}_${i}_${f.fieldKey}`;
                if (dynamicFields?.[key]) return true;
              }
              return !!getFieldValue(f.fieldKey);
            }).length
          : catFields.filter(f => !!getFieldValue(f.fieldKey)).length;

        return (
          <AccordionItem key={cat.code} value={cat.code} className="border rounded-md px-3" data-testid={`category-${cat.code}`}>
            <AccordionTrigger className="py-2.5 hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                <span className="text-sm font-medium">{cat.name}</span>
                {catFields.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filledCount}/{catFields.length}
                  </Badge>
                )}
                {isCollection && instanceCount > 0 && (
                  <Badge variant="outline" className="text-[9px] border-blue-400/60 text-blue-400">
                    {instanceCount}× záznam{instanceCount > 1 ? "y" : ""}
                  </Badge>
                )}
                {isEditing && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">editácia</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              {(cat.description || CATEGORY_HINTS[cat.code]) && (
                <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{CATEGORY_HINTS[cat.code] || cat.description}</p>
              )}
              {catFields.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Žiadne polia v tejto kategórii
                </p>
              ) : isCollection && isEditing ? (
                <div className="space-y-4" data-testid={`collection-edit-${cat.code}`}>
                  {Array.from({ length: instanceCount }, (_, idx) => {
                    const prefix = `${collectionInfo?.sectionCode || cat.code}_${idx}_`;
                    return (
                      <div key={idx} className="border border-dashed border-muted-foreground/30 rounded-md p-3 relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {collectionInfo?.sectionName || cat.name} #{idx + 1}
                          </span>
                          {idx > 0 && onCollectionRemove && (
                            <button
                              type="button"
                              onClick={() => onCollectionRemove(collectionInfo?.sectionCode || cat.code, idx)}
                              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                              data-testid={`collection-remove-${cat.code}-${idx}`}
                            >
                              <Trash2 className="w-3 h-3" /> Odstrániť
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {catFields.map(field => {
                            const indexedKey = `${prefix}${field.fieldKey}`;
                            const currentVal = editValues[indexedKey] ?? dynamicFields?.[indexedKey] ?? "";
                            const origVal = dynamicFields?.[indexedKey] ?? "";
                            const isModified = editValues[indexedKey] !== undefined && editValues[indexedKey] !== origVal;
                            return (
                              <div key={indexedKey} className="space-y-1" data-testid={`edit-field-${indexedKey}`}>
                                <Label className={`text-xs ${isModified ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                                  {field.shortLabel || field.label}
                                  {field.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                                </Label>
                                {field.fieldType === "switch" ? (
                                  <div className="flex items-center gap-2 h-9">
                                    <Switch
                                      checked={currentVal === "true"}
                                      onCheckedChange={checked => setEditFieldValue(indexedKey, checked ? "true" : "false")}
                                    />
                                    <span className="text-xs text-muted-foreground">{currentVal === "true" ? "Áno" : "Nie"}</span>
                                  </div>
                                ) : (field.fieldType === "select" || field.fieldType === "jedna_moznost") && field.options.length > 0 ? (
                                  <Select value={currentVal} onValueChange={v => setEditFieldValue(indexedKey, v)}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vyberte..." /></SelectTrigger>
                                    <SelectContent>
                                      {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : field.fieldType === "textarea" ? (
                                  <Textarea value={currentVal} onChange={e => setEditFieldValue(indexedKey, e.target.value)} rows={2} className="text-xs" />
                                ) : (
                                  <Input
                                    type={field.fieldType === "date" ? "date" : field.fieldType === "number" || field.fieldType === "desatinne_cislo" ? "number" : "text"}
                                    value={currentVal}
                                    onChange={e => setEditFieldValue(indexedKey, e.target.value)}
                                    className={`h-9 text-xs ${isModified ? "border-primary/60" : ""}`}
                                    placeholder={field.label}
                                    step={field.fieldType === "desatinne_cislo" ? "0.01" : undefined}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {onCollectionAdd && (
                    <button
                      type="button"
                      onClick={() => onCollectionAdd(collectionInfo?.sectionCode || cat.code)}
                      className="w-full border border-dashed border-muted-foreground/30 rounded-md py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center gap-1.5 transition-colors"
                      data-testid={`collection-add-${cat.code}`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Pridať {collectionInfo?.sectionName || cat.name}
                    </button>
                  )}
                </div>
              ) : isCollection && !isEditing ? (
                <div className="space-y-3" data-testid={`collection-view-${cat.code}`}>
                  {Array.from({ length: instanceCount }, (_, idx) => {
                    const prefix = `${collectionInfo?.sectionCode || cat.code}_${idx}_`;
                    const hasData = catFields.some(f => !!dynamicFields?.[`${prefix}${f.fieldKey}`]);
                    if (!hasData) return null;
                    return (
                      <div key={idx} className="border border-muted-foreground/20 rounded-md p-3">
                        <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                          {collectionInfo?.sectionName || cat.name} #{idx + 1}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {catFields.map(field => {
                            const indexedKey = `${prefix}${field.fieldKey}`;
                            const value = dynamicFields?.[indexedKey] || "";
                            if (!value) return null;
                            return (
                              <SubjectViewField
                                key={indexedKey}
                                field={{ ...field, fieldKey: indexedKey }}
                                value={value}
                                isSummary={false}
                                hasNote={false}
                                pdfSidebarOpen={false}
                                toggleSummaryField={() => {}}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catFields.map(field => {
                    if (field.visibilityRule) {
                      const depVal = getEditableValue(field.visibilityRule.dependsOn);
                      if (depVal !== field.visibilityRule.value) return null;
                    }
                    const currentVal = getEditableValue(field.fieldKey);
                    const isModified = editValues[field.fieldKey] !== undefined && editValues[field.fieldKey] !== getFieldValue(field.fieldKey);
                    const hintsMap = activeFieldHints || FIELD_HINTS;
                    const fieldHint = HINTED_CATEGORIES.has(cat.code) ? hintsMap[field.fieldKey] : (hintsMap[field.fieldKey] || undefined);
                    const existingNote = fieldNotes?.[field.fieldKey] || "";
                    return (
                      <div key={field.fieldKey} className="space-y-1" data-testid={`edit-field-${field.fieldKey}`}>
                        <div className="flex items-center gap-1">
                          <Label className={`text-xs ${isModified ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {field.shortLabel || field.label}
                            {field.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                            {isModified && <span className="ml-1 text-[9px]">(zmenené)</span>}
                          </Label>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              className={`ml-auto p-0.5 rounded hover:bg-muted ${existingNote ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                              title={existingNote || "Pridať internú poznámku"}
                              onClick={() => {
                                const note = prompt("Interná poznámka (viditeľná len SuperAdmin):", existingNote);
                                if (note !== null && onFieldNoteChange) onFieldNoteChange(field.fieldKey, note);
                              }}
                              data-testid={`note-btn-${field.fieldKey}`}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {isSuperAdmin && existingNote && (
                          <p className="text-[10px] text-amber-400/80 leading-tight -mt-0.5 italic" data-testid={`note-text-${field.fieldKey}`}>
                            {existingNote}
                          </p>
                        )}
                        {fieldHint && <p className="text-[10px] text-muted-foreground/70 leading-tight -mt-0.5">{fieldHint}</p>}
                        {field.fieldType === "switch" ? (
                          <div className="flex items-center gap-2 h-9">
                            <Switch
                              checked={currentVal === "true"}
                              onCheckedChange={checked => setEditFieldValue(field.fieldKey, checked ? "true" : "false")}
                              data-testid={`switch-edit-${field.fieldKey}`}
                            />
                            <span className="text-xs text-muted-foreground">{currentVal === "true" ? "Áno" : "Nie"}</span>
                          </div>
                        ) : (field.fieldType === "select" || field.fieldType === "jedna_moznost") && field.options.length > 0 ? (
                          <Select value={currentVal} onValueChange={v => setEditFieldValue(field.fieldKey, v)}>
                            <SelectTrigger className="h-9 text-xs" data-testid={`select-edit-${field.fieldKey}`}>
                              <SelectValue placeholder="Vyberte..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.fieldType === "textarea" ? (
                          <Textarea
                            value={currentVal}
                            onChange={e => setEditFieldValue(field.fieldKey, e.target.value)}
                            rows={2}
                            className="text-xs"
                            data-testid={`textarea-edit-${field.fieldKey}`}
                          />
                        ) : field.fieldKey === "ekon_hlavny_iban" ? (
                          <div className="space-y-1">
                            <Input
                              type="text"
                              value={currentVal}
                              onChange={e => {
                                const raw = e.target.value;
                                setEditFieldValue(field.fieldKey, raw);
                                const bank = getBankFromIban(raw);
                                if (bank) {
                                  setEditFieldValue("ekon_banka", bank);
                                } else if (raw && validateIban(raw)) {
                                  setEditFieldValue("ekon_banka", "");
                                } else if (!raw) {
                                  setEditFieldValue("ekon_banka", "");
                                }
                              }}
                              className={`h-9 text-xs ${isModified ? "border-primary/60" : ""} ${currentVal && !validateIban(currentVal) ? "border-red-500/80" : currentVal && validateIban(currentVal) ? "border-emerald-500/80" : ""}`}
                              placeholder="SK31 1200 0000 1987 4263 7541"
                              data-testid={`input-edit-${field.fieldKey}`}
                            />
                            {currentVal && !validateIban(currentVal) && (
                              <p className="text-[10px] text-red-400" data-testid="iban-validation-error">Neplatný formát IBAN</p>
                            )}
                            {currentVal && validateIban(currentVal) && (
                              <p className="text-[10px] text-emerald-400" data-testid="iban-validation-ok">IBAN je platný {getBankFromIban(currentVal) ? `– ${getBankFromIban(currentVal)}` : ""}</p>
                            )}
                          </div>
                        ) : (
                          <Input
                            type={field.fieldType === "date" ? "date" : field.fieldType === "number" || field.fieldType === "desatinne_cislo" ? "number" : "text"}
                            value={currentVal}
                            onChange={e => setEditFieldValue(field.fieldKey, e.target.value)}
                            className={`h-9 text-xs ${isModified ? "border-primary/60" : ""}`}
                            placeholder={field.label}
                            step={field.fieldType === "desatinne_cislo" ? "0.01" : undefined}
                            data-testid={`input-edit-${field.fieldKey}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catFields.map(field => {
                    if (field.visibilityRule) {
                      const depVal = getFieldValue(field.visibilityRule.dependsOn);
                      if (depVal !== field.visibilityRule.value) return null;
                    }
                    const value = getFieldValue(field.fieldKey);
                    if (!value) return null;
                    const allVals: Record<string, string> = {};
                    Object.values(fieldsByCategory).flat().forEach(f => { const v = getFieldValue(f.fieldKey); if (v) allVals[f.fieldKey] = v; });
                    return (
                      <SubjectViewField
                        key={field.fieldKey}
                        field={field}
                        value={value}
                        isSummary={!!summaryFields[field.fieldKey]}
                        hasNote={!!(isSuperAdmin && fieldNotes?.[field.fieldKey])}
                        noteText={fieldNotes?.[field.fieldKey]}
                        pdfSidebarOpen={pdfSidebarOpen}
                        toggleSummaryField={toggleSummaryField}
                        onInlineSave={onInlineSave}
                        allFieldValues={allVals}
                        subjectId={subjectId}
                      />
                    );
                  })}
                </div>
              )}
              {cat.code === "nezatriedene" && <UnclassifiedTrendsNotice />}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

interface SubjektViewProps {
  subject: Subject;
  showPdfSidebar?: boolean;
  isClientView?: boolean;
}

export function SubjektView({ subject, showPdfSidebar = false, isClientView = false }: SubjektViewProps) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const [pdfSidebarOpen, setPdfSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState("");
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>(() => {
    const prefs = (subject as any).uiPreferences;
    return prefs?.field_notes || {};
  });
  const [summaryFields, setSummaryFields] = useState<Record<string, boolean>>(() => {
    const prefs = (subject as any).uiPreferences;
    return prefs?.summary_fields || {};
  });

  const isSuperAdmin = useMemo(() => {
    const name = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
    return name.includes("superadmin") || name.includes("prezident");
  }, [appUser]);

  const { data: tabs, isLoading: tabsLoading } = useQuery<ClientDataTab[]>({
    queryKey: ["/api/client-data-tabs"],
  });

  const { data: categories, isLoading: catsLoading } = useQuery<ClientDataCategory[]>({
    queryKey: ["/api/client-data-categories"],
  });

  const { data: consents } = useQuery<ClientMarketingConsent[]>({
    queryKey: ["/api/subjects", subject.id, "marketing-consents"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/marketing-consents`).then(r => r.json()),
  });

  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const { data: riskData } = useQuery<{
    riskLinks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }>;
    foPoRisks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>;
  }>({
    queryKey: ["/api/subjects", subject.id, "risk-links"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/risk-links`).then(r => r.json()),
  });

  const linkedFoId = (subject as any).linkedFoId as number | null;
  const { data: linkedFo } = useQuery<Subject>({
    queryKey: ["/api/subjects", linkedFoId],
    queryFn: () => apiRequest("GET", `/api/subjects/${linkedFoId}`).then(r => r.json()),
    enabled: !!linkedFoId && subject.type === "company",
  });

  const { data: linkedPos } = useQuery<Subject[]>({
    queryKey: ["/api/subjects", subject.id, "linked-companies"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/linked-companies`).then(r => r.json()),
    enabled: subject.type === "person" || subject.type === "szco",
  });

  const { data: collaborators } = useQuery<SubjectCollaborator[]>({
    queryKey: ["/api/subjects", subject.id, "collaborators"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/collaborators`).then(r => r.json()),
  });

  const { data: fieldHistory } = useQuery<SubjectFieldHistory[]>({
    queryKey: ["/api/subjects", subject.id, "field-history"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/field-history`).then(r => r.json()),
  });

  const upsertConsent = useMutation({
    mutationFn: async (data: { consentType: string; isGranted: boolean; companyId: number }) => {
      return apiRequest("POST", `/api/subjects/${subject.id}/marketing-consents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "marketing-consents"] });
      toast({ title: "Súhlas aktualizovaný" });
    },
  });

  const updateUiPrefs = useMutation({
    mutationFn: async (prefs: Record<string, any>) => {
      return apiRequest("PATCH", `/api/subjects/${subject.id}/ui-preferences`, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      const dynUpdates: Record<string, any> = {};

      for (const [fieldKey, val] of Object.entries(editValues)) {
        const colName = FIELD_TO_SUBJECT_COLUMN[fieldKey];
        if (colName) {
          if (INT_COLUMNS.has(colName)) {
            payload[colName] = val ? parseInt(val) : null;
          } else {
            payload[colName] = val;
          }
        } else {
          dynUpdates[fieldKey] = val;
        }
      }

      if (Object.keys(dynUpdates).length > 0) {
        const existingDetails = (subject.details || {}) as Record<string, any>;
        const existingDynamic = existingDetails.dynamicFields || {};
        payload.details = {
          ...existingDetails,
          dynamicFields: { ...existingDynamic, ...dynUpdates },
        };
      }
      payload.changeReason = editReason || "Manuálna editácia cez profil subjektu";

      return apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Zmeny uložené" });
      setIsEditing(false);
      setEditValues({});
      setEditReason("");
    },
    onError: (err: any) => {
      toast({ title: "Chyba pri ukladaní", description: err.message, variant: "destructive" });
    },
  });

  const handleInlineSave = useCallback(async (fieldKey: string, newValue: string) => {
    try {
      const colName = FIELD_TO_SUBJECT_COLUMN[fieldKey];
      const payload: Record<string, any> = { changeReason: "Rýchla úprava z profilu" };
      if (colName) {
        if (INT_COLUMNS.has(colName)) {
          payload[colName] = parseInt(newValue) || null;
        } else {
          payload[colName] = newValue;
        }
      } else {
        const existingDetails = (subject.details || {}) as Record<string, any>;
        const existingDynamic = existingDetails.dynamicFields || {};
        payload.details = {
          ...existingDetails,
          dynamicFields: { ...existingDynamic, [fieldKey]: newValue },
        };
      }
      await apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Uložené" });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    }
  }, [subject, toast]);

  const startEditing = useCallback(() => {
    setEditValues({});
    setEditReason("");
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValues({});
    setEditReason("");
  }, []);

  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});

  const handleCollectionAdd = useCallback((sectionCode: string) => {
    setCollectionCounts(prev => ({
      ...prev,
      [sectionCode]: (prev[sectionCode] || 1) + 1,
    }));
  }, []);

  const handleCollectionRemove = useCallback((sectionCode: string, instanceIndex: number) => {
    setCollectionCounts(prev => {
      const current = prev[sectionCode] || 1;
      if (current <= 1) return prev;
      return { ...prev, [sectionCode]: current - 1 };
    });
    setEditValues(prev => {
      const next = { ...prev };
      const prefix = `${sectionCode}_${instanceIndex}_`;
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (subject?.id) {
      apiRequest("POST", `/api/subjects/${subject.id}/log-view`).catch(() => {});
    }
  }, [subject?.id]);

  const isPep = useMemo(() => {
    const det = (subject as any).details || {};
    const dynFields = det.dynamicFields || {};
    const pepVal = (dynFields.pep || "").toLowerCase();
    return pepVal === "true" || pepVal === "áno" || pepVal === "ano";
  }, [subject]);

  const isPerson = subject.type === "person";
  const isSzco = subject.type === "szco";
  const clientTypeId = isSzco ? 3 : isPerson ? 1 : 4;

  const { fields: dynamicSchemaFields, fieldHints: dynamicFieldHints, fieldToCategory: dynamicFieldToCategory, collectionCategories, isLoading: schemaLoading } = useSubjectSchema(clientTypeId);

  const typeFields: StaticField[] = useMemo(() => {
    if (dynamicSchemaFields && dynamicSchemaFields.length > 0) {
      return dynamicSchemaFields;
    }
    return getFieldsForClientTypeId(clientTypeId) || [];
  }, [dynamicSchemaFields, clientTypeId]);

  const activeFieldHints = useMemo(() => {
    if (dynamicSchemaFields && dynamicSchemaFields.length > 0) {
      return { ...FIELD_HINTS, ...dynamicFieldHints };
    }
    return FIELD_HINTS;
  }, [dynamicSchemaFields, dynamicFieldHints]);

  const activeFieldToCategory = useMemo(() => {
    if (dynamicSchemaFields && dynamicSchemaFields.length > 0) {
      return { ...FIELD_TO_CATEGORY, ...dynamicFieldToCategory };
    }
    return FIELD_TO_CATEGORY;
  }, [dynamicSchemaFields, dynamicFieldToCategory]);

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  const FIELD_TO_SUBJECT_COLUMN: Record<string, string> = {
    meno: "firstName",
    priezvisko: "lastName",
    nazov_organizacie: "companyName",
    email: "email",
    telefon: "phone",
    rodne_cislo: "birthNumber",
    cislo_dokladu: "idCardNumber",
    iban: "iban",
    bic: "swift",
    firstName: "firstName",
    lastName: "lastName",
    companyName: "companyName",
    phone: "phone",
    birthNumber: "birthNumber",
    idCardNumber: "idCardNumber",
    swift: "swift",
    continentId: "continentId",
    stateId: "stateId",
    myCompanyId: "myCompanyId",
  };

  const INT_COLUMNS = new Set(["continentId", "stateId", "myCompanyId"]);

  function getFieldValue(fieldKey: string): string {
    const col = FIELD_TO_SUBJECT_COLUMN[fieldKey];
    if (col) {
      const v = (subject as any)[col];
      return v != null ? String(v) : "";
    }
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if (details[fieldKey] !== undefined) return String(details[fieldKey] || "");
    return "";
  }

  function getEditableValue(fieldKey: string): string {
    if (editValues[fieldKey] !== undefined) return editValues[fieldKey];
    return getFieldValue(fieldKey);
  }

  function setEditFieldValue(fieldKey: string, value: string) {
    setEditValues(prev => ({ ...prev, [fieldKey]: value }));
  }

  const fieldsByCategory = useMemo(() => {
    const map: Record<string, StaticField[]> = {};
    for (const field of typeFields) {
      const catCode = field.categoryCode || activeFieldToCategory[field.fieldKey] || "doplnkove";
      if (!map[catCode]) map[catCode] = [];
      map[catCode].push(field);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return map;
  }, [typeFields, activeFieldToCategory]);

  const categoriesByTab = useMemo(() => {
    if (!categories || !tabs) return {};
    const map: Record<number, ClientDataCategory[]> = {};
    for (const tab of tabs) {
      map[tab.id] = categories
        .filter(c => c.tabId === tab.id && c.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return map;
  }, [categories, tabs]);

  function toggleSummaryField(fieldKey: string) {
    const next = { ...summaryFields, [fieldKey]: !summaryFields[fieldKey] };
    setSummaryFields(next);
    updateUiPrefs.mutate({ summary_fields: next });
  }

  function handleFieldNoteChange(fieldKey: string, note: string) {
    const next = { ...fieldNotes, [fieldKey]: note };
    if (!note) delete next[fieldKey];
    setFieldNotes(next);
    updateUiPrefs.mutate({ field_notes: next });
  }

  if (tabsLoading || catsLoading || schemaLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const HIDDEN_CLIENT_TABS = new Set(['bonita_scoring']);
  const HIDDEN_CLIENT_CATEGORIES = new Set(['bonita', 'behavioralne', 'nezatriedene']);
  const sortedTabs = [...(tabs || [])].filter(t => t.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const displayTabs = isClientView ? sortedTabs.filter(t => !HIDDEN_CLIENT_TABS.has(t.code)) : sortedTabs;
  const activeCompanyId = appUser?.activeCompanyId;

  const listStatus = (subject as any).listStatus as string | null;

  return (
    <div className="flex gap-4">
      <div className={pdfSidebarOpen ? "flex-1 min-w-0" : "w-full"}>
        {!isClientView && listStatus === "cierny" && (
          <div className="mb-3 flex items-center gap-3 rounded border border-red-900 bg-red-950/80 px-4 py-3 text-red-200" data-testid="banner-cierny-zoznam">
            <Ban className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="font-bold text-red-300 uppercase tracking-wide">ČIERNY ZOZNAM</span>
              <span className="ml-2 text-sm">Subjekt je na čiernom zozname. Zmluvná činnosť je zakázaná.</span>
            </div>
          </div>
        )}
        {!isClientView && listStatus === "cerveny" && (
          <div className="mb-3 flex items-center gap-3 rounded border border-orange-700 bg-orange-950/80 px-4 py-3 text-orange-200" data-testid="banner-cerveny-zoznam">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <span className="font-bold text-orange-300 uppercase tracking-wide">ČERVENÝ ZOZNAM</span>
              <span className="ml-2 text-sm">Subjekt dosiahol -5 bodov za posledných 10 rokov. Zvýšená opatrnosť.</span>
            </div>
          </div>
        )}
        {!isClientView && riskData?.foPoRisks && riskData.foPoRisks.length > 0 && (
          <div className="mb-3 space-y-1" data-testid="banner-fo-po-risks">
            {riskData.foPoRisks.map((risk, i) => (
              <div key={`fopo-${i}`} className="flex items-center gap-3 rounded border border-yellow-700 bg-yellow-950/80 px-4 py-2.5 text-yellow-200">
                <Link2 className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-yellow-300">
                    {risk.relationship === "konateľ" ? "Konateľ" : risk.relationship === "firma" ? "Firma" : "Prepojený subjekt"}
                  </span>
                  {" "}
                  <span className="font-bold">{risk.name}</span>
                  {" je na "}
                  <span className={risk.listStatus === "cierny" ? "text-red-300 font-bold" : "text-orange-300 font-bold"}>
                    {risk.listStatus === "cierny" ? "Čiernom zozname" : "Červenom zozname"}
                  </span>
                  {"!"}
                </div>
              </div>
            ))}
          </div>
        )}
        {isPep && !isClientView && (
          <div className="mb-3 flex items-center gap-3 rounded border border-purple-700 bg-purple-950/60 px-4 py-3" data-testid="banner-pep">
            <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <span className="font-bold text-purple-300 uppercase tracking-wide">POLITICKY EXPONOVAN\u00c1 OSOBA</span>
              <span className="ml-2 text-sm text-purple-200/80">Tento subjekt je ozna\u010den\u00fd ako PEP - zv\u00fd\u0161en\u00e1 obozretnos\u0165</span>
            </div>
          </div>
        )}
        {!isClientView && riskData?.riskLinks && riskData.riskLinks.length > 0 && (
          <div className="mb-3 space-y-1" data-testid="banner-risk-links">
            {riskData.riskLinks.map((link, i) => (
              <div key={`risk-${i}`} className="flex items-center gap-3 rounded border border-amber-700 bg-amber-950/80 px-4 py-2.5 text-amber-200">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold">Kontakt je prepojený s rizikovou osobou:</span>
                  {" "}
                  <span className="font-bold text-amber-300">{link.name}</span>
                  {" "}
                  <span className="text-xs text-amber-400">
                    ({link.matchType}: {link.matchValue})
                  </span>
                  {" — "}
                  <span className={link.listStatus === "cierny" ? "text-red-300 font-semibold" : "text-orange-300 font-semibold"}>
                    {link.listStatus === "cierny" ? "Čierny zoznam" : "Červený zoznam"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <SubjectProfilePhoto
              subjectId={subject.id}
              size="lg"
              editable={!isClientView && isEditing}
              showHistory={!isClientView}
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {isPerson ? "FO" : isSzco ? "SZČO" : "PO"}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{subject.uid}</span>
                {(subject as any).supplementaryIndex && (
                  <Badge variant="outline" className="text-[10px] border-blue-600 text-blue-300" data-testid="badge-supplementary-index">
                    Index: {(subject as any).supplementaryIndex}
                  </Badge>
                )}
                {isSuperAdmin && !isClientView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() => {
                      const current = (subject as any).supplementaryIndex || "";
                      const val = prompt("Dodatkový index (napr. 1057/B alebo 1057.1):", current);
                      if (val !== null) {
                        apiRequest("PATCH", `/api/subjects/${subject.id}/supplementary-index`, { supplementaryIndex: val || null })
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
                            toast({ title: "Dodatkový index uložený" });
                          })
                          .catch(() => toast({ title: "Chyba", variant: "destructive" }));
                      }
                    }}
                    data-testid="btn-set-supplementary-index"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                )}
                {listStatus && (
                  <Badge variant={listStatus === "cierny" ? "destructive" : "secondary"} className={listStatus === "cierny" ? "bg-red-900 text-red-200" : "bg-orange-900 text-orange-200"}>
                    {listStatus === "cierny" ? "Čierny zoznam" : "Červený zoznam"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isClientView && (isEditing ? (
              <>
                <div className="flex items-center gap-2 mr-2">
                  <Input
                    placeholder="Dôvod zmeny..."
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="h-8 text-xs w-48"
                    data-testid="input-edit-reason"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={saveEdit.isPending}
                  data-testid="button-cancel-edit"
                >
                  <X className="w-4 h-4 mr-1" />
                  Zrušiť
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveEdit.mutate()}
                  disabled={saveEdit.isPending || Object.keys(editValues).length === 0}
                  data-testid="button-save-edit"
                >
                  {saveEdit.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Uložiť ({Object.keys(editValues).length})
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                data-testid="button-start-edit"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editácia
              </Button>
            ))}
            {showPdfSidebar && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPdfSidebarOpen(!pdfSidebarOpen)}
                data-testid="button-toggle-pdf-sidebar"
              >
                {pdfSidebarOpen ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                PDF export
              </Button>
            )}
            {!isClientView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/subjects/${subject.id}/gdpr-export`, '_blank');
                }}
                data-testid="btn-gdpr-export"
                className="text-xs"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                GDPR Export
              </Button>
            )}
            {isClientView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/subjects/${subject.id}/gdpr-export`, '_blank');
                }}
                data-testid="btn-client-gdpr-export"
                className="text-xs"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                Stiahnuť moje údaje
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-muted-foreground" data-testid="debug-category-count">
            Počet nájdených kategórií pre tento subjekt: {categories?.length ?? 0} | Záložky: {sortedTabs.length} | Polia: {typeFields.length}
          </div>
        </div>

        <Tabs defaultValue={displayTabs[0]?.code || "identita"} data-testid="tabs-subjekt-view">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 border border-border" data-testid="tablist-subjekt-view">
            {displayTabs.map(tab => {
              const Icon = getTabIcon(tab.icon || "FileText");
              const tabCats = categoriesByTab[tab.id] || [];
              const totalFields = tabCats.reduce((sum, cat) => sum + (fieldsByCategory[cat.code]?.length || 0), 0);
              const catCount = tabCats.length;
              return (
                <TabsTrigger
                  key={tab.code}
                  value={tab.code}
                  className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all"
                  data-testid={`tab-${tab.code}`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {tab.name}
                  <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                    {catCount}
                  </Badge>
                  {totalFields > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[9px] px-1 py-0 h-4">{totalFields}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
            {!isClientView && (
              <TabsTrigger
                value="__relacie__"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all"
                data-testid="tab-relacie"
              >
                <Network className="w-3.5 h-3.5 mr-1.5" />
                Relácie
              </TabsTrigger>
            )}
          </TabsList>

          {!isClientView && (
            <TabsContent value="__relacie__" className="mt-3" data-testid="tabcontent-relacie">
              <SubjectRelationsSection subjectId={subject.id} />
            </TabsContent>
          )}

          {displayTabs.map(tab => {
            const rawTabCats = categoriesByTab[tab.id] || [];
            const tabCats = isClientView ? rawTabCats.filter(c => !HIDDEN_CLIENT_CATEGORIES.has(c.code)) : rawTabCats;
            return (
              <TabsContent key={tab.code} value={tab.code} className="mt-3" data-testid={`tabcontent-${tab.code}`}>
                {!isClientView && tab.code === "rodina" && (subject.type === "company" || subject.type === "person" || subject.type === "szco") && (
                  <>
                    <RelationshipSection
                      subject={subject}
                      linkedFo={linkedFo || null}
                      linkedPos={linkedPos || []}
                      foPoRisks={riskData?.foPoRisks || []}
                    />
                    <CollaboratorsSection subjectId={subject.id} collaborators={collaborators || []} />
                  </>
                )}

                {tab.code === "identita" && (
                  <AddressCollectionBlock subjectId={subject.id} isClientView={isClientView} />
                )}

                {tab.code === "servis" && (
                  <FieldHistorySection subjectId={subject.id} history={fieldHistory || []} />
                )}

                {tab.code === "profil" && (
                  <MarketingConsentsSection
                    subjectId={subject.id}
                    consents={consents || []}
                    companies={companies || []}
                    activeCompanyId={activeCompanyId ?? undefined}
                    onToggle={(consentType, isGranted, companyId) => {
                      upsertConsent.mutate({ consentType, isGranted, companyId });
                    }}
                    isPending={upsertConsent.isPending}
                  />
                )}

                <CategoriesAccordion
                  tabCode={tab.code}
                  tabCats={tabCats}
                  fieldsByCategory={fieldsByCategory}
                  isEditing={isEditing}
                  getFieldValue={getFieldValue}
                  getEditableValue={getEditableValue}
                  editValues={editValues}
                  setEditFieldValue={setEditFieldValue}
                  summaryFields={summaryFields}
                  pdfSidebarOpen={pdfSidebarOpen}
                  toggleSummaryField={toggleSummaryField}
                  isSuperAdmin={isSuperAdmin}
                  fieldNotes={fieldNotes}
                  onFieldNoteChange={handleFieldNoteChange}
                  onInlineSave={handleInlineSave}
                  activeFieldHints={activeFieldHints}
                  collectionCategories={collectionCategories}
                  dynamicFields={dynamicFields}
                  onCollectionAdd={handleCollectionAdd}
                  onCollectionRemove={handleCollectionRemove}
                  collectionCounts={collectionCounts}
                  subjectId={subject.id}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {pdfSidebarOpen && (
        <div className="w-64 border-l border-border pl-4 space-y-3" data-testid="pdf-summary-sidebar">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold">Aktívne polia</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Polia označené zelenou ikonou sa zobrazia v Zhrnutí kontraktu
          </p>
          <Separator />
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {typeFields
              .filter(f => summaryFields[f.fieldKey])
              .map(f => (
                <div key={f.id} className="flex items-center justify-between py-1 px-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs truncate">{f.shortLabel || f.label}</span>
                  <button onClick={() => toggleSummaryField(f.fieldKey)} className="text-destructive hover:opacity-80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            {Object.values(summaryFields).filter(Boolean).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Žiadne polia označené pre zhrnutie
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Celkom: {Object.values(summaryFields).filter(Boolean).length} polí v zhrnutí
          </div>
        </div>
      )}
    </div>
  );
}

function RelationshipSection({
  subject,
  linkedFo,
  linkedPos,
  foPoRisks,
}: {
  subject: Subject;
  linkedFo: Subject | null;
  linkedPos: Subject[];
  foPoRisks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>;
}) {
  const isCompany = subject.type === "company";
  const isPerson = subject.type === "person" || subject.type === "szco";

  const hasRelationships = (isCompany && linkedFo) || (isPerson && linkedPos.length > 0);

  function getListBadge(listStatus: string | null) {
    if (!listStatus) return null;
    if (listStatus === "cierny") {
      return <Badge variant="destructive" className="bg-red-900 text-red-200 text-[10px]">Čierny zoznam</Badge>;
    }
    if (listStatus === "cerveny") {
      return <Badge variant="secondary" className="bg-orange-900 text-orange-200 text-[10px]">Červený zoznam</Badge>;
    }
    return null;
  }

  function SubjectCard({ s, role }: { s: Subject; role: string }) {
    const name = s.companyName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Bez mena";
    const isOnList = !!(s as any).listStatus;
    const listStatus = (s as any).listStatus as string | null;
    return (
      <div
        className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
          isOnList
            ? listStatus === "cierny"
              ? "border-red-700 bg-red-950/60"
              : "border-orange-700 bg-orange-950/60"
            : "border-border bg-muted/30"
        }`}
        data-testid={`relationship-card-${s.id}`}
      >
        <div className={`flex items-center justify-center w-10 h-10 rounded-md ${
          s.type === "company" ? "bg-blue-900/50" : "bg-emerald-900/50"
        }`}>
          {s.type === "company" ? (
            <Building2 className="w-5 h-5 text-blue-400" />
          ) : (
            <User className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{name}</span>
            {getListBadge(listStatus)}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {s.type === "company" ? "PO" : s.type === "szco" ? "SZČO" : "FO"}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{s.uid}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">{role}</span>
        </div>
        {isOnList && (
          <AlertTriangle className={`w-5 h-5 shrink-0 ${listStatus === "cierny" ? "text-red-400" : "text-orange-400"}`} />
        )}
      </div>
    );
  }

  return (
    <Card className="mb-4" data-testid="relationship-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Vzťahy – Konateľ ↔ Firma</span>
        </div>

        {!hasRelationships ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Žiadne prepojenia Konateľ ↔ Firma
          </div>
        ) : (
          <div className="space-y-3">
            {isCompany && linkedFo && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Konateľ tejto firmy</span>
                </div>
                <SubjectCard s={linkedFo} role="Konateľ" />
                {foPoRisks.some(r => r.relationship === "konateľ" && r.subjectId === linkedFo.id) && (
                  <div className="flex items-center gap-2 rounded border border-yellow-700 bg-yellow-950/80 px-3 py-2 text-yellow-200 text-xs">
                    <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span>
                      Konateľ je na {(linkedFo as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na túto firmu!
                    </span>
                  </div>
                )}
              </div>
            )}

            {isPerson && linkedPos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Firmy kde je konateľom</span>
                </div>
                {linkedPos.map(po => (
                  <div key={po.id} className="space-y-1">
                    <SubjectCard s={po} role="Firma" />
                    {foPoRisks.some(r => r.relationship === "firma" && r.subjectId === po.id) && (
                      <div className="flex items-center gap-2 rounded border border-yellow-700 bg-yellow-950/80 px-3 py-2 text-yellow-200 text-xs">
                        <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span>
                          Firma je na {(po as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na konateľa!
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(subject as any).listStatus && (
              <div className="flex items-center gap-2 rounded border border-red-700 bg-red-950/80 px-3 py-2 text-red-200 text-xs mt-2">
                <Ban className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  Tento subjekt je na {(subject as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na prepojené subjekty!
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ROLE_LABELS: Record<string, string> = {
  tiper: "Tipér",
  specialist: "Špecialista",
  spravca: "Správca",
};

const ROLE_COLORS: Record<string, string> = {
  tiper: "bg-purple-900/50 text-purple-300",
  specialist: "bg-cyan-900/50 text-cyan-300",
  spravca: "bg-green-900/50 text-green-300",
};

function CollaboratorsSection({ subjectId, collaborators }: { subjectId: number; collaborators: SubjectCollaborator[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState("tiper");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");

  const addCollab = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/subjects/${subjectId}/collaborators`, {
        role: newRole,
        collaboratorName: newName,
        note: newNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "collaborators"] });
      toast({ title: "Spolupracovník pridaný" });
      setAddOpen(false);
      setNewName("");
      setNewNote("");
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/subjects/collaborators/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "collaborators"] });
      toast({ title: "Spolupracovník deaktivovaný" });
    },
  });

  const active = collaborators.filter(c => c.isActive);
  const history = collaborators.filter(c => !c.isActive);

  return (
    <Card className="mb-4" data-testid="collaborators-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Spolupracovníci</span>
            <Badge variant="outline" className="text-[10px]">{active.length} aktívnych</Badge>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-add-collaborator">
                <Plus className="w-3.5 h-3.5 mr-1" /> Pridať
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Pridať spolupracovníka</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs">Rola</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-collaborator-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiper">Tipér</SelectItem>
                      <SelectItem value="specialist">Špecialista</SelectItem>
                      <SelectItem value="spravca">Správca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Meno</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Meno spolupracovníka" data-testid="input-collaborator-name" />
                </div>
                <div>
                  <Label className="text-xs">Poznámka</Label>
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} data-testid="input-collaborator-note" />
                </div>
                <Button onClick={() => addCollab.mutate()} disabled={!newName.trim() || addCollab.isPending} className="w-full" data-testid="button-save-collaborator">
                  {addCollab.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Uložiť
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {active.length === 0 && history.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadni spolupracovníci</p>
        )}

        {active.map(c => (
          <div key={c.id} className="flex items-center justify-between border rounded-md px-3 py-2" data-testid={`collaborator-${c.id}`}>
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] ${ROLE_COLORS[c.role] || "bg-muted"}`}>
                {ROLE_LABELS[c.role] || c.role}
              </Badge>
              <span className="text-sm">{c.collaboratorName || "Neznámy"}</span>
              {c.note && <span className="text-xs text-muted-foreground">({c.note})</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{c.validFrom ? formatDateSlovak(String(c.validFrom)) : ""}</span>
              <Button variant="ghost" size="sm" onClick={() => deactivate.mutate(c.id)} data-testid={`button-deactivate-${c.id}`}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        {history.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>História ({history.length})</span>
            </div>
            {history.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground opacity-60" data-testid={`collaborator-history-${c.id}`}>
                <Badge variant="outline" className="text-[9px]">{ROLE_LABELS[c.role] || c.role}</Badge>
                <span>{c.collaboratorName || "Neznámy"}</span>
                <span>{c.validFrom ? formatDateSlovak(String(c.validFrom)) : ""} – {c.validTo ? formatDateSlovak(String(c.validTo)) : "dnes"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  trvaly: "Trvalý pobyt",
  prechodny: "Prechodný pobyt",
  korespondencna: "Korešpondenčná adresa",
};

const ADDRESS_FIELD_LABELS: Record<string, string> = {
  ulica: "Ulica",
  supisneCislo: "Súpisné číslo",
  orientacneCislo: "Orientačné číslo",
  obecMesto: "Obec/Mesto",
  psc: "PSČ",
  stat: "Štát",
};

function AddressCollectionBlock({ subjectId, isClientView }: { subjectId: number; isClientView?: boolean }) {
  const { toast } = useToast();
  const [addingType, setAddingType] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);

  const { data: addresses, isLoading } = useQuery<SubjectAddress[]>({
    queryKey: ["/api/subjects", subjectId, "addresses"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subjectId}/addresses`).then(r => r.json()),
  });

  const { data: fieldHistory } = useQuery<SubjectFieldHistory[]>({
    queryKey: ["/api/subjects", subjectId, "field-history"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subjectId}/field-history`).then(r => r.json()),
  });

  const createAddress = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", `/api/subjects/${subjectId}/addresses`, data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Adresa vytvorená" });
      setAddingType(null);
      setFormData({});
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const updateAddress = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/subjects/${subjectId}/addresses/${id}`, data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Adresa aktualizovaná" });
      setEditingId(null);
      setFormData({});
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subjects/${subjectId}/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      toast({ title: "Adresa odstránená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const setHlavna = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/subjects/${subjectId}/addresses/${id}/set-hlavna`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Hlavná adresa nastavená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const startAdd = (type: string) => {
    setAddingType(type);
    setEditingId(null);
    setFormData({ stat: "Slovensko" });
  };

  const startEdit = (addr: SubjectAddress) => {
    setEditingId(addr.id);
    setAddingType(null);
    setFormData({
      ulica: addr.ulica || "",
      supisneCislo: addr.supisneCislo || "",
      orientacneCislo: addr.orientacneCislo || "",
      obecMesto: addr.obecMesto || "",
      psc: addr.psc || "",
      stat: addr.stat || "Slovensko",
    });
  };

  const cancelForm = () => {
    setAddingType(null);
    setEditingId(null);
    setFormData({});
  };

  const submitAdd = () => {
    if (!addingType) return;
    createAddress.mutate({ addressType: addingType, ...formData });
  };

  const submitEdit = () => {
    if (!editingId) return;
    updateAddress.mutate({ id: editingId, data: formData });
  };

  const getHistoryForAddress = (addressType: string) => {
    if (!fieldHistory) return [];
    const prefix = `addr_${addressType}_`;
    return fieldHistory.filter(h => h.fieldKey.startsWith(prefix) || (h.fieldKey === "addr_hlavna"));
  };

  const existingTypes = useMemo(() => new Set((addresses || []).map(a => a.addressType)), [addresses]);

  const addrFields = ["ulica", "supisneCislo", "orientacneCislo", "obecMesto", "psc", "stat"] as const;

  const renderForm = () => (
    <div className="grid grid-cols-3 gap-2 mt-2" data-testid="address-form">
      <div className="col-span-2">
        <Label className="text-[10px] text-muted-foreground">Ulica</Label>
        <Input className="h-8 text-xs" value={formData.ulica || ""} onChange={e => setFormData(p => ({ ...p, ulica: e.target.value }))} data-testid="input-addr-ulica" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Súpisné č.</Label>
        <Input className="h-8 text-xs" value={formData.supisneCislo || ""} onChange={e => setFormData(p => ({ ...p, supisneCislo: e.target.value }))} data-testid="input-addr-supisne" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Orientačné č.</Label>
        <Input className="h-8 text-xs" value={formData.orientacneCislo || ""} onChange={e => setFormData(p => ({ ...p, orientacneCislo: e.target.value }))} data-testid="input-addr-orientacne" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Obec/Mesto</Label>
        <Input className="h-8 text-xs" value={formData.obecMesto || ""} onChange={e => setFormData(p => ({ ...p, obecMesto: e.target.value }))} data-testid="input-addr-obec" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">PSČ</Label>
        <Input className="h-8 text-xs" value={formData.psc || ""} onChange={e => setFormData(p => ({ ...p, psc: e.target.value }))} data-testid="input-addr-psc" />
      </div>
      <div className="col-span-3">
        <Label className="text-[10px] text-muted-foreground">Štát</Label>
        <Input className="h-8 text-xs" value={formData.stat || "Slovensko"} onChange={e => setFormData(p => ({ ...p, stat: e.target.value }))} data-testid="input-addr-stat" />
      </div>
      <div className="col-span-3 flex items-center gap-2 mt-1">
        <Button size="sm" onClick={addingType ? submitAdd : submitEdit} disabled={createAddress.isPending || updateAddress.isPending} data-testid="button-save-address">
          {(createAddress.isPending || updateAddress.isPending) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Uložiť
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelForm} data-testid="button-cancel-address">
          <X className="w-3 h-3 mr-1" /> Zrušiť
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="mb-4" data-testid="address-collection-block">
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4" data-testid="address-collection-block">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Adresy</span>
            <Badge variant="outline" className="text-[10px]">{(addresses || []).length} adries</Badge>
          </div>
          {!isClientView && (
            <div className="flex items-center gap-1">
              {!existingTypes.has("trvaly") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("trvaly")} data-testid="button-add-trvaly">
                  <Plus className="w-3 h-3 mr-1" /> Trvalý pobyt
                </Button>
              )}
              {!existingTypes.has("prechodny") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("prechodny")} data-testid="button-add-prechodny">
                  <Plus className="w-3 h-3 mr-1" /> Prechodný pobyt
                </Button>
              )}
              {!existingTypes.has("korespondencna") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("korespondencna")} data-testid="button-add-korespondencna">
                  <Plus className="w-3 h-3 mr-1" /> Korešpondenčná
                </Button>
              )}
            </div>
          )}
        </div>

        {addingType && (
          <div className="rounded-md border border-blue-500/50 bg-blue-500/5 p-3" data-testid="address-add-form">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">{ADDRESS_TYPE_LABELS[addingType]}</span>
              <Badge variant="outline" className="text-[9px] border-blue-500/50">Nová</Badge>
            </div>
            {renderForm()}
          </div>
        )}

        {(!addresses || addresses.length === 0) && !addingType && (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadne adresy. Pridajte adresu pomocou tlačidiel vyššie.</p>
        )}

        {(addresses || []).map(addr => {
          const isEditing = editingId === addr.id;
          const addrHistory = getHistoryForAddress(addr.addressType);
          const isHistoryOpen = historyOpen === addr.id;
          return (
            <div
              key={addr.id}
              className={`rounded-md border p-3 ${addr.isHlavna ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-muted/20"}`}
              data-testid={`address-card-${addr.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3.5 h-3.5 ${addr.isHlavna ? "text-amber-400" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{ADDRESS_TYPE_LABELS[addr.addressType] || addr.addressType}</span>
                  {addr.isHlavna && (
                    <Badge className="text-[9px] bg-amber-600/80 text-white" data-testid={`badge-hlavna-${addr.id}`}>
                      <Mail className="w-2.5 h-2.5 mr-0.5" /> Hlavná
                    </Badge>
                  )}
                </div>
                {!isClientView && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setHistoryOpen(isHistoryOpen ? null : addr.id)}
                      title="História zmien"
                      data-testid={`button-history-${addr.id}`}
                    >
                      <Clock className={`w-3.5 h-3.5 ${isHistoryOpen ? "text-blue-400" : "text-muted-foreground"}`} />
                    </Button>
                    {!addr.isHlavna && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setHlavna.mutate(addr.id)}
                        disabled={setHlavna.isPending}
                        title="Nastaviť ako hlavnú"
                        data-testid={`button-set-hlavna-${addr.id}`}
                      >
                        <Star className="w-3.5 h-3.5 text-muted-foreground hover:text-amber-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => isEditing ? cancelForm() : startEdit(addr)}
                      data-testid={`button-edit-${addr.id}`}
                    >
                      <Pencil className={`w-3.5 h-3.5 ${isEditing ? "text-blue-400" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => { if (confirm("Naozaj odstrániť túto adresu?")) deleteAddress.mutate(addr.id); }}
                      disabled={deleteAddress.isPending}
                      data-testid={`button-delete-${addr.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                renderForm()
              ) : (
                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                  {addrFields.map(f => {
                    const val = (addr as any)[f];
                    if (!val && f !== "stat") return null;
                    return (
                      <div key={f} className={f === "ulica" ? "col-span-2" : ""}>
                        <span className="text-[10px] text-muted-foreground">{ADDRESS_FIELD_LABELS[f]}: </span>
                        <span className="text-xs font-medium">{val || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {addr.updatedByName && (
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  Posledná zmena: {addr.updatedByName} {addr.updatedAt ? `• ${formatDateSlovak(String(addr.updatedAt))}` : ""}
                </div>
              )}

              {isHistoryOpen && addrHistory.length > 0 && (
                <div className="mt-2 border-t border-border pt-2 space-y-1" data-testid={`address-history-${addr.id}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <History className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-300">História zmien ({addrHistory.length})</span>
                  </div>
                  {addrHistory.slice(0, 10).map(h => {
                    const fieldSuffix = h.fieldKey.replace(`addr_${addr.addressType}_`, "");
                    const label = ADDRESS_FIELD_LABELS[fieldSuffix] || h.fieldKey;
                    return (
                      <div key={h.id} className="flex items-start gap-2 text-[10px] py-0.5" data-testid={`addr-history-entry-${h.id}`}>
                        <span className="text-muted-foreground whitespace-nowrap">{h.changedAt ? formatDateSlovak(String(h.changedAt)) : ""}</span>
                        <span className="font-medium">{label}:</span>
                        <span className="text-red-400">{h.oldValue || "–"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-green-400">{h.newValue || "–"}</span>
                        {h.changedByName && <span className="text-muted-foreground ml-auto">({h.changedByName})</span>}
                      </div>
                    );
                  })}
                  {addrHistory.length > 10 && (
                    <p className="text-[10px] text-muted-foreground">...a {addrHistory.length - 10} ďalších záznamov</p>
                  )}
                </div>
              )}
              {isHistoryOpen && addrHistory.length === 0 && (
                <div className="mt-2 border-t border-border pt-2" data-testid={`address-history-${addr.id}`}>
                  <p className="text-[10px] text-muted-foreground">Žiadna história zmien pre túto adresu.</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SubjectRelationsSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [targetSubjectSearch, setTargetSubjectSearch] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [contextSector, setContextSector] = useState("");

  const { data: relationsData, isLoading } = useQuery<any>({
    queryKey: [`/api/subject-relations/${subjectId}`],
  });

  const { data: roleTypes } = useQuery<any[]>({
    queryKey: ["/api/relation-role-types"],
  });

  const { data: summaryData } = useQuery<any>({
    queryKey: [`/api/subject-relations-summary/${subjectId}`],
  });

  const { data: searchResults } = useQuery<any[]>({
    queryKey: [`/api/subjects?search=${encodeURIComponent(targetSubjectSearch)}`],
    enabled: targetSubjectSearch.length >= 2,
  });

  const addRelation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/subject-relations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/subject-relations/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/subject-relations-summary/${subjectId}`] });
      setShowAddDialog(false);
      setSelectedCategory("");
      setSelectedRoleId("");
      setTargetSubjectSearch("");
      setSelectedTargetId(null);
      setContextSector("");
      toast({ title: "Relácia pridaná" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const deactivateRelation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/subject-relations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/subject-relations/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/subject-relations-summary/${subjectId}`] });
      toast({ title: "Relácia deaktivovaná" });
    },
  });

  const createDraftAndLink = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; companyName?: string; type: string }) => {
      const roleType = roleTypes?.find((r: any) => String(r.id) === selectedRoleId);
      const res = await apiRequest("POST", "/api/subjects/draft", {
        ...data,
        sourceSubjectId: subjectId,
        sourceRelationRoleCode: roleType?.code,
        sourceContext: contextSector || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.isDuplicate) {
        toast({ title: "Subjekt už existuje", description: "Vyberte existujúci subjekt zo zoznamu", variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/subject-relations/${subjectId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/subject-relations-summary/${subjectId}`] });
        setShowAddDialog(false);
        toast({ title: "Draft subjekt vytvorený a prepojený" });
      }
    },
  });

  const categoryLabels: Record<string, string> = {
    zmluvna_strana: "Zmluvná strana",
    predmet_zaujmu: "Predmet záujmu",
    beneficient: "Beneficient",
    kontakt: "Kontakt",
    rodina: "Rodinné väzby",
  };

  const categoryIcons: Record<string, any> = {
    zmluvna_strana: Scale,
    predmet_zaujmu: User,
    beneficient: UserCheck,
    kontakt: Users,
    rodina: Heart,
  };

  const familyRoleIcons: Record<string, any> = {
    rodic_zakonny_zastupca: Crown,
    dieta_opravnena_osoba: Baby,
    manzel_manzelka: Heart,
    partner_druh: Heart,
    stary_rodic: TreePine,
    vnuk_vnucka: Baby,
    surodenc: Users,
    iny_pribuzny: User,
  };

  const filteredRoles = roleTypes?.filter((r: any) => !selectedCategory || r.category === selectedCategory) || [];

  const handleAddRelation = () => {
    if (!selectedTargetId || !selectedRoleId) return;
    const roleType = roleTypes?.find((r: any) => String(r.id) === selectedRoleId);
    addRelation.mutate({
      sourceSubjectId: subjectId,
      targetSubjectId: selectedTargetId,
      roleTypeId: parseInt(selectedRoleId),
      category: roleType?.category || selectedCategory,
      contextSector: contextSector || null,
    });
  };

  if (isLoading) return <div className="flex items-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Načítavam relácie...</div>;

  const categories = relationsData?.categories || {};
  const allRelations = Object.values(categories).flatMap((c: any) => c.relations || []);

  return (
    <Card className="mb-4" data-testid="subject-relations-section">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Relácie subjektu</span>
            <Badge variant="outline" className="text-[10px]">{allRelations.length} väzieb</Badge>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs" data-testid="btn-add-relation">
                <Plus className="w-3 h-3 mr-1" /> Pridať reláciu
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" data-testid="dialog-add-relation">
              <DialogHeader>
                <DialogTitle>Pridať reláciu</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Kategória roly</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-relation-category"><SelectValue placeholder="Vyberte kategóriu" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rola</Label>
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-relation-role"><SelectValue placeholder="Vyberte rolu" /></SelectTrigger>
                    <SelectContent>
                      {filteredRoles.map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Kontext / Sektor</Label>
                  <Input className="h-8 text-xs" placeholder="napr. Poistenie, Reality, Investície..." value={contextSector} onChange={e => setContextSector(e.target.value)} data-testid="input-context-sector" />
                </div>
                <div>
                  <Label className="text-xs">Hľadať subjekt</Label>
                  <Input className="h-8 text-xs" placeholder="Meno, priezvisko alebo názov firmy..." value={targetSubjectSearch} onChange={e => { setTargetSubjectSearch(e.target.value); setSelectedTargetId(null); }} data-testid="input-search-target-subject" />
                  {searchResults && searchResults.length > 0 && !selectedTargetId && (
                    <div className="border border-border rounded mt-1 max-h-32 overflow-y-auto">
                      {searchResults.slice(0, 8).map((s: any) => (
                        <div key={s.id} className="px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 flex items-center gap-2"
                          onClick={() => { setSelectedTargetId(s.id); setTargetSubjectSearch(s.companyName || `${s.firstName || ""} ${s.lastName || ""}`.trim()); }}
                          data-testid={`search-result-${s.id}`}>
                          <User className="w-3 h-3" />
                          <span>{s.companyName || `${s.firstName || ""} ${s.lastName || ""}`.trim()}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">{s.uid}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedTargetId && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">Vybraný: ID {selectedTargetId}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs" onClick={handleAddRelation} disabled={!selectedTargetId || !selectedRoleId || addRelation.isPending} data-testid="btn-confirm-add-relation">
                    {addRelation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
                    Prepojiť
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                    if (!targetSubjectSearch.trim()) return;
                    const parts = targetSubjectSearch.trim().split(" ");
                    createDraftAndLink.mutate({ firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined, type: "FO" });
                  }} disabled={!targetSubjectSearch.trim() || !selectedRoleId || createDraftAndLink.isPending} data-testid="btn-create-draft-subject">
                    {createDraftAndLink.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                    Vytvoriť draft
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {summaryData?.summary && (
          <div className="bg-muted/30 border border-border rounded p-2" data-testid="relations-summary">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Prehľad:</span> {summaryData.summary || "Žiadne relácie"}
            </p>
          </div>
        )}

        {Object.entries(categories).map(([catKey, catData]: [string, any]) => {
          if (!catData.relations || catData.relations.length === 0) return null;
          const CatIcon = categoryIcons[catKey] || Users;
          return (
            <div key={catKey} className="space-y-1" data-testid={`relation-category-${catKey}`}>
              <div className="flex items-center gap-2 mb-1">
                <CatIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">{categoryLabels[catKey] || catKey}</span>
                <Badge variant="outline" className="text-[9px]">{catData.relations.length}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead className="py-1 px-2">Rola</TableHead>
                    <TableHead className="py-1 px-2">Prepojený subjekt</TableHead>
                    <TableHead className="py-1 px-2">Smer</TableHead>
                    <TableHead className="py-1 px-2">Sektor</TableHead>
                    <TableHead className="py-1 px-2 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catData.relations.map((rel: any) => {
                    const linked = rel.linkedSubject;
                    const name = linked?.companyName || `${linked?.firstName || ""} ${linked?.lastName || ""}`.trim() || "—";
                    return (
                      <TableRow key={rel.id} className="text-xs" data-testid={`relation-row-${rel.id}`}>
                        <TableCell className="py-1 px-2">
                          <Badge variant="secondary" className="text-[10px]">{rel.roleLabel}</Badge>
                          {rel.isDraft && <Badge variant="outline" className="text-[9px] ml-1 text-orange-500 border-orange-300">Draft</Badge>}
                        </TableCell>
                        <TableCell className="py-1 px-2 font-medium">
                          <div className="flex items-center gap-1">
                            {name}
                            <span className="text-[9px] text-muted-foreground">({linked?.uid})</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1 px-2">
                          <Badge variant="outline" className="text-[9px]">
                            {rel.direction === "outgoing" ? "→ Odchádzajúca" : "← Prichádzajúca"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1 px-2 text-muted-foreground">
                          {rel.contextSector || "—"}
                        </TableCell>
                        <TableCell className="py-1 px-2">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                            onClick={() => deactivateRelation.mutate(rel.id)} data-testid={`btn-deactivate-relation-${rel.id}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })}

        {allRelations.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground" data-testid="no-relations">
            <Network className="w-6 h-6 mx-auto mb-2 opacity-30" />
            Žiadne relácie. Kliknite &quot;Pridať reláciu&quot; pre vytvorenie väzby.
          </div>
        )}

        <GuardianshipSection subjectId={subjectId} />
        <HouseholdSection subjectId={subjectId} />
        <FamilySpiderSection subjectId={subjectId} />
        <MaturityAlertsSection subjectId={subjectId} />
        <PrivacyConsentSection subjectId={subjectId} />
        <InheritanceSection subjectId={subjectId} />
        <AddressGroupSection subjectId={subjectId} />
        <CompanyRolesSection subjectId={subjectId} />
      </CardContent>
    </Card>
  );
}

function HouseholdSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null);
  const [householdName, setHouseholdName] = useState("");
  const [householdAddress, setHouseholdAddress] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [assetType, setAssetType] = useState("nehnutelnost");
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("");
  const [assetDescription, setAssetDescription] = useState("");

  const { data: householdsData } = useQuery<any[]>({
    queryKey: [`/api/households/subject/${subjectId}`],
  });

  const createHousehold = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/households", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/households/subject/${subjectId}`] });
      setShowCreateDialog(false);
      setHouseholdName("");
      setHouseholdAddress("");
      toast({ title: "Domácnosť vytvorená" });
    },
  });

  const addMember = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/households/${data.householdId}/members`, { subjectId: data.subjectId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/households/subject/${subjectId}`] });
      setShowAddMemberDialog(false);
      setNewMemberId("");
      toast({ title: "Člen pridaný do domácnosti" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (data: { householdId: number; memberId: number }) => {
      const res = await apiRequest("POST", `/api/households/${data.householdId}/members/${data.memberId}/remove`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/households/subject/${subjectId}`] });
      toast({ title: "Člen odstránený z domácnosti" });
    },
  });

  const addAsset = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/households/${data.householdId}/assets`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/households/subject/${subjectId}`] });
      setShowAddAssetDialog(false);
      setAssetName("");
      setAssetValue("");
      setAssetDescription("");
      toast({ title: "Majetok pridaný" });
    },
  });

  const removeAsset = useMutation({
    mutationFn: async (assetId: number) => {
      const res = await apiRequest("DELETE", `/api/household-assets/${assetId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/households/subject/${subjectId}`] });
      toast({ title: "Majetok odstránený" });
    },
  });

  const assetTypeLabels: Record<string, string> = {
    nehnutelnost: "Nehnuteľnosť",
    hypoteka: "Hypotéka",
    auto: "Automobil",
    investicia: "Investícia",
    poistenie: "Poistenie",
    uver: "Úver/Leasing",
    ine: "Iné",
  };

  return (
    <div className="mt-3 border border-purple-500/20 rounded p-3 bg-purple-500/5" data-testid="household-section">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-300">Domácnosti</span>
        {householdsData && householdsData.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{householdsData.length} domácností</Badge>
        )}
        <Button size="sm" variant="outline" className="text-[10px] ml-auto"
          onClick={() => setShowCreateDialog(true)} data-testid="btn-create-household">
          <Plus className="w-3 h-3 mr-1" /> Nová domácnosť
        </Button>
      </div>

      {householdsData && householdsData.length > 0 ? (
        <div className="space-y-3">
          {householdsData.map((h: any) => (
            <div key={h.id} className="border border-border rounded p-2 bg-background/50" data-testid={`household-${h.id}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Home className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium">{h.name}</span>
                <span className="text-[9px] text-muted-foreground">({h.uid})</span>
                <Badge variant="outline" className="text-[9px]">{h.myRole}</Badge>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="text-[10px]"
                    onClick={() => { setSelectedHouseholdId(h.id); setShowAddMemberDialog(true); }}
                    data-testid={`btn-add-member-${h.id}`}>
                    <UserPlus className="w-3 h-3 mr-1" /> Člen
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[10px]"
                    onClick={() => { setSelectedHouseholdId(h.id); setShowAddAssetDialog(true); }}
                    data-testid={`btn-add-asset-${h.id}`}>
                    <Plus className="w-3 h-3 mr-1" /> Majetok
                  </Button>
                </div>
              </div>
              {h.address && <p className="text-[9px] text-muted-foreground mb-1"><MapPin className="w-3 h-3 inline mr-1" />{h.address}</p>}

              {h.members?.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[9px] font-medium text-purple-400 mb-1">Členovia:</p>
                  <div className="flex flex-wrap gap-1">
                    {h.members.map((m: any) => (
                      <div key={m.memberId} className="flex items-center gap-1 text-[9px] bg-muted/30 rounded px-1.5 py-0.5" data-testid={`household-member-${m.subjectId}`}>
                        <User className="w-2.5 h-2.5" />
                        <span>{m.name}</span>
                        <Badge variant="outline" className="text-[8px]">{m.role}</Badge>
                        {m.subjectId !== subjectId && (
                          <Button variant="ghost" size="icon" className="p-0 text-destructive shrink-0"
                            onClick={() => removeMember.mutate({ householdId: h.id, memberId: m.memberId })}
                            data-testid={`btn-remove-member-${m.subjectId}`}>
                            <X className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {h.assets?.length > 0 && (
                <div>
                  <p className="text-[9px] font-medium text-purple-400 mb-1">Spoločný majetok (BSM):</p>
                  <div className="space-y-1">
                    {h.assets.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-[9px] bg-muted/20 rounded px-2 py-1" data-testid={`household-asset-${a.id}`}>
                        <Wallet className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="font-medium">{a.name}</span>
                        <Badge variant="outline" className="text-[8px]">{assetTypeLabels[a.assetType] || a.assetType}</Badge>
                        {a.value && <span className="text-muted-foreground">{Number(a.value).toLocaleString("sk-SK")} {a.currency}</span>}
                        {a.description && <span className="text-muted-foreground truncate">{a.description}</span>}
                        <Button variant="ghost" size="icon" className="p-0 text-destructive shrink-0 ml-auto"
                          onClick={() => removeAsset.mutate(a.id)} data-testid={`btn-remove-asset-${a.id}`}>
                          <X className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-2">Subjekt nie je členom žiadnej domácnosti</p>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-create-household">
          <DialogHeader><DialogTitle>Nová domácnosť</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Názov</Label>
              <Input className="text-xs mt-1" value={householdName} onChange={e => setHouseholdName(e.target.value)}
                placeholder="napr. Rodina Novákových" data-testid="input-household-name" />
            </div>
            <div>
              <Label className="text-xs">Adresa (voliteľné)</Label>
              <Input className="text-xs mt-1" value={householdAddress} onChange={e => setHouseholdAddress(e.target.value)}
                placeholder="napr. Hlavná 15, Bratislava" data-testid="input-household-address" />
            </div>
            <Button size="sm" className="text-xs" disabled={!householdName || createHousehold.isPending}
              onClick={() => createHousehold.mutate({ name: householdName, address: householdAddress, memberSubjectIds: [subjectId] })}
              data-testid="btn-confirm-create-household">
              {createHousehold.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Vytvoriť
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-add-member">
          <DialogHeader><DialogTitle>Pridať člena domácnosti</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ID subjektu</Label>
              <Input className="text-xs mt-1" value={newMemberId} onChange={e => setNewMemberId(e.target.value)}
                placeholder="Zadajte ID subjektu" data-testid="input-member-id" />
            </div>
            <Button size="sm" className="text-xs" disabled={!newMemberId || addMember.isPending}
              onClick={() => selectedHouseholdId && addMember.mutate({ householdId: selectedHouseholdId, subjectId: parseInt(newMemberId) })}
              data-testid="btn-confirm-add-member">
              {addMember.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              Pridať
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAssetDialog} onOpenChange={setShowAddAssetDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-add-asset">
          <DialogHeader><DialogTitle>Pridať spoločný majetok</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Typ majetku</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger className="text-xs mt-1" data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(assetTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Názov</Label>
              <Input className="text-xs mt-1" value={assetName} onChange={e => setAssetName(e.target.value)}
                placeholder="napr. Byt na Hlavnej 15" data-testid="input-asset-name" />
            </div>
            <div>
              <Label className="text-xs">Hodnota (EUR)</Label>
              <Input className="text-xs mt-1" type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)}
                placeholder="napr. 150000" data-testid="input-asset-value" />
            </div>
            <div>
              <Label className="text-xs">Popis (voliteľné)</Label>
              <Input className="text-xs mt-1" value={assetDescription} onChange={e => setAssetDescription(e.target.value)}
                placeholder="Bližšie informácie o majetku" data-testid="input-asset-description" />
            </div>
            <Button size="sm" className="text-xs" disabled={!assetName || addAsset.isPending}
              onClick={() => selectedHouseholdId && addAsset.mutate({ householdId: selectedHouseholdId, assetType, name: assetName, value: assetValue, description: assetDescription })}
              data-testid="btn-confirm-add-asset">
              {addAsset.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Pridať majetok
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrivacyConsentSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();

  const { data: privacyTrigger } = useQuery<any>({
    queryKey: [`/api/privacy-trigger/${subjectId}`],
  });

  const { data: consentLogs } = useQuery<any[]>({
    queryKey: [`/api/access-consent/subject/${subjectId}`],
  });

  const { data: privacyBlksData } = useQuery<any[]>({
    queryKey: [`/api/privacy-blocks/${subjectId}`],
  });

  const grantConsent = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/access-consent", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/privacy-trigger/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/access-consent/subject/${subjectId}`] });
      toast({ title: "Súhlas udelený" });
    },
  });

  const revokeConsent = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/access-consent", { ...data, action: "revoke" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/privacy-trigger/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/access-consent/subject/${subjectId}`] });
      toast({ title: "Súhlas odobraný" });
    },
  });

  const hasPrivacyTrigger = privacyTrigger?.isAdult && privacyTrigger?.needsConsentReview;
  const hasConsents = consentLogs && consentLogs.length > 0;
  const hasPrivacyBlocks = privacyBlksData && privacyBlksData.length > 0;

  if (!hasPrivacyTrigger && !hasConsents && !hasPrivacyBlocks) return null;

  return (
    <div className="mt-3 border border-amber-500/20 rounded p-3 bg-amber-500/5" data-testid="privacy-consent-section">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">GDPR & Súkromie</span>
        {hasPrivacyBlocks && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{privacyBlksData!.length} súkromných blokov</Badge>}
      </div>

      {hasPrivacyTrigger && (
        <div className="mb-3 border border-red-500/30 rounded p-2 bg-red-500/10" data-testid="privacy-trigger-alert">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Privacy Trigger: Dospelosť ({privacyTrigger.age} r.)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Subjekt dosiahol 18 rokov. Citlivé údaje sú obmedzené pre zákonných zástupcov.
            Pre obnovenie prístupu je potrebný manuálny súhlas.
          </p>
          {privacyTrigger.guardianIds?.map((gId: number) => (
            <div key={gId} className="flex items-center gap-2 mb-1" data-testid={`consent-action-${gId}`}>
              <span className="text-[10px] text-muted-foreground">Zástupca #{gId}:</span>
              <Button size="sm" variant="outline" className="text-[10px]"
                onClick={() => grantConsent.mutate({
                  grantorSubjectId: subjectId,
                  granteeSubjectId: gId,
                  consentType: "post_maturity_sharing",
                  action: "grant",
                  scope: "full",
                  reason: "Manuálny súhlas po dosiahnutí dospelosti",
                  legalBasis: "Súhlas dotknutej osoby (čl. 6(1)(a) GDPR)"
                })}
                disabled={grantConsent.isPending}
                data-testid={`btn-grant-consent-${gId}`}>
                <CheckCircle className="w-3 h-3 mr-1" /> Udeliť plný prístup
              </Button>
            </div>
          ))}
        </div>
      )}

      {privacyTrigger?.hasActiveConsent && (
        <div className="mb-3 border border-green-500/30 rounded p-2 bg-green-500/10" data-testid="active-consent-info">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400">Aktívny súhlas s prístupom po dospelosti</span>
            <Button size="sm" variant="ghost" className="text-[10px] ml-auto text-destructive"
              onClick={() => {
                privacyTrigger.consentDetails?.forEach((c: any) => {
                  revokeConsent.mutate({
                    grantorSubjectId: subjectId,
                    granteeSubjectId: c.granteeSubjectId,
                    consentType: "post_maturity_sharing",
                    reason: "Odobranie súhlasu po dospelosti"
                  });
                });
              }}
              data-testid="btn-revoke-all-consent">
              <Unlink className="w-3 h-3 mr-1" /> Odobrať súhlas
            </Button>
          </div>
        </div>
      )}

      {hasPrivacyBlocks && (
        <div className="mb-3" data-testid="privacy-blocks-list">
          <p className="text-[9px] font-medium text-amber-400 mb-1">Súkromné bloky údajov:</p>
          <div className="flex flex-wrap gap-1">
            {privacyBlksData!.map((pb: any) => (
              <Badge key={pb.id} variant="outline" className="text-[8px] border-amber-500/30" data-testid={`privacy-block-${pb.id}`}>
                <EyeOff className="w-2.5 h-2.5 mr-0.5" />
                {pb.blockType}/{pb.blockKey}
                {pb.collectionIndex != null && ` [${pb.collectionIndex}]`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasConsents && (
        <div data-testid="consent-audit-log">
          <p className="text-[9px] font-medium text-amber-400 mb-1">Audit prístupu (posledných 10):</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {consentLogs!.slice(0, 10).map((log: any) => (
              <div key={log.id} className="flex items-center gap-2 text-[9px] bg-muted/20 rounded px-2 py-1" data-testid={`consent-log-${log.id}`}>
                {log.action === "grant" ? (
                  <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                ) : (
                  <Ban className="w-3 h-3 text-red-400 shrink-0" />
                )}
                <span className="font-medium">{log.grantorName}</span>
                <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{log.granteeName}</span>
                <Badge variant="outline" className="text-[8px]">{log.consentType}</Badge>
                <Badge variant="outline" className={`text-[8px] ${log.action === "grant" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
                  {log.action === "grant" ? "Udelený" : "Odobraný"}
                </Badge>
                {log.reason && <span className="text-muted-foreground truncate">{log.reason}</span>}
                <span className="text-muted-foreground ml-auto shrink-0">
                  {log.createdAt ? new Date(log.createdAt).toLocaleDateString("sk-SK") : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuardianshipSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [wardSearch, setWardSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showDetachDialog, setShowDetachDialog] = useState(false);
  const [selectedRelationId, setSelectedRelationId] = useState<number | null>(null);
  const [detachReason, setDetachReason] = useState("");

  const searchParam = wardSearch.length >= 2 ? `&search=${encodeURIComponent(wardSearch)}` : "";
  const { data: wardsData } = useQuery<any>({
    queryKey: ['/api/guardianship/wards', subjectId, currentPage, wardSearch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/guardianship/wards/${subjectId}?page=${currentPage}&limit=50${searchParam}`);
      return res.json();
    },
  });

  const { data: guardiansData } = useQuery<any>({
    queryKey: [`/api/guardianship/guardians/${subjectId}`],
  });

  const { data: historyData } = useQuery<any[]>({
    queryKey: [`/api/guardianship/history/${subjectId}`],
  });

  const detachGuardianship = useMutation({
    mutationFn: async (data: { relationId: number; reason: string }) => {
      const res = await apiRequest("POST", "/api/guardianship/detach", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guardianship/wards', subjectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/guardianship/guardians/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/guardianship/history/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/family/tree/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/subject-relations/${subjectId}`] });
      setShowDetachDialog(false);
      setSelectedRelationId(null);
      setDetachReason("");
      toast({ title: "Zastupovanie ukončené a archivované" });
    },
  });

  const hasWards = wardsData?.wards?.length > 0;
  const hasGuardians = guardiansData?.guardians?.length > 0;
  const hasHistory = historyData && historyData.length > 0;

  if (!hasWards && !hasGuardians && !hasHistory) return null;

  return (
    <div className="mt-3 border border-emerald-500/20 rounded p-3 bg-emerald-500/5" data-testid="guardianship-section">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-300">Zákonné zastupovanie</span>
        {hasWards && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{wardsData.total} zastupovaných</Badge>}
        {hasGuardians && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{guardiansData.total} zástupcov</Badge>}
        {hasHistory && (
          <Button size="sm" variant="ghost" className="text-[10px] ml-auto text-muted-foreground"
            onClick={() => setShowHistoryDialog(true)} data-testid="btn-guardianship-history">
            <BookOpen className="w-3 h-3 mr-1" /> História
          </Button>
        )}
      </div>

      {hasGuardians && (
        <div className="mb-3" data-testid="guardians-list">
          <p className="text-[10px] font-medium text-emerald-400 mb-1.5">Zákonní zástupcovia tohto subjektu:</p>
          <div className="space-y-1">
            {guardiansData.guardians.map((g: any) => (
              <div key={g.relationId} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 border border-border/50" data-testid={`guardian-${g.subjectId}`}>
                {g.type === "company" ? <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{g.name}</span>
                    <span className="text-[9px] text-muted-foreground">({g.uid})</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30">{g.roleLabel}</Badge>
                    {g.type === "company" && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">PO</Badge>}
                    {g.meta?.retainedAfterMaturity && <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">Po dospelosti</Badge>}
                  </div>
                  {(g.email || g.phone) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {g.email && <span className="text-[9px] text-muted-foreground">{g.email}</span>}
                      {g.phone && <span className="text-[9px] text-muted-foreground">{g.phone}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasWards && (
        <div data-testid="wards-list">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] font-medium text-emerald-400">Zastupované osoby:</p>
            {(wardsData.total || 0) > 10 && (
              <div className="relative flex-1 max-w-48">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="text-[10px] pl-6" placeholder="Hľadať zastupovaného..."
                  value={wardSearch} onChange={e => { setWardSearch(e.target.value); setCurrentPage(1); }}
                  data-testid="input-ward-search" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            {wardsData.wards.map((w: any) => (
              <div key={w.relationId} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 border border-border/50" data-testid={`ward-${w.subjectId}`}>
                <Baby className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{w.name}</span>
                    <span className="text-[9px] text-muted-foreground">({w.uid})</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30">{w.roleLabel}</Badge>
                    {w.isMinor && <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">{w.age} r.</Badge>}
                    {!w.isMinor && w.age !== null && <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400">{w.age} r. (dospelý)</Badge>}
                    {w.meta?.retainedAfterMaturity && <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">Zachované</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {w.dateOfBirth && <span className="text-[9px] text-muted-foreground">Nar.: {new Date(w.dateOfBirth).toLocaleDateString("sk-SK")}</span>}
                    {w.email && <span className="text-[9px] text-muted-foreground">{w.email}</span>}
                    {w.phone && <span className="text-[9px] text-muted-foreground">{w.phone}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="p-0 text-destructive shrink-0"
                  onClick={() => { setSelectedRelationId(w.relationId); setShowDetachDialog(true); }}
                  data-testid={`btn-detach-ward-${w.subjectId}`}>
                  <Unlink className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          {wardsData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-[10px]" disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)} data-testid="btn-wards-prev">Predchádzajúca</Button>
              <span className="text-[10px] text-muted-foreground">{currentPage} / {wardsData.totalPages}</span>
              <Button size="sm" variant="outline" className="text-[10px]" disabled={currentPage >= wardsData.totalPages}
                onClick={() => setCurrentPage(p => p + 1)} data-testid="btn-wards-next">Ďalšia</Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showDetachDialog} onOpenChange={setShowDetachDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-detach-guardianship">
          <DialogHeader>
            <DialogTitle>Ukončiť zastupovanie</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ukončenie zákonného zastupovania archivuje históriu väzby. Táto akcia je nevratná.
            </p>
            <div>
              <Label className="text-[10px]">Dôvod ukončenia (voliteľné)</Label>
              <Input className="text-xs mt-1" placeholder="napr. Dospelosť, Súdne rozhodnutie..."
                value={detachReason} onChange={e => setDetachReason(e.target.value)}
                data-testid="input-detach-reason" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs"
                onClick={() => selectedRelationId && detachGuardianship.mutate({ relationId: selectedRelationId, reason: detachReason || "manual_detach" })}
                disabled={detachGuardianship.isPending}
                data-testid="btn-confirm-detach">
                {detachGuardianship.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Unlink className="w-3 h-3 mr-1" />}
                Ukončiť
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowDetachDialog(false)}>Zrušiť</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-guardianship-history">
          <DialogHeader>
            <DialogTitle>História zastupovania</DialogTitle>
          </DialogHeader>
          {historyData && historyData.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historyData.map((h: any) => (
                <div key={h.id} className="border border-border rounded p-2 bg-muted/20 text-xs" data-testid={`history-entry-${h.id}`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{h.guardianName}</span>
                    <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{h.wardName}</span>
                    <Badge variant="outline" className="text-[9px]">{h.roleLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {h.guardianType === "po" && <Badge variant="outline" className="text-[8px] border-blue-500/30 text-blue-400">Organizácia</Badge>}
                    {h.startedAt && <span>Od: {new Date(h.startedAt).toLocaleDateString("sk-SK")}</span>}
                    {h.endedAt && <span>Do: {new Date(h.endedAt).toLocaleDateString("sk-SK")}</span>}
                    <span>Dôvod: {h.endReason === "maturity_reached_detach" ? "Dospelosť - oddelenie" : h.endReason === "maturity_reached_retain" ? "Dospelosť - zachovanie" : h.endReason || "—"}</span>
                    {h.legalBasis && <span>Základ: {h.legalBasis}</span>}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    Archivoval: {h.archivedByName || "—"} • {h.createdAt ? new Date(h.createdAt).toLocaleString("sk-SK") : "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Žiadna história zastupovania</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FamilySpiderSection({ subjectId }: { subjectId: number }) {
  const { data: familyTree, isLoading } = useQuery<any>({
    queryKey: [`/api/family/tree/${subjectId}`],
  });

  if (isLoading) return null;
  if (!familyTree || familyTree.totalFamilyMembers === 0) return null;

  const roleIcons: Record<string, any> = {
    rodic_zakonny_zastupca: Crown,
    dieta_opravnena_osoba: Baby,
    manzel_manzelka: Heart,
    partner_druh: Heart,
    stary_rodic: TreePine,
    vnuk_vnucka: Baby,
    surodenc: Users,
    iny_pribuzny: User,
  };

  const sections = [
    { key: "parents", label: "Rodičia / Zákonní zástupcovia", members: familyTree.parents, icon: Crown },
    { key: "spouses", label: "Manžel / Manželka / Partner", members: familyTree.spouses, icon: Heart },
    { key: "children", label: "Deti / Oprávnené osoby", members: familyTree.children, icon: Baby },
    { key: "siblings", label: "Súrodenci", members: familyTree.siblings, icon: Users },
    { key: "others", label: "Iní príbuzní", members: familyTree.others, icon: User },
  ].filter(s => s.members && s.members.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="mt-3 border border-pink-500/20 rounded p-3 bg-pink-500/5" data-testid="family-spider-section">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-pink-400" />
        <span className="text-sm font-semibold text-pink-300">Rodinný pavúk</span>
        <Badge variant="outline" className="text-[10px] border-pink-500/30 text-pink-400">{familyTree.totalFamilyMembers} členov</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sections.map(section => {
          const SectionIcon = section.icon;
          return (
            <div key={section.key} className="space-y-1" data-testid={`family-section-${section.key}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <SectionIcon className="w-3 h-3 text-pink-400" />
                <span className="text-[11px] font-medium text-pink-300">{section.label}</span>
              </div>
              {section.members.map((m: any) => {
                const RoleIcon = roleIcons[m.roleCode] || User;
                return (
                  <div key={m.relationId} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 border border-border/50" data-testid={`family-member-${m.subjectId}`}>
                    <RoleIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{m.name || "—"}</span>
                        <span className="text-[9px] text-muted-foreground">({m.uid})</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[9px] border-pink-500/30">{m.roleLabel}</Badge>
                        {m.isMinor && (
                          <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Neplnoletý ({m.age} r.)
                          </Badge>
                        )}
                        {m.age !== null && !m.isMinor && (
                          <span className="text-[9px] text-muted-foreground">{m.age} rokov</span>
                        )}
                        {m.contextSector && (
                          <span className="text-[9px] text-muted-foreground">{m.contextSector}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaturityAlertsSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [legalBasis, setLegalBasis] = useState("");

  const { data: alertsData } = useQuery<any>({
    queryKey: [`/api/maturity-alerts/subject/${subjectId}`],
  });

  const resolveAlert = useMutation({
    mutationFn: async ({ id, resolution, legalBasis }: { id: number; resolution: string; legalBasis?: string }) => {
      const res = await apiRequest("PATCH", `/api/maturity-alerts/${id}/resolve`, { resolution, legalBasis });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/maturity-alerts/subject/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/guardianship/wards', subjectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/guardianship/guardians/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/family/tree/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/guardianship/history/${subjectId}`] });
      setShowResolveDialog(false);
      setSelectedAlert(null);
      setLegalBasis("");
      const msg = vars.resolution === "detach" ? "Zastupovanie ukončené a archivované" : vars.resolution === "retain" ? "Zastupovanie zachované s právnym základom" : "Alert vyriešený";
      toast({ title: msg });
    },
  });

  if (!alertsData || alertsData.total === 0) return null;

  const allAlerts = [...(alertsData.childAlerts || []), ...(alertsData.parentAlerts || [])];

  const alertTypeConfig: Record<string, { color: string; label: string; icon: any }> = {
    reached: { color: "border-red-500/30 bg-red-500/10 text-red-400", label: "DOSIAHNUTÁ DOSPELOSŤ", icon: Bell },
    imminent: { color: "border-orange-500/30 bg-orange-500/10 text-orange-400", label: "Do 30 dní", icon: AlertTriangle },
    approaching: { color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", label: "Do 90 dní", icon: Clock },
    upcoming: { color: "border-blue-500/30 bg-blue-500/10 text-blue-300", label: "Do 1 roka", icon: Clock },
  };

  return (
    <div className="mt-3 border border-orange-500/20 rounded p-3 bg-orange-500/5" data-testid="maturity-alerts-section">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-300">Semafor dospelosti</span>
        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">{allAlerts.length} alertov</Badge>
      </div>

      <div className="space-y-2">
        {allAlerts.map((alert: any) => {
          const config = alertTypeConfig[alert.alertType] || alertTypeConfig.upcoming;
          const AlertIcon = config.icon;
          const dob = alert.dateOfBirth ? new Date(alert.dateOfBirth).toLocaleDateString("sk-SK") : "—";
          const matDate = alert.maturityDate ? new Date(alert.maturityDate).toLocaleDateString("sk-SK") : "—";

          return (
            <div key={alert.id} className={`flex items-start gap-2 rounded px-3 py-2 border ${config.color}`} data-testid={`maturity-alert-${alert.id}`}>
              <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{config.label}</span>
                  {alert.daysUntilMaturity !== null && alert.daysUntilMaturity > 0 && (
                    <span className="text-[10px]">({alert.daysUntilMaturity} dní)</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5">
                  Dátum narodenia: <span className="font-medium">{dob}</span> • 18. narodeniny: <span className="font-medium">{matDate}</span>
                </p>
                {alert.alertType === "reached" && (
                  <p className="text-[10px] mt-1 font-medium">
                    Subjekt dosiahol dospelosť. Skontrolujte právny stav a rozhodnite o zastupovaní.
                  </p>
                )}
              </div>
              {alert.status === "pending" && (
                <div className="flex gap-1 shrink-0">
                  {(alert.alertType === "reached" || alert.alertType === "imminent") && alert.guardianRelationId && (
                    <Button size="sm" variant="outline" className="text-[10px]"
                      onClick={() => { setSelectedAlert(alert); setShowResolveDialog(true); }}
                      data-testid={`btn-maturity-action-${alert.id}`}>
                      <Scale className="w-3 h-3 mr-1" /> Rozhodnúť
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-[10px]"
                    onClick={() => resolveAlert.mutate({ id: alert.id, resolution: "contract_updated" })}
                    disabled={resolveAlert.isPending}
                    data-testid={`btn-resolve-maturity-${alert.id}`}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Vyriešené
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-maturity-resolve">
          <DialogHeader>
            <DialogTitle>Kontrola právneho stavu - Dospelosť</DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Subjekt dosiahol/dosiahne dospelosť. Vyberte, ako naložiť so zákonným zastupovaním:
              </p>
              <div className="space-y-2">
                <div className="border border-border rounded p-3 bg-muted/20">
                  <p className="text-xs font-medium mb-1">Možnosť 1: Oddeliť subjekt</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Ukončí zákonné zastupovanie. Subjekt bude samostatný. Vhodné pre osoby, ktoré dosiahli plnú právnu spôsobilosť.
                  </p>
                  <Button size="sm" variant="destructive" className="text-[10px]"
                    onClick={() => resolveAlert.mutate({ id: selectedAlert.id, resolution: "detach" })}
                    disabled={resolveAlert.isPending}
                    data-testid="btn-detach-guardianship">
                    <Unlink className="w-3 h-3 mr-1" /> Oddeliť (ukončiť zastupovanie)
                  </Button>
                </div>
                <div className="border border-border rounded p-3 bg-muted/20">
                  <p className="text-xs font-medium mb-1">Možnosť 2: Zachovať väzbu</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Ponechá zákonné zastupovanie aj po dosiahnutí dospelosti. Vhodné pre osoby s obmedzenou právnou spôsobilosťou.
                  </p>
                  <div className="mb-2">
                    <Label className="text-[10px]">Právny základ (voliteľné)</Label>
                    <Input className="text-xs mt-1" placeholder="napr. Obmedzená spôsobilosť, Súdne rozhodnutie..."
                      value={legalBasis} onChange={e => setLegalBasis(e.target.value)}
                      data-testid="input-legal-basis" />
                  </div>
                  <Button size="sm" variant="outline" className="text-[10px]"
                    onClick={() => resolveAlert.mutate({ id: selectedAlert.id, resolution: "retain", legalBasis: legalBasis || "obmedzená spôsobilosť" })}
                    disabled={resolveAlert.isPending}
                    data-testid="btn-retain-guardianship">
                    <Link2 className="w-3 h-3 mr-1" /> Zachovať zastupovanie
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InheritanceSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const { data: prompts } = useQuery<any[]>({
    queryKey: [`/api/inheritance-prompts/${subjectId}`],
  });

  const [showDialog, setShowDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);

  const applyInheritance = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/family/apply-inheritance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/inheritance-prompts/${subjectId}`] });
      setShowDialog(false);
      toast({ title: "Údaje prenesené na dieťa" });
    },
  });

  if (!prompts || prompts.length === 0) return null;

  return (
    <div className="mt-3 border border-blue-500/20 rounded p-3 bg-blue-500/5" data-testid="inheritance-section">
      <div className="flex items-center gap-2 mb-2">
        <Home className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-300">Dedičnosť parametrov</span>
        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">{prompts.length} čakajúcich</Badge>
      </div>

      <div className="space-y-1">
        {prompts.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 border border-border/50" data-testid={`inheritance-prompt-${p.id}`}>
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
            <div className="flex-1 text-xs">
              <span className="font-medium">{(p.fieldKeys || []).length} polí</span>
              <span className="text-muted-foreground"> čaká na prenos (adresa, kontakt)</span>
            </div>
            <Button size="sm" variant="outline" className="text-[10px] h-6"
              onClick={() => { setSelectedPrompt(p); setShowDialog(true); }}
              data-testid={`btn-review-inheritance-${p.id}`}>
              Skontrolovať
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-inheritance-review">
          <DialogHeader>
            <DialogTitle>Prenos údajov na prepojené dieťa</DialogTitle>
          </DialogHeader>
          {selectedPrompt && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Zmena adresy u rodiča bola detekovaná. Chcete preniesť tieto údaje aj na prepojené dieťa?
              </p>
              <div className="space-y-1">
                {(selectedPrompt.fieldKeys || []).map((fk: string, i: number) => (
                  <div key={fk} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 text-xs">
                    <span className="font-medium">{(selectedPrompt.fieldLabels || [])[i] || fk}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 line-through">{(selectedPrompt.oldValues as any)?.[fk] || "—"}</span>
                      <span className="text-green-400">{(selectedPrompt.newValues as any)?.[fk] || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="text-xs" onClick={() => {
                  applyInheritance.mutate({
                    sourceSubjectId: selectedPrompt.sourceSubjectId,
                    targetSubjectIds: [selectedPrompt.targetSubjectId],
                    fieldKeys: selectedPrompt.fieldKeys,
                    newValues: selectedPrompt.newValues,
                  });
                }} disabled={applyInheritance.isPending} data-testid="btn-apply-inheritance">
                  {applyInheritance.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                  Preniesť na dieťa
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowDialog(false)} data-testid="btn-cancel-inheritance">
                  Preskočiť
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressGroupSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupAddress, setGroupAddress] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState("address");
  const [newMemberId, setNewMemberId] = useState("");

  const { data: groupsData } = useQuery<any[]>({
    queryKey: [`/api/address-groups/subject/${subjectId}`],
  });

  const createGroup = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/address-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-groups/subject/${subjectId}`] });
      setShowCreateDialog(false);
      setGroupName("");
      setGroupAddress("");
      setGroupDescription("");
      setGroupType("address");
      toast({ title: "Adresná skupina vytvorená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const addMember = useMutation({
    mutationFn: async (data: { groupId: number; subjectId: number }) => {
      const res = await apiRequest("POST", `/api/address-groups/${data.groupId}/members`, { subjectId: data.subjectId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-groups/subject/${subjectId}`] });
      setShowAddMemberDialog(false);
      setNewMemberId("");
      toast({ title: "Člen pridaný do skupiny" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (data: { groupId: number; memberId: number }) => {
      const res = await apiRequest("DELETE", `/api/address-groups/${data.groupId}/members/${data.memberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-groups/subject/${subjectId}`] });
      toast({ title: "Člen odstránený zo skupiny" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const groupTypeLabels: Record<string, string> = {
    address: "Adresná",
    contract: "Zmluvná",
  };

  return (
    <div className="mt-3 border border-cyan-500/20 rounded p-3 bg-cyan-500/5" data-testid="address-group-section">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-cyan-300">Adresné skupiny</span>
        {groupsData && groupsData.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">{groupsData.length} skupín</Badge>
        )}
        <Button size="sm" variant="outline" className="text-[10px] ml-auto"
          onClick={() => setShowCreateDialog(true)} data-testid="btn-create-address-group">
          <Plus className="w-3 h-3 mr-1" /> Vytvoriť skupinu
        </Button>
      </div>

      {groupsData && groupsData.length > 0 ? (
        <div className="space-y-3">
          {groupsData.map((g: any) => (
            <div key={g.id} className="border border-border rounded p-2 bg-background/50" data-testid={`address-group-${g.id}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Home className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-medium">{g.name}</span>
                <span className="text-[9px] text-muted-foreground">({g.uid})</span>
                <Badge variant="outline" className="text-[9px]">{groupTypeLabels[g.groupType] || g.groupType}</Badge>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="text-[10px]"
                    onClick={() => { setSelectedGroupId(g.id); setShowAddMemberDialog(true); }}
                    data-testid={`btn-add-group-member-${g.id}`}>
                    <UserPlus className="w-3 h-3 mr-1" /> Pridať člena
                  </Button>
                </div>
              </div>
              {g.address && <p className="text-[9px] text-muted-foreground mb-1"><MapPin className="w-3 h-3 inline mr-1" />{g.address}</p>}
              {g.description && <p className="text-[9px] text-muted-foreground mb-1">{g.description}</p>}

              {g.members?.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[9px] font-medium text-cyan-400 mb-1">Členovia:</p>
                  <div className="flex flex-wrap gap-1">
                    {g.members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-1 text-[9px] bg-muted/30 rounded px-1.5 py-0.5" data-testid={`group-member-${m.subjectId}`}>
                        <User className="w-2.5 h-2.5" />
                        <span>{m.name}</span>
                        <Badge variant="outline" className="text-[8px]">{m.uid}</Badge>
                        {m.type && (
                          <Badge variant="outline" className="text-[8px]">{m.type === "company" ? "PO" : m.type === "szco" ? "SZČO" : "FO"}</Badge>
                        )}
                        {m.role && <Badge variant="outline" className="text-[8px]">{m.role}</Badge>}
                        {m.subjectId !== subjectId && (
                          <Button variant="ghost" size="icon" className="p-0 text-destructive shrink-0"
                            onClick={() => removeMember.mutate({ groupId: g.id, memberId: m.id })}
                            data-testid={`btn-remove-group-member-${m.id}`}>
                            <X className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-2">Subjekt nie je členom žiadnej adresnej skupiny</p>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-create-address-group">
          <DialogHeader><DialogTitle>Nová adresná skupina</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Názov *</Label>
              <Input className="text-xs mt-1" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="napr. Objekt XY" data-testid="input-group-name" />
            </div>
            <div>
              <Label className="text-xs">Adresa (voliteľné)</Label>
              <Input className="text-xs mt-1" value={groupAddress} onChange={e => setGroupAddress(e.target.value)}
                placeholder="napr. Hlavná 15, Bratislava" data-testid="input-group-address" />
            </div>
            <div>
              <Label className="text-xs">Popis (voliteľné)</Label>
              <Input className="text-xs mt-1" value={groupDescription} onChange={e => setGroupDescription(e.target.value)}
                placeholder="Bližšie informácie o skupine" data-testid="input-group-description" />
            </div>
            <div>
              <Label className="text-xs">Typ skupiny</Label>
              <Select value={groupType} onValueChange={setGroupType}>
                <SelectTrigger className="text-xs mt-1" data-testid="select-group-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="address">Adresná</SelectItem>
                  <SelectItem value="contract">Zmluvná</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="text-xs" disabled={!groupName || createGroup.isPending}
              onClick={() => createGroup.mutate({ name: groupName, address: groupAddress, description: groupDescription, groupType, memberSubjectIds: [subjectId] })}
              data-testid="btn-confirm-create-group">
              {createGroup.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Vytvoriť
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-add-group-member">
          <DialogHeader><DialogTitle>Pridať člena do skupiny</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ID subjektu</Label>
              <Input className="text-xs mt-1" value={newMemberId} onChange={e => setNewMemberId(e.target.value)}
                placeholder="Zadajte ID subjektu" data-testid="input-group-member-id" />
            </div>
            <Button size="sm" className="text-xs" disabled={!newMemberId || addMember.isPending}
              onClick={() => selectedGroupId && addMember.mutate({ groupId: selectedGroupId, subjectId: parseInt(newMemberId) })}
              data-testid="btn-confirm-add-group-member">
              {addMember.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              Pridať
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyRolesSection({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [personSubjectId, setPersonSubjectId] = useState("");
  const [roleType, setRoleType] = useState("zamestnanec");
  const [roleDescription, setRoleDescription] = useState("");
  const [allowedSections, setAllowedSections] = useState<string[]>([]);

  const SECTION_KEYS = ["IDENTITA", "KONTAKT", "ADRESA", "DOKLADY", "EKONOMIKA", "AML", "PRÁVNE SUBJEKTY", "RETAIL", "FAKTÚRY"];

  const { data: subjectData } = useQuery<Subject>({
    queryKey: ['/api/subjects', subjectId],
  });

  const subjectType = subjectData?.type || "person";
  const isCompany = subjectType === "company";

  const { data: companyRoles } = useQuery<any[]>({
    queryKey: isCompany ? [`/api/company-roles/${subjectId}`] : [`/api/company-roles/person/${subjectId}`],
  });

  const assignRole = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/company-roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/company-roles/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/company-roles/person/${subjectId}`] });
      setShowAssignDialog(false);
      setPersonSubjectId("");
      setRoleType("zamestnanec");
      setRoleDescription("");
      setAllowedSections([]);
      toast({ title: "Rola priradená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: number) => {
      const res = await apiRequest("PATCH", `/api/company-roles/${roleId}`, { isActive: false });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/company-roles/${subjectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/company-roles/person/${subjectId}`] });
      toast({ title: "Rola odstránená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const roleTypeConfig: Record<string, { label: string; className: string }> = {
    statutar: { label: "Štatutár", className: "border-green-500/30 text-green-400 bg-green-500/10" },
    ubo: { label: "UBO", className: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
    zamestnanec: { label: "Zamestnanec", className: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
    operator: { label: "Operátor", className: "border-purple-500/30 text-purple-400 bg-purple-500/10" },
  };

  const toggleSection = (section: string) => {
    setAllowedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  return (
    <div className="mt-3 border border-indigo-500/20 rounded p-3 bg-indigo-500/5" data-testid="company-roles-section">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Firemné role</span>
        {companyRoles && companyRoles.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">{companyRoles.length} rolí</Badge>
        )}
        {isCompany && (
          <Button size="sm" variant="outline" className="text-[10px] ml-auto"
            onClick={() => setShowAssignDialog(true)} data-testid="btn-assign-company-role">
            <Plus className="w-3 h-3 mr-1" /> Priradiť rolu
          </Button>
        )}
      </div>

      {companyRoles && companyRoles.length > 0 ? (
        <div className="space-y-1">
          {companyRoles.map((r: any) => {
            const config = roleTypeConfig[r.roleType] || roleTypeConfig.zamestnanec;
            return (
              <div key={r.id} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 border border-border/50" data-testid={`company-role-${r.id}`}>
                {isCompany ? <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> : <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium truncate">{isCompany ? (r.personName || `Subjekt #${r.personSubjectId}`) : (r.companyName || `Firma #${r.companySubjectId}`)}</span>
                    <Badge variant="outline" className={`text-[9px] ${config.className}`}>{config.label}</Badge>
                    {r.allowedSections && r.allowedSections.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap">
                        {r.allowedSections.map((s: string) => (
                          <Badge key={s} variant="outline" className="text-[8px] border-border/50">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.description && <p className="text-[9px] text-muted-foreground mt-0.5">{r.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="p-0 text-destructive shrink-0"
                  onClick={() => removeRole.mutate(r.id)}
                  data-testid={`btn-remove-role-${r.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          {isCompany ? "Žiadne priradené firemné role" : "Subjekt nemá žiadne firemné role"}
        </p>
      )}

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-assign-company-role">
          <DialogHeader><DialogTitle>Priradiť firemnú rolu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ID subjektu osoby</Label>
              <Input className="text-xs mt-1" value={personSubjectId} onChange={e => setPersonSubjectId(e.target.value)}
                placeholder="Zadajte ID subjektu FO" data-testid="input-person-subject-id" />
            </div>
            <div>
              <Label className="text-xs">Typ roly</Label>
              <Select value={roleType} onValueChange={setRoleType}>
                <SelectTrigger className="text-xs mt-1" data-testid="select-role-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="statutar">Štatutár</SelectItem>
                  <SelectItem value="ubo">UBO</SelectItem>
                  <SelectItem value="zamestnanec">Zamestnanec</SelectItem>
                  <SelectItem value="operator">Operátor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Popis (voliteľné)</Label>
              <Input className="text-xs mt-1" value={roleDescription} onChange={e => setRoleDescription(e.target.value)}
                placeholder="Popis role" data-testid="input-role-description" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Povolené sekcie</Label>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_KEYS.map(section => (
                  <label key={section} className="flex items-center gap-1 text-[10px] cursor-pointer">
                    <Checkbox
                      checked={allowedSections.includes(section)}
                      onCheckedChange={() => toggleSection(section)}
                      data-testid={`checkbox-section-${section}`}
                    />
                    {section}
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" className="text-xs" disabled={!personSubjectId || assignRole.isPending}
              onClick={() => assignRole.mutate({
                companySubjectId: subjectId,
                personSubjectId: parseInt(personSubjectId),
                roleType,
                description: roleDescription || undefined,
                allowedSections: allowedSections.length > 0 ? allowedSections : undefined,
              })}
              data-testid="btn-confirm-assign-role">
              {assignRole.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Priradiť
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationBadge() {
  const { toast } = useToast();
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
  });

  const { data: notifications } = useQuery<any[]>({
    queryKey: ["/api/notifications/my"],
    enabled: showNotifications,
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await apiRequest("POST", `/api/notifications/${notificationId}/read`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/my"] });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const count = unreadCount?.count || 0;

  return (
    <>
      <Button variant="ghost" size="icon" className="relative"
        onClick={() => setShowNotifications(true)} data-testid="btn-notification-badge">
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1" data-testid="notification-count">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-md" data-testid="dialog-notifications">
          <DialogHeader><DialogTitle>Notifikácie</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {notifications && notifications.length > 0 ? (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 rounded px-2 py-1.5 border cursor-pointer transition-colors ${
                    n.isRead ? "border-border/50 bg-muted/20" : "border-blue-500/30 bg-blue-500/10"
                  }`}
                  onClick={() => { if (!n.isRead) markAsRead.mutate(n.id); }}
                  data-testid={`notification-${n.id}`}
                >
                  <Bell className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.isRead ? "text-muted-foreground" : "text-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.isRead ? "text-muted-foreground" : "font-medium"}`}>{n.title || n.message}</p>
                    {n.message && n.title && <p className="text-[10px] text-muted-foreground mt-0.5">{n.message}</p>}
                    <span className="text-[9px] text-muted-foreground">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("sk-SK") : "—"}
                    </span>
                  </div>
                  {!n.isRead && (
                    <Badge variant="outline" className="text-[8px] border-blue-500/30 text-blue-400 shrink-0">Nové</Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Žiadne notifikácie</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldHistorySection({ subjectId, history }: { subjectId: number; history: SubjectFieldHistory[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? history : history.slice(0, 20);

  return (
    <Card className="mb-4" data-testid="field-history-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">História zmien polí</span>
          <Badge variant="outline" className="text-[10px]">{history.length} záznamov</Badge>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadne zaznamenané zmeny</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Pole</TableHead>
                <TableHead className="text-xs">Stará hodnota</TableHead>
                <TableHead className="text-xs">Nová hodnota</TableHead>
                <TableHead className="text-xs">Dátum</TableHead>
                <TableHead className="text-xs">Dôvod</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map(h => (
                <TableRow key={h.id} data-testid={`history-row-${h.id}`}>
                  <TableCell className="text-xs py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{h.fieldKey}</span>
                      {h.fieldSource === "dynamic" && <Badge variant="outline" className="text-[8px]">dyn</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-red-400 max-w-[150px] truncate">{h.oldValue || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-green-400 max-w-[150px] truncate">{h.newValue || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{h.changedAt ? formatDateSlovak(String(h.changedAt)) : "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{h.changeReason || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {history.length > 20 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} data-testid="button-show-all-history">
            {showAll ? "Zobraziť menej" : `Zobraziť všetky (${history.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MarketingConsentsSection({
  subjectId,
  consents,
  companies,
  activeCompanyId,
  onToggle,
  isPending,
}: {
  subjectId: number;
  consents: ClientMarketingConsent[];
  companies: any[];
  activeCompanyId?: number;
  onToggle: (consentType: string, isGranted: boolean, companyId: number) => void;
  isPending: boolean;
}) {
  const currentCompany = companies?.find((c: any) => c.id === activeCompanyId);

  if (!activeCompanyId || !currentCompany) {
    return (
      <Card className="mb-4" data-testid="marketing-consents-no-company">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">Marketingové súhlasy - vyberte aktívnu firmu pre zobrazenie</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4" data-testid="marketing-consents-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Marketingové súhlasy</span>
          <Badge variant="outline" className="text-[10px]">{currentCompany.name}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Typ súhlasu</TableHead>
              <TableHead className="text-xs w-20 text-center">Stav</TableHead>
              <TableHead className="text-xs w-28">Dátum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONSENT_TYPES.map(ct => {
              const consent = consents.find(
                c => c.consentType === ct.code && c.companyId === activeCompanyId
              );
              const isGranted = consent?.isGranted ?? false;
              return (
                <TableRow key={ct.code} data-testid={`consent-row-${ct.code}`}>
                  <TableCell className="text-xs py-2">{ct.label}</TableCell>
                  <TableCell className="text-center py-2">
                    <Switch
                      checked={isGranted}
                      disabled={isPending}
                      onCheckedChange={(checked) => onToggle(ct.code, checked, activeCompanyId)}
                      data-testid={`consent-switch-${ct.code}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs py-2 text-muted-foreground">
                    {consent?.grantedAt
                      ? formatDateSlovak(String(consent.grantedAt))
                      : consent?.revokedAt
                        ? formatDateSlovak(String(consent.revokedAt))
                        : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
