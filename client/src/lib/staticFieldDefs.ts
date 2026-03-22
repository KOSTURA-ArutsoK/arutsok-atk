export interface StaticField {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  panelId: number | null;
  fieldKey: string;
  label: string;
  shortLabel?: string;
  fieldType: string;
  isRequired: boolean;
  isHidden: boolean;
  options: string[];
  defaultValue: string | null;
  visibilityRule: { dependsOn: string; value: string } | null;
  unit: string | null;
  decimalPlaces: number;
  fieldCategory: string;
  categoryCode?: string;
  sortOrder: number;
  rowNumber: number;
  widthPercent: number;
  photoRequired?: boolean;
}

export const PHOTO_REQUIRED_FIELD_KEYS = new Set([
  "spec_nazov", "spec_typ_aktiva", "spec_reg_cislo", "spec_pristav",
  "spec_autor", "spec_hodnota", "spec_typ_plavidla", "spec_typ_lietadla",
]);

export interface StaticSection {
  id: number;
  clientTypeId: number;
  name: string;
  folderCategory: string;
  sortOrder: number;
}

export interface StaticPanel {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  name: string;
  gridColumns: number;
  sortOrder: number;
}

const FO_SECTION_POVINNE = 9;
const FO_SECTION_DOPLNKOVE = 17;
const FO_SECTION_VOLITELNE = 10;
const FO_PANEL_OSOBNE = 4;
const FO_PANEL_ADRESA = 5;
const FO_PANEL_CUDZINEC = 3;
const FO_PANEL_KONTAKT = 6;
const FO_PANEL_DOKLADY = 20;

const FO_PANEL_RODINA = 22;
const FO_PANEL_DORUCOVACIA = 23;
const FO_PANEL_AML = 24;
const FO_PANEL_ZAKONNE = 25;
const FO_PANEL_ZMLUVNE = 26;
const FO_PANEL_MAJETKOVE = 27;

const FO_PANEL_EKON_ZAMESTNANIE = 40;
const FO_PANEL_EKON_PRIJMY = 41;
const FO_PANEL_EKON_AML = 42;

const FO_PANEL_VOZ_TP = 50;
const FO_PANEL_VOZ_PLATNOST = 51;
const FO_PANEL_VOZ_DOPLNKY = 52;

const FO_PANEL_REAL_ZAKLAD = 60;
const FO_PANEL_REAL_TECH = 61;
const FO_PANEL_REAL_ZABEZP = 62;

const FO_PANEL_ZDRAVOTNY = 70;
const FO_PANEL_INVESTICNY = 71;
const FO_PANEL_SPEC_AKTIVA = 90;
const FO_PANEL_SPEC_RIZIKA = 92;
const FO_PANEL_EVENTY = 99;

const SZCO_SECTION_POVINNE = 11;
const SZCO_SECTION_DOPLNKOVE = 18;
const SZCO_SECTION_VOLITELNE = 12;
const SZCO_PANEL_SUBJEKT = 7;
const SZCO_PANEL_SIDLO = 8;
const SZCO_PANEL_OSOBNE = 9;
const SZCO_PANEL_ADRESA = 10;
const SZCO_PANEL_KONTAKT = 11;
const SZCO_PANEL_DOKLADY = 21;

const SZCO_PANEL_AML = 30;
const SZCO_PANEL_FIREMNY = 31;
const SZCO_PANEL_ZAKONNE = 34;
const SZCO_PANEL_ZMLUVNE = 35;
const SZCO_PANEL_SPEC_AKTIVA = 93;
const SZCO_PANEL_FIREMNE_PORTF = 94;
const SZCO_PANEL_SPEC_RIZIKA = 95;
const SZCO_PANEL_EVENTY = 100;

const PO_SECTION_POVINNE = 15;
const PO_SECTION_DOPLNKOVE = 19;
const PO_SECTION_VOLITELNE = 16;
const PO_PANEL_SUBJEKT = 13;
const PO_PANEL_SIDLO = 14;
const PO_PANEL_KONTAKT = 15;
const PO_PANEL_AML = 32;
const PO_PANEL_FIREMNY = 33;
const PO_PANEL_ZAKONNE = 36;
const PO_PANEL_ZMLUVNE = 37;
const PO_PANEL_STATUTARI = 38;
const PO_PANEL_SPEC_AKTIVA = 96;
const PO_PANEL_FIREMNE_PORTF = 97;
const PO_PANEL_SPEC_RIZIKA = 98;
const PO_PANEL_EVENTY = 101;
const PO_PANEL_SPEC_SUBJEKT = 102;

const FO_SECTION_INE = 80;
const SZCO_SECTION_INE = 81;
const PO_SECTION_INE = 82;

export const FO_SECTIONS: StaticSection[] = [
  { id: FO_SECTION_POVINNE, clientTypeId: 1, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: FO_SECTION_DOPLNKOVE, clientTypeId: 1, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: FO_SECTION_VOLITELNE, clientTypeId: 1, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
  { id: FO_SECTION_INE, clientTypeId: 1, name: "INÉ ÚDAJE", folderCategory: "ine", sortOrder: 3 },
];

export const FO_PANELS: StaticPanel[] = [
  { id: FO_PANEL_OSOBNE, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Osobné údaje", gridColumns: 5, sortOrder: 0 },
  { id: FO_PANEL_ADRESA, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Adresa", gridColumns: 4, sortOrder: 1 },
  { id: FO_PANEL_CUDZINEC, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Cudzinec bez rodného čísla", gridColumns: 1, sortOrder: 2 },
  { id: FO_PANEL_DOKLADY, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Doklady", gridColumns: 4, sortOrder: 3 },
  { id: FO_PANEL_KONTAKT, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 4 },
  { id: FO_PANEL_RODINA, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Rodinný kontakt a zastihnutie", gridColumns: 2, sortOrder: 0 },
  { id: FO_PANEL_DORUCOVACIA, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Doručovacia adresa", gridColumns: 4, sortOrder: 1 },
  { id: FO_PANEL_AML, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "AML – PEP a KUV", gridColumns: 3, sortOrder: 2 },
  { id: FO_PANEL_ZAKONNE, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Zákonné údaje", gridColumns: 2, sortOrder: 3 },
  { id: FO_PANEL_ZMLUVNE, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Bankové údaje", gridColumns: 3, sortOrder: 4 },
  { id: FO_PANEL_MAJETKOVE, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Majetkové údaje", gridColumns: 2, sortOrder: 5 },
  { id: FO_PANEL_EKON_ZAMESTNANIE, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Zamestnanie", gridColumns: 4, sortOrder: 6 },
  { id: FO_PANEL_EKON_PRIJMY, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Príjmy a financie", gridColumns: 4, sortOrder: 7 },
  { id: FO_PANEL_EKON_AML, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Legislatívny status (AML)", gridColumns: 2, sortOrder: 8 },
  { id: FO_PANEL_VOZ_TP, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Technický preukaz", gridColumns: 3, sortOrder: 9 },
  { id: FO_PANEL_VOZ_PLATNOST, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Platnosť a stav", gridColumns: 3, sortOrder: 10 },
  { id: FO_PANEL_VOZ_DOPLNKY, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Doplnkové údaje vozidla", gridColumns: 2, sortOrder: 11 },
  { id: FO_PANEL_REAL_ZAKLAD, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Základná identifikácia nehnuteľnosti", gridColumns: 3, sortOrder: 12 },
  { id: FO_PANEL_REAL_TECH, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Technický stav", gridColumns: 4, sortOrder: 13 },
  { id: FO_PANEL_REAL_ZABEZP, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Zabezpečenie", gridColumns: 3, sortOrder: 14 },
  { id: FO_PANEL_ZDRAVOTNY, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Zdravotný profil", gridColumns: 3, sortOrder: 15 },
  { id: FO_PANEL_INVESTICNY, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, name: "Investičný profil", gridColumns: 3, sortOrder: 16 },
  { id: FO_PANEL_SPEC_AKTIVA, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, name: "⛵ Špeciálne aktíva", gridColumns: 3, sortOrder: 0 },
  { id: FO_PANEL_SPEC_RIZIKA, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, name: "💎 Špecifické riziká", gridColumns: 3, sortOrder: 1 },
  { id: FO_PANEL_EVENTY, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, name: "🎭 Poistenie podujatí", gridColumns: 3, sortOrder: 2 },
];

export const FO_FIELDS: StaticField[] = [
  // === PANEL: Osobné údaje === BLOK 1: Identita ===
  // Riadok 1: Titul pred | Meno* | Priezvisko* | Titul za
  { id: 9, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "titul_pred", label: "Titul pred menom", shortLabel: "Titul pred", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 1, widthPercent: 12 },
  { id: 109, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 1, widthPercent: 33 },
  { id: 11, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 43 },
  { id: 12, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "titul_za", label: "Titul za menom", shortLabel: "Titul za", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 12 },
  // Riadok 2: Rodné priezvisko | Rodné číslo* | Dátum narodenia*
  { id: 22, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "rodne_priezvisko", label: "Rodné priezvisko", shortLabel: "Rod. priez.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 13, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "rodne_cislo", label: "Rodné číslo", shortLabel: "Rod. číslo", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 2, widthPercent: 25 },
  { id: 14, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "datum_narodenia", label: "Dátum narodenia", shortLabel: "Dát. nar.", fieldType: "date", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 70, rowNumber: 2, widthPercent: 25 },
  // Riadok 3: Vek | Pohlavie (vedľa seba)
  { id: 15, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 80, rowNumber: 3, widthPercent: 15 },
  { id: 21, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "pohlavie", label: "Pohlavie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["muž", "žena"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 90, rowNumber: 3, widthPercent: 20 },
  // Riadok 4: Miesto narodenia | Štátna príslušnosť (BLOK 3 - ostatné, za adresou vizuálne ale v tom istom paneli)
  { id: 20, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "miesto_narodenia", label: "Miesto narodenia", shortLabel: "Miesto nar.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 4, widthPercent: 50 },
  { id: 16, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", shortLabel: "Št. príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 4, widthPercent: 50 },

  // === PANEL: Adresa === BLOK 2: Trvalá adresa ===
  // Riadok 0: Ulica
  { id: 23, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", shortLabel: "Ulica", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  // Riadok 0: Súpisné č. | Orientačné č. (vedľa seba)
  { id: 24, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 25, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  // Riadok 1: Mesto | PSČ (vedľa seba)
  { id: 26, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 27, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  // Riadok 1: Štát
  { id: 28, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  // === Prechodná adresa (switch + polia) ===
  { id: 29, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "korespond_rovnaka", label: "Adresa prech. pobytu sa zhoduje s trvalou", shortLabel: "Prech. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 2, widthPercent: 100 },
  { id: 30, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_ulica", label: "Ulica (prechodný pobyt)", shortLabel: "Ulica (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 40 },
  { id: 31, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_supisne", label: "Súpisné číslo (prechodný)", shortLabel: "Súp. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 120, rowNumber: 3, widthPercent: 30 },
  { id: 32, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_orientacne", label: "Orientačné číslo (prechodný)", shortLabel: "Or. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 130, rowNumber: 3, widthPercent: 30 },
  { id: 33, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_mesto", label: "Mesto (prechodný)", shortLabel: "Mesto (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 140, rowNumber: 4, widthPercent: 50 },
  { id: 34, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_psc", label: "PSČ (prechodný)", shortLabel: "PSČ (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 150, rowNumber: 4, widthPercent: 25 },
  { id: 35, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_stat", label: "Štát (prechodný)", shortLabel: "Štát (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 160, rowNumber: 4, widthPercent: 25 },
  // === Kontaktná adresa (switch + polia) ===
  { id: 36, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "kontaktna_rovnaka", label: "Kontaktná adresa sa zhoduje s trvalou", shortLabel: "Kontakt. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 200, rowNumber: 5, widthPercent: 100 },
  { id: 37, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_ulica", label: "Ulica (kontaktná)", shortLabel: "Ulica (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 210, rowNumber: 6, widthPercent: 40 },
  { id: 38, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_supisne", label: "Súpisné číslo (kontaktná)", shortLabel: "Súp. č. (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 220, rowNumber: 6, widthPercent: 30 },
  { id: 39, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_orientacne", label: "Orientačné číslo (kontaktná)", shortLabel: "Or. č. (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 230, rowNumber: 6, widthPercent: 30 },
  { id: 40, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_mesto", label: "Mesto (kontaktná)", shortLabel: "Mesto (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 240, rowNumber: 7, widthPercent: 50 },
  { id: 41, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_psc", label: "PSČ (kontaktná)", shortLabel: "PSČ (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 250, rowNumber: 7, widthPercent: 25 },
  { id: 42, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_stat", label: "Štát (kontaktná)", shortLabel: "Štát (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 260, rowNumber: 7, widthPercent: 25 },

  // === PANEL: Doklady === Typ → Špecifikácia → Číslo → Platnosť → Vydal → Kód orgánu
  { id: 17, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", shortLabel: "Typ dokladu", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 20 },
  { id: 120, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "typ_dokladu_iny", label: "Špecifikácia dokladu", shortLabel: "Špecifikácia", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 20 },
  { id: 18, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", shortLabel: "Č. dokladu", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 19, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", shortLabel: "Platnosť do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 20 },
  { id: 112, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "vydal_organ", label: "Vydal (orgán)", shortLabel: "Vydal", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 0, widthPercent: 30 },
  { id: 110, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_DOKLADY, fieldKey: "kod_vydavajuceho_organu", label: "Kód vydávajúceho orgánu", shortLabel: "Kód orgánu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Kontaktné údaje === Telefón → Email
  { id: 43, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_KONTAKT, fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 44, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === DOPLNKOVÉ: Rodina === Meno → Telefón → Vzťah → Zastihnutie
  { id: 200, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_RODINA, fieldKey: "rodinny_kontakt_meno", label: "Meno rodinného kontaktu", shortLabel: "Rod. kontakt", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 201, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_RODINA, fieldKey: "rodinny_kontakt_telefon", label: "Telefón rodinného kontaktu", shortLabel: "Rod. telefón", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 202, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_RODINA, fieldKey: "rodinny_kontakt_vztah", label: "Vzťah", shortLabel: "Vzťah", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Manžel/ka", "Partner/ka", "Rodič", "Dieťa", "Súrodenec", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 203, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_RODINA, fieldKey: "zastihnutie", label: "Najlepšie zastihnutie", shortLabel: "Zastihnutie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Ráno (8-12)", "Poobede (12-17)", "Večer (17-21)", "Kedykoľvek"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },

  // === DOPLNKOVÉ: Doručovacia adresa === Switch → Ulica → Súp+Or → Mesto+PSČ → Štát
  { id: 204, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_DORUCOVACIA, fieldKey: "doruc_rovnaka", label: "Doručovacia adresa sa zhoduje s trvalou", shortLabel: "Doruč. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 205, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_DORUCOVACIA, fieldKey: "doruc_ulica", label: "Ulica (doručovacia)", shortLabel: "Ulica (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 20, rowNumber: 1, widthPercent: 100 },
  { id: 206, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_DORUCOVACIA, fieldKey: "doruc_mesto", label: "Mesto (doručovacia)", shortLabel: "Mesto (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 30, rowNumber: 2, widthPercent: 50 },
  { id: 207, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_DORUCOVACIA, fieldKey: "doruc_psc", label: "PSČ (doručovacia)", shortLabel: "PSČ (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 40, rowNumber: 2, widthPercent: 25 },
  { id: 208, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_DORUCOVACIA, fieldKey: "doruc_stat", label: "Štát (doručovacia)", shortLabel: "Štát (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 50, rowNumber: 2, widthPercent: 25 },

  // === DOPLNKOVÉ: AML === PEP → PEP funkcia → PEP vzťah → KUV 1,2,3 (Meno → RČ → %)
  { id: 500, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "pep", label: "Politicky exponovaná osoba (PEP)", shortLabel: "PEP", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: "Nie", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 501, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "pep_funkcia", label: "PEP – verejná funkcia", shortLabel: "PEP funkcia", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "pep", value: "Áno" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 502, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "pep_vztah", label: "PEP – vzťah k PEP osobe", shortLabel: "PEP vzťah", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "pep", value: "Áno" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 503, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 504, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 505, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_AML, fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },

  // === DOPLNKOVÉ: Zákonné === DIČ + IČ DPH (vedľa seba) → GDPR + Marketing → Tretie strany + Profilovanie → Poistná + Overenie
  { id: 510, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 511, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 512, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 513, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 514, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "suhlas_tretie_strany", label: "Súhlas s poskytnutím údajov tretím stranám", shortLabel: "Tretie strany", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 515, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "suhlas_profilovanie", label: "Súhlas s automatizovaným profilovaním", shortLabel: "Profilovanie", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 516, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "poistna_povinnost", label: "Poistná povinnosť splnená", shortLabel: "Poistná pov.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 70, rowNumber: 3, widthPercent: 50 },
  { id: 517, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZAKONNE, fieldKey: "overenie_totoznosti", label: "Overenie totožnosti vykonané", shortLabel: "Overenie totoži.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 80, rowNumber: 3, widthPercent: 50 },

  // === DOPLNKOVÉ: Bankové === IBAN → BIC → Číslo účtu
  { id: 520, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZMLUVNE, fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 521, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZMLUVNE, fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 522, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZMLUVNE, fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },

  // === DOPLNKOVÉ: Majetkové === ŠPZ | VIN (vedľa seba)
  { id: 530, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_MAJETKOVE, fieldKey: "spz", label: "ŠPZ / EČV", shortLabel: "ŠPZ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "majetkove", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 531, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_MAJETKOVE, fieldKey: "vin", label: "VIN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "majetkove", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === EKONOMIKA: Zamestnanie === Pracovný pomer → Zamestnávateľ → Pozícia → Dátum nástupu
  { id: 600, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_ZAMESTNANIE, fieldKey: "ekon_pracovny_pomer", label: "Pracovný pomer", shortLabel: "Prac. pomer", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Zamestnanec", "Podnikateľ - SZČO", "Konateľ SRO", "Študent", "Dôchodca", "Nezamestnaný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 10, rowNumber: 0, widthPercent: 25 },
  { id: 601, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_ZAMESTNANIE, fieldKey: "ekon_zamestnavatel", label: "Zamestnávateľ / Názov firmy", shortLabel: "Zamestnávateľ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 20, rowNumber: 0, widthPercent: 25 },
  { id: 602, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_ZAMESTNANIE, fieldKey: "ekon_pozicia", label: "Pracovná pozícia", shortLabel: "Pozícia", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 30, rowNumber: 0, widthPercent: 25 },
  { id: 603, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_ZAMESTNANIE, fieldKey: "ekon_datum_nastupu", label: "Dátum nástupu", shortLabel: "Dát. nástupu", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 40, rowNumber: 0, widthPercent: 25 },

  // === EKONOMIKA: Príjmy a financie === Čistý mes. príjem → Zdroj príjmu → Hlavný IBAN → Banka
  { id: 610, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_PRIJMY, fieldKey: "ekon_cisty_prijem", label: "Čistý mesačný príjem", shortLabel: "Čistý príjem", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 50, rowNumber: 0, widthPercent: 25 },
  { id: 611, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_PRIJMY, fieldKey: "ekon_zdroj_prijmu", label: "Zdroj príjmu", shortLabel: "Zdroj príjmu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 60, rowNumber: 0, widthPercent: 25 },
  { id: 612, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_PRIJMY, fieldKey: "ekon_hlavny_iban", label: "Hlavný IBAN", shortLabel: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 70, rowNumber: 0, widthPercent: 25 },
  { id: 613, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_PRIJMY, fieldKey: "ekon_banka", label: "Banka", shortLabel: "Banka", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 80, rowNumber: 0, widthPercent: 25 },

  // === EKONOMIKA: Legislatívny status (AML) === PEO Áno/Nie → PEO zdôvodnenie → Konečný užívateľ výhod
  { id: 620, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_AML, fieldKey: "ekon_peo", label: "PEO (Politicky exponovaná osoba)", shortLabel: "PEO", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: "Nie", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 90, rowNumber: 0, widthPercent: 50 },
  { id: 621, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_AML, fieldKey: "ekon_peo_zdovodnenie", label: "PEO – Zdôvodnenie", shortLabel: "PEO zdôvodnenie", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "ekon_peo", value: "Áno" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 100, rowNumber: 0, widthPercent: 50 },
  { id: 622, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_EKON_AML, fieldKey: "ekon_kuv", label: "Konečný užívateľ výhod", shortLabel: "KUV", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "ekonomika", sortOrder: 110, rowNumber: 1, widthPercent: 100 },

  // === VOZIDLÁ: Technický preukaz === EČV → VIN → Číslo TP → Značka → Model → Výkon → Objem → Hmotnosť → Palivo
  { id: 800, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_ecv", label: "Evidenčné číslo vozidla (EČV)", shortLabel: "EČV", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 801, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_vin", label: "VIN (identifikačné číslo vozidla)", shortLabel: "VIN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 802, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_cislo_tp", label: "Číslo technického preukazu", shortLabel: "Číslo TP", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 803, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_znacka", label: "Značka vozidla", shortLabel: "Značka", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 804, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_model", label: "Model vozidla", shortLabel: "Model", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 50, rowNumber: 1, widthPercent: 34 },
  { id: 805, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_vykon", label: "Výkon motora", shortLabel: "Výkon", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "kW", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
  { id: 806, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_objem", label: "Objem motora", shortLabel: "Objem", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "cm³", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 70, rowNumber: 2, widthPercent: 33 },
  { id: 807, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_hmotnost", label: "Celková hmotnosť", shortLabel: "Hmotnosť", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "kg", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 80, rowNumber: 2, widthPercent: 34 },
  { id: 808, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_TP, fieldKey: "voz_palivo", label: "Druh paliva", shortLabel: "Palivo", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Benzín", "Nafta", "LPG", "CNG", "Elektro", "Hybrid benzín", "Hybrid nafta"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 90, rowNumber: 2, widthPercent: 33 },

  // === VOZIDLÁ: Platnosť a stav === STK platnosť (semafor) → EK platnosť (semafor)
  { id: 810, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_PLATNOST, fieldKey: "voz_stk_platnost", label: "Platnosť STK do", shortLabel: "STK do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 100, rowNumber: 0, widthPercent: 50 },
  { id: 811, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_PLATNOST, fieldKey: "voz_ek_platnost", label: "Platnosť emisnej kontroly do", shortLabel: "EK do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 110, rowNumber: 0, widthPercent: 50 },

  // === VOZIDLÁ: Doplnkové === Tachometer → Zabezpečenie
  { id: 820, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_DOPLNKY, fieldKey: "voz_tachometer", label: "Stav tachometra", shortLabel: "Tachometer", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "km", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 120, rowNumber: 0, widthPercent: 50 },
  { id: 821, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_VOZ_DOPLNKY, fieldKey: "voz_zabezpecenie", label: "Zabezpečenie vozidla", shortLabel: "Zabezpečenie", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "vozidla", sortOrder: 130, rowNumber: 0, widthPercent: 50 },

  // === DOPLNKOVÉ: REALITY – Základná identifikácia === Typ | Súpisné | Parcelné → Kataster | LV
  { id: 830, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZAKLAD, fieldKey: "real_typ_nehnutelnosti", label: "Typ nehnuteľnosti", shortLabel: "Typ nehnut.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Byt", "Rodinný dom", "Chata", "Garáž", "Hala", "Polyfunkcia"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 831, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZAKLAD, fieldKey: "real_supisne_cislo", label: "Súpisné číslo", shortLabel: "Súp. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 20, rowNumber: 0, widthPercent: 25 },
  { id: 832, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZAKLAD, fieldKey: "real_parcelne_cislo", label: "Parcelné číslo", shortLabel: "Parc. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 30, rowNumber: 0, widthPercent: 25 },
  { id: 833, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZAKLAD, fieldKey: "real_katastralne_uzemie", label: "Katastrálne územie", shortLabel: "Kat. územie", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 834, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZAKLAD, fieldKey: "real_cislo_lv", label: "Číslo listu vlastníctva", shortLabel: "Číslo LV", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 50, rowNumber: 1, widthPercent: 50 },

  // === DOPLNKOVÉ: REALITY – Technický stav === Rok kolaud. | Rekon. strecha | Rekon. rozvody | Rekon. kúrenie → Rozloha | Podlažia | Konštrukcia
  { id: 835, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_rok_kolaudacie", label: "Rok kolaudácie", shortLabel: "Rok kolaud.", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 60, rowNumber: 0, widthPercent: 25 },
  { id: 836, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_rekon_strecha", label: "Posledná rekonštrukcia – strecha", shortLabel: "Rekon. strecha", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 70, rowNumber: 0, widthPercent: 25 },
  { id: 837, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_rekon_rozvody", label: "Posledná rekonštrukcia – rozvody", shortLabel: "Rekon. rozvody", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 80, rowNumber: 0, widthPercent: 25 },
  { id: 838, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_rekon_kurenie", label: "Posledná rekonštrukcia – kúrenie", shortLabel: "Rekon. kúrenie", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 90, rowNumber: 0, widthPercent: 25 },
  { id: 839, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_rozloha", label: "Rozloha obytnej plochy", shortLabel: "Rozloha", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "m²", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 100, rowNumber: 1, widthPercent: 33 },
  { id: 840, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_pocet_podlazi", label: "Počet podlaží", shortLabel: "Podlažia", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 110, rowNumber: 1, widthPercent: 33 },
  { id: 841, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_TECH, fieldKey: "real_typ_konstrukcie", label: "Typ konštrukcie", shortLabel: "Konštrukcia", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Murovaná", "Drevená", "Montovaná"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 120, rowNumber: 1, widthPercent: 34 },

  // === DOPLNKOVÉ: REALITY – Zabezpečenie === Typ dverí | El. zabezpečenie → Protipož. ochrana
  { id: 842, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZABEZP, fieldKey: "real_typ_dveri", label: "Typ dverí (bezpečnostná trieda)", shortLabel: "Typ dverí", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 130, rowNumber: 0, widthPercent: 50 },
  { id: 843, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZABEZP, fieldKey: "real_elektro_zabezpecenie", label: "Elektronické zabezpečenie", shortLabel: "El. zabezpeč.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Alarm na PCO", "Lokálny alarm", "Kamery"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 140, rowNumber: 0, widthPercent: 50 },
  { id: 844, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_REAL_ZABEZP, fieldKey: "real_protipoz_ochrana", label: "Protipožiarna ochrana", shortLabel: "Protipož.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "reality", sortOrder: 150, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Zdravotný profil ===
  { id: 850, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZDRAVOTNY, fieldKey: "zdrav_vyska", label: "Výška", shortLabel: "Výška", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "cm", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "zdravotny", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 851, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZDRAVOTNY, fieldKey: "zdrav_vaha", label: "Váha", shortLabel: "Váha", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "kg", decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "zdravotny", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 852, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZDRAVOTNY, fieldKey: "zdrav_fajciar", label: "Fajčiar", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie", "Bývalý"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zdravotny", sortOrder: 30, rowNumber: 0, widthPercent: 34 },
  { id: 853, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZDRAVOTNY, fieldKey: "zdrav_rizikovy_sport", label: "Riziková športová činnosť", shortLabel: "Riz. šport", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zdravotny", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 854, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_ZDRAVOTNY, fieldKey: "zdrav_diagnozy", label: "Závažné diagnózy v minulosti", shortLabel: "Diagnózy", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zdravotny", sortOrder: 50, rowNumber: 2, widthPercent: 100 },

  // === PANEL: Investičný profil ===
  { id: 860, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_INVESTICNY, fieldKey: "inv_typ_investora", label: "Typ investora", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Konzervatívny", "Vyvážený", "Dynamický"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "investicny", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 861, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_INVESTICNY, fieldKey: "inv_datum_dotaznika", label: "Dátum vyplnenia investičného dotazníka", shortLabel: "Dát. dotazníka", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "investicny", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 862, clientTypeId: 1, sectionId: FO_SECTION_DOPLNKOVE, panelId: FO_PANEL_INVESTICNY, fieldKey: "inv_skusenosti", label: "Skúsenosti s investovaním", shortLabel: "Skúsenosti", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Žiadne", "Základné", "Pokročilé"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "investicny", sortOrder: 30, rowNumber: 0, widthPercent: 33 },

  // === VOLITEĽNÉ === CGN Rating
  { id: 209, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: null, fieldKey: "cgn_rating", label: "CGN Rating", shortLabel: "CGN", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["A", "B", "C", "D", "E"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", categoryCode: "bonita", sortOrder: 10, rowNumber: 0, widthPercent: 100 },

  // === INÉ ÚDAJE ===
  { id: 900, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "poznamka_interna", label: "Interná poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 901, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "tagy", label: "Značky / Tagy", shortLabel: "Tagy", fieldType: "text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 20, rowNumber: 1, widthPercent: 50 },
  { id: 902, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "zdroj_klienta", label: "Zdroj klienta", shortLabel: "Zdroj", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Odporúčanie", "Web", "Sociálne siete", "Osobný kontakt", "Reklama", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 903, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "datum_prvej_schodzky", label: "Dátum prvej schôdzky", shortLabel: "1. schôdzka", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 40, rowNumber: 2, widthPercent: 33 },
  { id: 904, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "preferovany_kontakt", label: "Preferovaný spôsob kontaktu", shortLabel: "Pref. kontakt", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Telefón", "Email", "SMS", "Osobne", "WhatsApp"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 50, rowNumber: 2, widthPercent: 33 },
  { id: 905, clientTypeId: 1, sectionId: FO_SECTION_INE, panelId: null, fieldKey: "jazyk_komunikacie", label: "Jazyk komunikácie", shortLabel: "Jazyk", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Slovenčina", "Čeština", "Angličtina", "Maďarčina", "Nemčina", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 60, rowNumber: 2, widthPercent: 34 },

  // === VOLITEĽNÉ: Špeciálne aktíva (⛵ Lode, Lietadlá, Umenie) ===
  { id: 1900, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_aktiva", label: "Typ aktíva", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Plavidlo / Loď", "Lietadlo / Dron", "Umelecké dielo", "Drahé kovy", "Zbierka / Kolekcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 1901, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_nazov", label: "Názov / Označenie", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 1902, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_reg_cislo", label: "Registračné číslo", shortLabel: "Reg. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 1903, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_plavidla", label: "Typ plavidla", shortLabel: "Typ plav.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Motorová jachta", "Plachetnica", "Katamaran", "Motorový čln", "Hausbót", "Iné"], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 1904, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_pristav", label: "Prístav kotvenia", shortLabel: "Prístav", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 34 },
  { id: 1905, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_vytlak", label: "Výtlak (BRT)", shortLabel: "Výtlak", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: "BRT", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
  { id: 1906, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_motor_parametre", label: "Parametre motora", shortLabel: "Motor", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 50 },
  { id: 1907, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_lietadla", label: "Typ lietadla / dronu", shortLabel: "Typ liet.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Jednomotorové", "Viacmotorové", "Vrtuľník", "Dron (komerčný)", "Dron (hobby)", "Iné"], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Lietadlo / Dron" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 80, rowNumber: 1, widthPercent: 50 },
  { id: 1908, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_autor", label: "Autor / Pôvod", shortLabel: "Autor", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Umelecké dielo" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 90, rowNumber: 1, widthPercent: 50 },
  { id: 1909, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_hodnota", label: "Odhadovaná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 2, widthPercent: 50 },
  { id: 1910, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_poistna_zmluva", label: "Číslo poistnej zmluvy", shortLabel: "Č. poistky", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 110, rowNumber: 3, widthPercent: 50 },
  { id: 1911, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_AKTIVA, fieldKey: "spec_poznamka", label: "Poznámka k aktívu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 120, rowNumber: 3, widthPercent: 50 },

  // === VOLITEĽNÉ: Špecifické riziká (💎 Kybernetické, Drahé kovy) ===
  { id: 1920, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_typ", label: "Typ rizika", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Kybernetické riziko", "Poistenie drahých kovov", "Environmentálne riziko", "Profesná zodpovednosť", "Poistenie zbierok", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 1921, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_popis", label: "Popis rizika", shortLabel: "Popis", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 67 },
  { id: 1922, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 1, widthPercent: 33 },
  { id: 1923, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistovatel", label: "Poisťovateľ", shortLabel: "Poisťovateľ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 34 },
  { id: 1924, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_cislo_zmluvy", label: "Číslo zmluvy", shortLabel: "Č. zmluvy", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 1925, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poznamka", label: "Poznámka k riziku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 2, widthPercent: 100 },

  // === VOLITEĽNÉ: Poistenie podujatí (🎭 Vernisáže, Koncerty) ===
  { id: 2000, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_nazov", label: "Názov podujatia", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 34 },
  { id: 2001, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_typ", label: "Typ podujatia", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Vernisáž", "Koncert / Turné", "Festival", "Konferencia", "Výstava", "Športové podujatie", "Súkromná akcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 2002, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_miesto", label: "Miesto konania", shortLabel: "Miesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 2003, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_datum_od", label: "Dátum začiatku", shortLabel: "Od", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 2004, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_datum_do", label: "Dátum ukončenia", shortLabel: "Do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 2005, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_status", label: "Status podujatia", shortLabel: "Status", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Príprava", "Aktívne", "Prebieha", "Ukončené", "Archív"], defaultValue: "Príprava", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 34 },
  { id: 2006, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_zodpovednost", label: "Zodpovednosť za návštevníkov", shortLabel: "Zodpovednosť", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno – poistenie zodpovednosti", "Nie", "Čiastočne"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 33 },
  { id: 2007, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_poistenie_storna", label: "Poistenie storna", shortLabel: "Storno poist.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 80, rowNumber: 2, widthPercent: 34 },
  { id: 2008, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 90, rowNumber: 2, widthPercent: 33 },
  { id: 2009, clientTypeId: 1, sectionId: FO_SECTION_VOLITELNE, panelId: FO_PANEL_EVENTY, fieldKey: "event_poznamka", label: "Poznámka k podujatiu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 3, widthPercent: 100 },
];

export const SZCO_SECTIONS: StaticSection[] = [
  { id: SZCO_SECTION_POVINNE, clientTypeId: 3, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: SZCO_SECTION_DOPLNKOVE, clientTypeId: 3, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: SZCO_SECTION_VOLITELNE, clientTypeId: 3, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
  { id: SZCO_SECTION_INE, clientTypeId: 3, name: "INÉ ÚDAJE", folderCategory: "ine", sortOrder: 3 },
];

export const SZCO_PANELS: StaticPanel[] = [
  { id: SZCO_PANEL_SUBJEKT, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Subjekt SZČO", gridColumns: 3, sortOrder: 0 },
  { id: SZCO_PANEL_SIDLO, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Sídlo spoločnosti", gridColumns: 4, sortOrder: 1 },
  { id: SZCO_PANEL_OSOBNE, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Osobné údaje", gridColumns: 4, sortOrder: 2 },
  { id: SZCO_PANEL_ADRESA, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Adresa trvalého pobytu", gridColumns: 4, sortOrder: 3 },
  { id: SZCO_PANEL_DOKLADY, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Doklady", gridColumns: 4, sortOrder: 4 },
  { id: SZCO_PANEL_KONTAKT, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 5 },
  { id: SZCO_PANEL_AML, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, name: "AML – Konečný užívateľ výhod", gridColumns: 3, sortOrder: 2 },
  { id: SZCO_PANEL_FIREMNY, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, name: "Firemný profil", gridColumns: 3, sortOrder: 3 },
  { id: SZCO_PANEL_ZAKONNE, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, name: "Zákonné údaje", gridColumns: 2, sortOrder: 0 },
  { id: SZCO_PANEL_ZMLUVNE, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, name: "Bankové údaje", gridColumns: 3, sortOrder: 1 },
  { id: SZCO_PANEL_SPEC_AKTIVA, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, name: "⛵ Špeciálne aktíva", gridColumns: 3, sortOrder: 0 },
  { id: SZCO_PANEL_FIREMNE_PORTF, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, name: "🏗️ Firemné portfólio", gridColumns: 3, sortOrder: 1 },
  { id: SZCO_PANEL_SPEC_RIZIKA, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, name: "💎 Špecifické riziká", gridColumns: 3, sortOrder: 2 },
  { id: SZCO_PANEL_EVENTY, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, name: "🎭 Poistenie podujatí", gridColumns: 3, sortOrder: 3 },
];

export const SZCO_FIELDS: StaticField[] = [
  // === PANEL: Subjekt SZČO === Názov → IČO → SK NACE
  { id: 45, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov organizácie", shortLabel: "Názov org.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 46, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 47, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "sk_nace", label: "SK NACE", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", categoryCode: "firemny_profil", sortOrder: 30, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Sídlo === Ulica → Súp+Or (vedľa) → Mesto+PSČ (vedľa) → Štát → Switch výkon + adresa výkonu
  { id: 48, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 49, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 50, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 51, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 52, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 53, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  { id: 54, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_rovnaky", label: "Adresa výkonu činnosti sa zhoduje so sídlom", shortLabel: "Výkon = sídlo", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 2, widthPercent: 100 },
  { id: 55, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_ulica", label: "Ulica (výkon činnosti)", shortLabel: "Ulica (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 40 },
  { id: 56, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_supisne", label: "Súpisné číslo (výkon)", shortLabel: "Súp. č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 120, rowNumber: 3, widthPercent: 30 },
  { id: 57, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_orientacne", label: "Orientačné číslo (výkon)", shortLabel: "Or. č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 130, rowNumber: 3, widthPercent: 30 },
  { id: 58, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_mesto", label: "Mesto/Obec (výkon)", shortLabel: "Mesto (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 140, rowNumber: 4, widthPercent: 50 },
  { id: 59, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_psc", label: "PSČ (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 150, rowNumber: 4, widthPercent: 25 },
  { id: 60, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_stat", label: "Štát (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 160, rowNumber: 4, widthPercent: 25 },

  // === PANEL: Osobné údaje === Titul pred | Meno | Priezvisko | Titul za → RČ → Dát. nar. → Vek → Št. príslušnosť
  { id: 61, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "titul_pred", label: "Titul pred menom", shortLabel: "Titul pred", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 12 },
  { id: 62, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 63, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 43 },
  { id: 64, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "titul_za", label: "Titul za menom", shortLabel: "Titul za", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 12 },
  { id: 65, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "rodne_cislo", label: "Rodné číslo", shortLabel: "Rod. číslo", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 66, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "datum_narodenia", label: "Dátum narodenia", shortLabel: "Dát. narodenia", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
  { id: 67, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 70, rowNumber: 1, widthPercent: 15 },
  { id: 68, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", shortLabel: "Št. príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 80, rowNumber: 2, widthPercent: 100 },
  // === PANEL: Doklady === Typ → Špecifikácia → Číslo → Platnosť → Vydal → Kód orgánu
  { id: 69, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", shortLabel: "Typ dokladu", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 20 },
  { id: 121, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "typ_dokladu_iny", label: "Špecifikácia dokladu", shortLabel: "Špecifikácia", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 20 },
  { id: 70, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", shortLabel: "Č. dokladu", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 71, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", shortLabel: "Platnosť do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 20 },
  { id: 113, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "vydal_organ", label: "Vydal (orgán)", shortLabel: "Vydal", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 0, widthPercent: 30 },
  { id: 111, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_DOKLADY, fieldKey: "kod_vydavajuceho_organu", label: "Kód vydávajúceho orgánu", shortLabel: "Kód orgánu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Adresa trvalého pobytu === Ulica → Súp+Or (vedľa) → Mesto+PSČ (vedľa) → Štát → Switch prech. + adresa prech.
  { id: 72, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 73, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 74, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 75, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 76, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 77, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  { id: 78, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "korespond_rovnaka", label: "Adresa prech. pobytu sa zhoduje s trvalou", shortLabel: "Prech. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 2, widthPercent: 100 },
  { id: 79, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_ulica", label: "Ulica (prechodný)", shortLabel: "Ulica (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 40 },
  { id: 80, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_supisne", label: "Súpisné číslo (prechodný)", shortLabel: "Súp. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 120, rowNumber: 3, widthPercent: 30 },
  { id: 81, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_orientacne", label: "Orientačné číslo (prechodný)", shortLabel: "Or. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 130, rowNumber: 3, widthPercent: 30 },
  { id: 82, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_mesto", label: "Mesto (prechodný)", shortLabel: "Mesto (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 140, rowNumber: 4, widthPercent: 50 },
  { id: 83, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_psc", label: "PSČ (prechodný)", shortLabel: "PSČ (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 150, rowNumber: 4, widthPercent: 25 },

  // === PANEL: Kontaktné údaje === Telefón | Email (vedľa seba)
  { id: 84, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_KONTAKT, fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 85, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === DOPLNKOVÉ: Zákonné === DIČ + IČ DPH (vedľa seba) → GDPR + Marketing → Tretie strany + Profilovanie → Poistná + Overenie
  { id: 600, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 601, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 602, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 603, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 604, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "suhlas_tretie_strany", label: "Súhlas s poskytnutím údajov tretím stranám", shortLabel: "Tretie strany", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 605, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "suhlas_profilovanie", label: "Súhlas s automatizovaným profilovaním", shortLabel: "Profilovanie", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 606, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "poistna_povinnost", label: "Poistná povinnosť splnená", shortLabel: "Poistná pov.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 70, rowNumber: 3, widthPercent: 50 },
  { id: 607, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZAKONNE, fieldKey: "overenie_totoznosti", label: "Overenie totožnosti vykonané", shortLabel: "Overenie totoži.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 80, rowNumber: 3, widthPercent: 50 },

  // === DOPLNKOVÉ: Bankové === IBAN → BIC → Číslo účtu
  { id: 610, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZMLUVNE, fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 611, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZMLUVNE, fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 612, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_ZMLUVNE, fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },

  // === DOPLNKOVÉ: AML === KUV 1,2,3 (Meno → RČ → %)
  { id: 300, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 301, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 302, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 303, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_meno_2", label: "KUV 2 – Meno a priezvisko", shortLabel: "KUV 2 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 304, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_rc_2", label: "KUV 2 – Rodné číslo", shortLabel: "KUV 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 305, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_podiel_2", label: "KUV 2 – % podiel", shortLabel: "KUV 2 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },
  { id: 306, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_meno_3", label: "KUV 3 – Meno a priezvisko", shortLabel: "KUV 3 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 70, rowNumber: 2, widthPercent: 40 },
  { id: 307, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_rc_3", label: "KUV 3 – Rodné číslo", shortLabel: "KUV 3 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 80, rowNumber: 2, widthPercent: 30 },
  { id: 308, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_AML, fieldKey: "kuv_podiel_3", label: "KUV 3 – % podiel", shortLabel: "KUV 3 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 90, rowNumber: 2, widthPercent: 30 },

  // === DOPLNKOVÉ: Firemný profil === Obrat | Zamestnanci (vedľa seba)
  { id: 320, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_FIREMNY, fieldKey: "obrat", label: "Obrat (ročný)", shortLabel: "Obrat", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 321, clientTypeId: 3, sectionId: SZCO_SECTION_DOPLNKOVE, panelId: SZCO_PANEL_FIREMNY, fieldKey: "pocet_zamestnancov", label: "Počet zamestnancov", shortLabel: "Zamestnanci", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === VOLITEĽNÉ === CGN Rating
  { id: 210, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: null, fieldKey: "cgn_rating", label: "CGN Rating", shortLabel: "CGN", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["A", "B", "C", "D", "E"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", categoryCode: "bonita", sortOrder: 10, rowNumber: 0, widthPercent: 100 },

  // === INÉ ÚDAJE ===
  { id: 910, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "poznamka_interna", label: "Interná poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 911, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "tagy", label: "Značky / Tagy", shortLabel: "Tagy", fieldType: "text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 20, rowNumber: 1, widthPercent: 50 },
  { id: 912, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "zdroj_klienta", label: "Zdroj klienta", shortLabel: "Zdroj", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Odporúčanie", "Web", "Sociálne siete", "Osobný kontakt", "Reklama", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 913, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "datum_prvej_schodzky", label: "Dátum prvej schôdzky", shortLabel: "1. schôdzka", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 40, rowNumber: 2, widthPercent: 33 },
  { id: 914, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "preferovany_kontakt", label: "Preferovaný spôsob kontaktu", shortLabel: "Pref. kontakt", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Telefón", "Email", "SMS", "Osobne", "WhatsApp"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 50, rowNumber: 2, widthPercent: 33 },
  { id: 915, clientTypeId: 3, sectionId: SZCO_SECTION_INE, panelId: null, fieldKey: "jazyk_komunikacie", label: "Jazyk komunikácie", shortLabel: "Jazyk", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Slovenčina", "Čeština", "Angličtina", "Maďarčina", "Nemčina", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 60, rowNumber: 2, widthPercent: 34 },

  // === VOLITEĽNÉ: Špeciálne aktíva (⛵ Lode, Lietadlá, Umenie) ===
  { id: 930, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_aktiva", label: "Typ aktíva", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Plavidlo / Loď", "Lietadlo / Dron", "Umelecké dielo", "Drahé kovy", "Zbierka / Kolekcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 931, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_nazov", label: "Názov / Označenie", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 932, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_reg_cislo", label: "Registračné číslo", shortLabel: "Reg. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 933, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_plavidla", label: "Typ plavidla", shortLabel: "Typ plav.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Motorová jachta", "Plachetnica", "Katamaran", "Motorový čln", "Hausbót", "Iné"], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 934, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_pristav", label: "Prístav kotvenia", shortLabel: "Prístav", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 34 },
  { id: 935, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_vytlak", label: "Výtlak (BRT)", shortLabel: "Výtlak", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: "BRT", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
  { id: 936, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_hodnota", label: "Odhadovaná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 2, widthPercent: 50 },
  { id: 937, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_AKTIVA, fieldKey: "spec_poistna_zmluva", label: "Číslo poistnej zmluvy", shortLabel: "Č. poistky", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 110, rowNumber: 2, widthPercent: 50 },

  // === VOLITEĽNÉ: Firemné portfólio (🏗️ Stroje, Budovy, Zásoby) ===
  { id: 940, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_typ_majetku", label: "Typ firemného majetku", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Stroj / Zariadenie", "Budova / Prevádzka", "Technológia", "Vozový park", "Zásoby", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 941, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_nazov", label: "Názov / Identifikátor", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 942, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_inventarne_cislo", label: "Inventárne číslo", shortLabel: "Inv. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 943, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_adresa_prevadzky", label: "Adresa prevádzky", shortLabel: "Adresa prev.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 944, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_hodnota", label: "Účtovná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 945, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_poistenie_zodp", label: "Poistenie zodpovednosti", shortLabel: "Poist. zodp.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  { id: 946, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_FIREMNE_PORTF, fieldKey: "firm_poznamka", label: "Poznámka k majetku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 100 },

  // === VOLITEĽNÉ: Špecifické riziká (💎 Kybernetické, Drahé kovy) ===
  { id: 950, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_typ", label: "Typ rizika", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Kybernetické riziko", "Poistenie drahých kovov", "Environmentálne riziko", "Profesná zodpovednosť", "Poistenie zbierok", "Poistenie zodpovednosti za škodu prevádzkou", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 951, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_popis", label: "Popis rizika", shortLabel: "Popis", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 67 },
  { id: 952, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 1, widthPercent: 33 },
  { id: 953, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistovatel", label: "Poisťovateľ", shortLabel: "Poisťovateľ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 34 },
  { id: 954, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_cislo_zmluvy", label: "Číslo zmluvy", shortLabel: "Č. zmluvy", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 955, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poznamka", label: "Poznámka k riziku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 2, widthPercent: 100 },

  // === VOLITEĽNÉ: Poistenie podujatí (🎭) ===
  { id: 2020, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_nazov", label: "Názov podujatia", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 34 },
  { id: 2021, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_typ", label: "Typ podujatia", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Vernisáž", "Koncert / Turné", "Festival", "Konferencia", "Výstava", "Športové podujatie", "Súkromná akcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 2022, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_miesto", label: "Miesto konania", shortLabel: "Miesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 2023, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_datum_od", label: "Dátum začiatku", shortLabel: "Od", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 2024, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_datum_do", label: "Dátum ukončenia", shortLabel: "Do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 2025, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_status", label: "Status podujatia", shortLabel: "Status", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Príprava", "Aktívne", "Prebieha", "Ukončené", "Archív"], defaultValue: "Príprava", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 34 },
  { id: 2026, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_zodpovednost", label: "Zodpovednosť za návštevníkov", shortLabel: "Zodpovednosť", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno – poistenie zodpovednosti", "Nie", "Čiastočne"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 33 },
  { id: 2027, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_poistenie_storna", label: "Poistenie storna", shortLabel: "Storno poist.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 80, rowNumber: 2, widthPercent: 34 },
  { id: 2028, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 90, rowNumber: 2, widthPercent: 33 },
  { id: 2029, clientTypeId: 3, sectionId: SZCO_SECTION_VOLITELNE, panelId: SZCO_PANEL_EVENTY, fieldKey: "event_poznamka", label: "Poznámka k podujatiu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 3, widthPercent: 100 },
];

export const PO_SECTIONS: StaticSection[] = [
  { id: PO_SECTION_POVINNE, clientTypeId: 4, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: PO_SECTION_DOPLNKOVE, clientTypeId: 4, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: PO_SECTION_VOLITELNE, clientTypeId: 4, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
  { id: PO_SECTION_INE, clientTypeId: 4, name: "INÉ ÚDAJE", folderCategory: "ine", sortOrder: 3 },
];

export const PO_PANELS: StaticPanel[] = [
  { id: PO_PANEL_SUBJEKT, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Subjekt PO", gridColumns: 2, sortOrder: 0 },
  { id: PO_PANEL_SIDLO, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Sídlo spoločnosti", gridColumns: 2, sortOrder: 1 },
  { id: PO_PANEL_KONTAKT, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 2 },
  { id: PO_PANEL_AML, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, name: "AML – Konečný užívateľ výhod", gridColumns: 3, sortOrder: 2 },
  { id: PO_PANEL_FIREMNY, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, name: "Firemný profil", gridColumns: 3, sortOrder: 3 },
  { id: PO_PANEL_ZAKONNE, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, name: "Zákonné údaje", gridColumns: 2, sortOrder: 0 },
  { id: PO_PANEL_ZMLUVNE, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, name: "Bankové údaje", gridColumns: 3, sortOrder: 1 },
  { id: PO_PANEL_STATUTARI, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, name: "Štatutárni zástupcovia", gridColumns: 3, sortOrder: 4 },
  { id: PO_PANEL_SPEC_AKTIVA, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, name: "⛵ Špeciálne aktíva", gridColumns: 3, sortOrder: 0 },
  { id: PO_PANEL_FIREMNE_PORTF, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, name: "🏗️ Firemné portfólio", gridColumns: 3, sortOrder: 1 },
  { id: PO_PANEL_SPEC_RIZIKA, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, name: "💎 Špecifické riziká", gridColumns: 3, sortOrder: 2 },
  { id: PO_PANEL_EVENTY, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, name: "🎭 Poistenie podujatí", gridColumns: 3, sortOrder: 3 },
  { id: PO_PANEL_SPEC_SUBJEKT, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "🏛️ Špecifický typ organizácie", gridColumns: 3, sortOrder: 3 },
];

export const PO_FIELDS: StaticField[] = [
  // === PANEL: Subjekt PO === Názov → IČO → SK NACE
  { id: 87, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov organizácie", shortLabel: "Názov org.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 88, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 89, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "sk_nace", label: "SK NACE", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", categoryCode: "firemny_profil", sortOrder: 30, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Sídlo === Ulica → Súp+Or (vedľa) → Mesto+PSČ (vedľa) → Štát → Switch výkon + adresa výkonu
  { id: 90, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 91, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 92, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 93, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 94, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 95, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  { id: 96, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_rovnaky", label: "Adresa výkonu činnosti sa zhoduje so sídlom", shortLabel: "Výkon = sídlo", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 2, widthPercent: 100 },
  { id: 97, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_ulica", label: "Ulica (výkon činnosti)", shortLabel: "Ulica (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 40 },
  { id: 98, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_supisne", label: "Súpisné číslo (výkon)", shortLabel: "Súp. č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 120, rowNumber: 3, widthPercent: 30 },
  { id: 99, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_orientacne", label: "Orientačné číslo (výkon)", shortLabel: "Or. č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 130, rowNumber: 3, widthPercent: 30 },
  { id: 100, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_mesto", label: "Mesto/Obec (výkon)", shortLabel: "Mesto (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 140, rowNumber: 4, widthPercent: 50 },
  { id: 101, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_psc", label: "PSČ (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 150, rowNumber: 4, widthPercent: 25 },
  { id: 102, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_stat", label: "Štát (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 160, rowNumber: 4, widthPercent: 25 },

  // === PANEL: Kontaktné údaje === Telefón | Email (vedľa seba)
  { id: 103, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_KONTAKT, fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 104, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === DOPLNKOVÉ: Zákonné === DIČ + IČ DPH (vedľa seba, hneď pod IČO) → GDPR + Marketing → Tretie strany + Profilovanie → Poistná + Overenie
  { id: 700, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 701, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 702, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 703, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 704, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "suhlas_tretie_strany", label: "Súhlas s poskytnutím údajov tretím stranám", shortLabel: "Tretie strany", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 705, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "suhlas_profilovanie", label: "Súhlas s automatizovaným profilovaním", shortLabel: "Profilovanie", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 706, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "poistna_povinnost", label: "Poistná povinnosť splnená", shortLabel: "Poistná pov.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 70, rowNumber: 3, widthPercent: 50 },
  { id: 707, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZAKONNE, fieldKey: "overenie_totoznosti", label: "Overenie totožnosti vykonané", shortLabel: "Overenie totoži.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 80, rowNumber: 3, widthPercent: 50 },

  // === DOPLNKOVÉ: Bankové === IBAN → BIC → Číslo účtu
  { id: 710, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZMLUVNE, fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 711, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZMLUVNE, fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 712, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_ZMLUVNE, fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },

  // === DOPLNKOVÉ: Štatutári === Meno → Funkcia → RČ (poradie: Meno → Funkcia → Kontakt)
  { id: 720, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_meno_1", label: "Štatutár 1 – Meno a priezvisko", shortLabel: "Štatutár 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 722, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_funkcia_1", label: "Štatutár 1 – Funkcia", shortLabel: "Funkcia 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 721, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_rc_1", label: "Štatutár 1 – Rodné číslo", shortLabel: "Štatutár 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 723, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_meno_2", label: "Štatutár 2 – Meno a priezvisko", shortLabel: "Štatutár 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 725, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_funkcia_2", label: "Štatutár 2 – Funkcia", shortLabel: "Funkcia 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 724, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_STATUTARI, fieldKey: "statutar_rc_2", label: "Štatutár 2 – Rodné číslo", shortLabel: "Štatutár 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 60, rowNumber: 1, widthPercent: 30 },

  // === DOPLNKOVÉ: AML === KUV 1,2,3 (Meno → RČ → %)
  { id: 400, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 401, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 402, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 403, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_meno_2", label: "KUV 2 – Meno a priezvisko", shortLabel: "KUV 2 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 404, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_rc_2", label: "KUV 2 – Rodné číslo", shortLabel: "KUV 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 405, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_podiel_2", label: "KUV 2 – % podiel", shortLabel: "KUV 2 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },
  { id: 406, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_meno_3", label: "KUV 3 – Meno a priezvisko", shortLabel: "KUV 3 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 70, rowNumber: 2, widthPercent: 40 },
  { id: 407, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_rc_3", label: "KUV 3 – Rodné číslo", shortLabel: "KUV 3 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 80, rowNumber: 2, widthPercent: 30 },
  { id: 408, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_AML, fieldKey: "kuv_podiel_3", label: "KUV 3 – % podiel", shortLabel: "KUV 3 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 90, rowNumber: 2, widthPercent: 30 },

  // === DOPLNKOVÉ: Firemný profil === Obrat | Zamestnanci (vedľa seba)
  { id: 420, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_FIREMNY, fieldKey: "obrat", label: "Obrat (ročný)", shortLabel: "Obrat", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 421, clientTypeId: 4, sectionId: PO_SECTION_DOPLNKOVE, panelId: PO_PANEL_FIREMNY, fieldKey: "pocet_zamestnancov", label: "Počet zamestnancov", shortLabel: "Zamestnanci", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === VOLITEĽNÉ === CGN Rating
  { id: 211, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: null, fieldKey: "cgn_rating", label: "CGN Rating", shortLabel: "CGN", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["A", "B", "C", "D", "E"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", categoryCode: "bonita", sortOrder: 10, rowNumber: 0, widthPercent: 100 },

  // === INÉ ÚDAJE ===
  { id: 920, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "poznamka_interna", label: "Interná poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 921, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "tagy", label: "Značky / Tagy", shortLabel: "Tagy", fieldType: "text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 20, rowNumber: 1, widthPercent: 50 },
  { id: 922, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "zdroj_klienta", label: "Zdroj klienta", shortLabel: "Zdroj", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Odporúčanie", "Web", "Sociálne siete", "Osobný kontakt", "Reklama", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 923, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "datum_prvej_schodzky", label: "Dátum prvej schôdzky", shortLabel: "1. schôdzka", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 40, rowNumber: 2, widthPercent: 33 },
  { id: 924, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "preferovany_kontakt", label: "Preferovaný spôsob kontaktu", shortLabel: "Pref. kontakt", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Telefón", "Email", "SMS", "Osobne", "WhatsApp"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 50, rowNumber: 2, widthPercent: 33 },
  { id: 925, clientTypeId: 4, sectionId: PO_SECTION_INE, panelId: null, fieldKey: "jazyk_komunikacie", label: "Jazyk komunikácie", shortLabel: "Jazyk", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Slovenčina", "Čeština", "Angličtina", "Maďarčina", "Nemčina", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 60, rowNumber: 2, widthPercent: 34 },

  // === VOLITEĽNÉ: Špeciálne aktíva (⛵ Lode, Lietadlá, Umenie) ===
  { id: 960, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_aktiva", label: "Typ aktíva", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Plavidlo / Loď", "Lietadlo / Dron", "Umelecké dielo", "Drahé kovy", "Zbierka / Kolekcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 961, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_nazov", label: "Názov / Označenie", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 962, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_reg_cislo", label: "Registračné číslo", shortLabel: "Reg. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 963, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_typ_plavidla", label: "Typ plavidla", shortLabel: "Typ plav.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Motorová jachta", "Plachetnica", "Katamaran", "Motorový čln", "Hausbót", "Iné"], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 964, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_pristav", label: "Prístav kotvenia", shortLabel: "Prístav", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 34 },
  { id: 965, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_vytlak", label: "Výtlak (BRT)", shortLabel: "Výtlak", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: "BRT", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
  { id: 966, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_hodnota", label: "Odhadovaná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 2, widthPercent: 50 },
  { id: 967, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_AKTIVA, fieldKey: "spec_poistna_zmluva", label: "Číslo poistnej zmluvy", shortLabel: "Č. poistky", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 110, rowNumber: 2, widthPercent: 50 },

  // === VOLITEĽNÉ: Firemné portfólio (🏗️ Stroje, Budovy, Zásoby) ===
  { id: 970, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_typ_majetku", label: "Typ firemného majetku", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Stroj / Zariadenie", "Budova / Prevádzka", "Technológia", "Vozový park", "Zásoby", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 971, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_nazov", label: "Názov / Identifikátor", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 34 },
  { id: 972, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_inventarne_cislo", label: "Inventárne číslo", shortLabel: "Inv. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 973, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_adresa_prevadzky", label: "Adresa prevádzky", shortLabel: "Adresa prev.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 974, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_hodnota", label: "Účtovná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 975, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_poistenie_zodp", label: "Poistenie zodpovednosti", shortLabel: "Poist. zodp.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
  { id: 976, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_FIREMNE_PORTF, fieldKey: "firm_poznamka", label: "Poznámka k majetku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 100 },

  // === VOLITEĽNÉ: Špecifické riziká (💎 Kybernetické, Drahé kovy) ===
  { id: 980, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_typ", label: "Typ rizika", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Kybernetické riziko", "Poistenie drahých kovov", "Environmentálne riziko", "Profesná zodpovednosť", "Poistenie zbierok", "Poistenie zodpovednosti za škodu prevádzkou", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
  { id: 981, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_popis", label: "Popis rizika", shortLabel: "Popis", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 67 },
  { id: 982, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 1, widthPercent: 33 },
  { id: 983, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poistovatel", label: "Poisťovateľ", shortLabel: "Poisťovateľ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 34 },
  { id: 984, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_cislo_zmluvy", label: "Číslo zmluvy", shortLabel: "Č. zmluvy", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 985, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_SPEC_RIZIKA, fieldKey: "riziko_poznamka", label: "Poznámka k riziku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 2, widthPercent: 100 },

  // === VOLITEĽNÉ: Poistenie podujatí (🎭) ===
  { id: 2040, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_nazov", label: "Názov podujatia", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 10, rowNumber: 0, widthPercent: 34 },
  { id: 2041, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_typ", label: "Typ podujatia", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Vernisáž", "Koncert / Turné", "Festival", "Konferencia", "Výstava", "Športové podujatie", "Súkromná akcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
  { id: 2042, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_miesto", label: "Miesto konania", shortLabel: "Miesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
  { id: 2043, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_datum_od", label: "Dátum začiatku", shortLabel: "Od", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 40, rowNumber: 1, widthPercent: 33 },
  { id: 2044, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_datum_do", label: "Dátum ukončenia", shortLabel: "Do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
  { id: 2045, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_status", label: "Status podujatia", shortLabel: "Status", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Príprava", "Aktívne", "Prebieha", "Ukončené", "Archív"], defaultValue: "Príprava", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 60, rowNumber: 1, widthPercent: 34 },
  { id: 2046, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_zodpovednost", label: "Zodpovednosť za návštevníkov", shortLabel: "Zodpovednosť", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno – poistenie zodpovednosti", "Nie", "Čiastočne"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 70, rowNumber: 2, widthPercent: 33 },
  { id: 2047, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_poistenie_storna", label: "Poistenie storna", shortLabel: "Storno poist.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 80, rowNumber: 2, widthPercent: 34 },
  { id: 2048, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 90, rowNumber: 2, widthPercent: 33 },
  { id: 2049, clientTypeId: 4, sectionId: PO_SECTION_VOLITELNE, panelId: PO_PANEL_EVENTY, fieldKey: "event_poznamka", label: "Poznámka k podujatiu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "volitelne", sortOrder: 100, rowNumber: 3, widthPercent: 100 },

  // === POVINNÉ: Špecifický typ organizácie (🏛️ Štát / 🤝 Neziskový sektor) ===
  { id: 2060, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "typ_organizacie", label: "Typ organizácie", shortLabel: "Typ org.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Obchodná spoločnosť", "Štátna inštitúcia", "Nadácia", "Občianske združenie (OZ)", "Cirkevná organizácia", "Nezisková organizácia", "Príspevková organizácia", "Iné"], defaultValue: "Obchodná spoločnosť", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 2061, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "zriadovatel", label: "Zriaďovateľ", shortLabel: "Zriaďovateľ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 2062, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "rozpoctova_kapitola", label: "Rozpočtová kapitola", shortLabel: "Rozpoč. kap.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 2063, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "statna_sprava_uroven", label: "Úroveň štátnej správy", shortLabel: "Úroveň ŠS", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Ústredný orgán", "Krajský úrad", "Okresný úrad", "Obec / Mesto", "Iné"], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 2064, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "ucel_nadacie", label: "Účel nadácie / OZ", shortLabel: "Účel", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 2065, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "statutar_nadacie", label: "Štatutár nadácie / OZ", shortLabel: "Štatutár", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 2066, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "verejna_zbierka", label: "Oprávnenie na verejnú zbierku", shortLabel: "Ver. zbierka", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 70, rowNumber: 3, widthPercent: 33 },
  { id: 2067, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "registracny_organ", label: "Registračný orgán", shortLabel: "Reg. orgán", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Občianske združenie (OZ)" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 80, rowNumber: 2, widthPercent: 50 },
  { id: 2068, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "datum_registracie", label: "Dátum registrácie", shortLabel: "Dát. reg.", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Občianske združenie (OZ)" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 90, rowNumber: 2, widthPercent: 50 },
  { id: 2069, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "opravnenie_konanie", label: "Oprávnenie na konanie v mene subjektu", shortLabel: "Oprávnenie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Samostatne", "Spoločne", "Na základe plnej moci", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 3, widthPercent: 34 },
  { id: 2070, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SPEC_SUBJEKT, fieldKey: "cirkevna_registracia", label: "Registrácia (cirkev)", shortLabel: "Cirkev. reg.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_organizacie", value: "Cirkevná organizácia" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 33 },
];

// =========================================================
// NS (Tretí sektor – Neziskový sektor) clientTypeId = 5
// =========================================================
const NS_SECTION_POVINNE = 83;
const NS_SECTION_DOPLNKOVE = 84;
const NS_SECTION_VOLITELNE = 85;
const NS_SECTION_INE = 86;

const NS_PANEL_SUBJEKT = 110;
const NS_PANEL_SIDLO = 111;
const NS_PANEL_KONTAKT = 112;
const NS_PANEL_AML = 115;
const NS_PANEL_ZAKONNE = 113;
const NS_PANEL_ZMLUVNE = 114;
const NS_PANEL_STATUTARI = 116;
const NS_PANEL_FIREMNY = 117;

export const NS_SECTIONS: StaticSection[] = [
  { id: NS_SECTION_POVINNE, clientTypeId: 5, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: NS_SECTION_DOPLNKOVE, clientTypeId: 5, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: NS_SECTION_VOLITELNE, clientTypeId: 5, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
  { id: NS_SECTION_INE, clientTypeId: 5, name: "INÉ ÚDAJE", folderCategory: "ine", sortOrder: 3 },
];

export const NS_PANELS: StaticPanel[] = [
  { id: NS_PANEL_SUBJEKT, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, name: "Subjekt NS", gridColumns: 2, sortOrder: 0 },
  { id: NS_PANEL_SIDLO, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, name: "Sídlo organizácie", gridColumns: 2, sortOrder: 1 },
  { id: NS_PANEL_KONTAKT, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 2 },
  { id: NS_PANEL_AML, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, name: "AML – KUV", gridColumns: 3, sortOrder: 0 },
  { id: NS_PANEL_ZAKONNE, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, name: "Zákonné údaje", gridColumns: 2, sortOrder: 1 },
  { id: NS_PANEL_ZMLUVNE, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, name: "Bankové údaje", gridColumns: 3, sortOrder: 2 },
  { id: NS_PANEL_STATUTARI, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, name: "Štatutárni zástupcovia", gridColumns: 3, sortOrder: 3 },
  { id: NS_PANEL_FIREMNY, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, name: "Profil organizácie", gridColumns: 2, sortOrder: 4 },
];

export const NS_FIELDS: StaticField[] = [
  // === PANEL: Subjekt NS ===
  { id: 3001, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov organizácie", shortLabel: "Názov org.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 3002, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 3003, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SUBJEKT, fieldKey: "typ_organizacie", label: "Typ organizácie", shortLabel: "Typ org.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Nadácia", "Nadačný fond", "Občianske združenie (OZ)", "Nezisková organizácia (NO)", "Neinvestičný fond", "Cirkevná organizácia", "Záujmové združenie právnických osôb", "Profesijná komora / Únia", "Politická strana / Hnutie", "Odborová organizácia", "Iné"], defaultValue: "Nezisková organizácia (NO)", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 100 },

  // === PANEL: Sídlo organizácie ===
  { id: 3010, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 3011, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 3012, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 3013, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 3014, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 3015, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },

  // === PANEL: Kontaktné údaje ===
  { id: 3020, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_KONTAKT, fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 3021, clientTypeId: 5, sectionId: NS_SECTION_POVINNE, panelId: NS_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === PANEL: AML – KUV ===
  { id: 3030, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 3031, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 3032, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 3033, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_meno_2", label: "KUV 2 – Meno a priezvisko", shortLabel: "KUV 2 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 3034, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_rc_2", label: "KUV 2 – Rodné číslo", shortLabel: "KUV 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 3035, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_podiel_2", label: "KUV 2 – % podiel", shortLabel: "KUV 2 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },
  { id: 3036, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_meno_3", label: "KUV 3 – Meno a priezvisko", shortLabel: "KUV 3 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 70, rowNumber: 2, widthPercent: 40 },
  { id: 3037, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_rc_3", label: "KUV 3 – Rodné číslo", shortLabel: "KUV 3 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 80, rowNumber: 2, widthPercent: 30 },
  { id: 3038, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_AML, fieldKey: "kuv_podiel_3", label: "KUV 3 – % podiel", shortLabel: "KUV 3 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 90, rowNumber: 2, widthPercent: 30 },

  // === PANEL: Zákonné údaje ===
  { id: 3040, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 3041, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 3042, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 3043, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "suhlas_tretie_strany", label: "Súhlas s poskytnutím údajov tretím stranám", shortLabel: "Tretie strany", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 3044, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "suhlas_profilovanie", label: "Súhlas s automatizovaným profilovaním", shortLabel: "Profilovanie", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 3045, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "poistna_povinnost", label: "Poistná povinnosť splnená", shortLabel: "Poistná pov.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 70, rowNumber: 3, widthPercent: 50 },
  { id: 3046, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZAKONNE, fieldKey: "overenie_totoznosti", label: "Overenie totožnosti vykonané", shortLabel: "Overenie totoži.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 80, rowNumber: 3, widthPercent: 50 },

  // === PANEL: Bankové údaje ===
  { id: 3050, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZMLUVNE, fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 3051, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZMLUVNE, fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 3052, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_ZMLUVNE, fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },

  // === PANEL: Štatutárni zástupcovia ===
  { id: 3060, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_meno_1", label: "Štatutár 1 – Meno a priezvisko", shortLabel: "Štatutár 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 3061, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_funkcia_1", label: "Štatutár 1 – Funkcia", shortLabel: "Funkcia 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 3062, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_rc_1", label: "Štatutár 1 – Rodné číslo", shortLabel: "Štatutár 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 3063, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_meno_2", label: "Štatutár 2 – Meno a priezvisko", shortLabel: "Štatutár 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 3064, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_funkcia_2", label: "Štatutár 2 – Funkcia", shortLabel: "Funkcia 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 3065, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_STATUTARI, fieldKey: "statutar_rc_2", label: "Štatutár 2 – Rodné číslo", shortLabel: "Štatutár 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 60, rowNumber: 1, widthPercent: 30 },

  // === PANEL: Profil organizácie ===
  { id: 3070, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_FIREMNY, fieldKey: "ucel_organizacie", label: "Účel organizácie / Poslanie", shortLabel: "Účel org.", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 3071, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_FIREMNY, fieldKey: "cislo_registracie_ns", label: "Číslo registrácie", shortLabel: "Č. registrácie", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 1, widthPercent: 50 },
  { id: 3072, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_FIREMNY, fieldKey: "datum_registracie_ns", label: "Dátum registrácie", shortLabel: "Dát. reg.", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 3073, clientTypeId: 5, sectionId: NS_SECTION_DOPLNKOVE, panelId: NS_PANEL_FIREMNY, fieldKey: "pocet_zamestnancov_ns", label: "Počet zamestnancov / dobrovoľníkov", shortLabel: "Zamestnanci", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 40, rowNumber: 2, widthPercent: 50 },

  // === INÉ ÚDAJE ===
  { id: 3080, clientTypeId: 5, sectionId: NS_SECTION_INE, panelId: null, fieldKey: "poznamka_interna", label: "Interná poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
];

// =========================================================
// VS (Verejný sektor) clientTypeId = 6
// =========================================================
const VS_SECTION_POVINNE = 87;
const VS_SECTION_DOPLNKOVE = 88;
const VS_SECTION_VOLITELNE = 89;
const VS_SECTION_INE = 90;

const VS_PANEL_SUBJEKT = 120;
const VS_PANEL_SIDLO = 121;
const VS_PANEL_KONTAKT = 122;
const VS_PANEL_AML = 125;
const VS_PANEL_ZAKONNE = 123;
const VS_PANEL_ZMLUVNE = 124;
const VS_PANEL_STATUTARI = 126;
const VS_PANEL_INST_PROFIL = 127;

export const VS_SECTIONS: StaticSection[] = [
  { id: VS_SECTION_POVINNE, clientTypeId: 6, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: VS_SECTION_DOPLNKOVE, clientTypeId: 6, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: VS_SECTION_VOLITELNE, clientTypeId: 6, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
  { id: VS_SECTION_INE, clientTypeId: 6, name: "INÉ ÚDAJE", folderCategory: "ine", sortOrder: 3 },
];

export const VS_PANELS: StaticPanel[] = [
  { id: VS_PANEL_SUBJEKT, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, name: "Subjekt VS", gridColumns: 2, sortOrder: 0 },
  { id: VS_PANEL_SIDLO, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, name: "Sídlo inštitúcie", gridColumns: 2, sortOrder: 1 },
  { id: VS_PANEL_KONTAKT, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 2 },
  { id: VS_PANEL_AML, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, name: "AML – KUV", gridColumns: 3, sortOrder: 0 },
  { id: VS_PANEL_ZAKONNE, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, name: "Zákonné údaje", gridColumns: 2, sortOrder: 1 },
  { id: VS_PANEL_ZMLUVNE, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, name: "Bankové údaje", gridColumns: 3, sortOrder: 2 },
  { id: VS_PANEL_STATUTARI, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, name: "Štatutárni zástupcovia", gridColumns: 3, sortOrder: 3 },
  { id: VS_PANEL_INST_PROFIL, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, name: "Inštitucionálny profil", gridColumns: 2, sortOrder: 4 },
];

export const VS_FIELDS: StaticField[] = [
  // === PANEL: Subjekt VS ===
  { id: 4001, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov inštitúcie", shortLabel: "Názov inšt.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 4002, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  { id: 4003, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SUBJEKT, fieldKey: "typ_institucie", label: "Typ inštitúcie", shortLabel: "Typ inšt.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Ministerstvo", "Ústredný orgán štátnej správy", "Krajský úrad", "Okresný úrad", "Obec / Mesto", "Magistrát", "Vyšší územný celok (VÚC)", "Štátna inštitúcia", "Štátna príspevková organizácia", "Rozpočtová organizácia", "Štátny podnik", "Verejnoprávna inštitúcia", "Iné"], defaultValue: "Štátna inštitúcia", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 4004, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SUBJEKT, fieldKey: "uroven_verejnej_spravy", label: "Úroveň verejnej správy", shortLabel: "Úroveň VS", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Ústredná (štátna) správa", "Regionálna (VÚC)", "Miestna (obecná/mestská)", "Európska inštitúcia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },

  // === PANEL: Sídlo inštitúcie ===
  { id: 4010, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 4011, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 4012, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 4013, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 4014, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
  { id: 4015, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },

  // === PANEL: Kontaktné údaje ===
  { id: 4020, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_KONTAKT, fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 4021, clientTypeId: 6, sectionId: VS_SECTION_POVINNE, panelId: VS_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },

  // === PANEL: AML – KUV ===
  { id: 4030, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 4031, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 4032, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 4033, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_meno_2", label: "KUV 2 – Meno a priezvisko", shortLabel: "KUV 2 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 4034, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_rc_2", label: "KUV 2 – Rodné číslo", shortLabel: "KUV 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 4035, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_podiel_2", label: "KUV 2 – % podiel", shortLabel: "KUV 2 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },
  { id: 4036, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_meno_3", label: "KUV 3 – Meno a priezvisko", shortLabel: "KUV 3 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 70, rowNumber: 2, widthPercent: 40 },
  { id: 4037, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_rc_3", label: "KUV 3 – Rodné číslo", shortLabel: "KUV 3 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 80, rowNumber: 2, widthPercent: 30 },
  { id: 4038, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_AML, fieldKey: "kuv_podiel_3", label: "KUV 3 – % podiel", shortLabel: "KUV 3 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 90, rowNumber: 2, widthPercent: 30 },

  // === PANEL: Zákonné údaje ===
  { id: 4040, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
  { id: 4041, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
  { id: 4042, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
  { id: 4043, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "suhlas_tretie_strany", label: "Súhlas s poskytnutím údajov tretím stranám", shortLabel: "Tretie strany", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
  { id: 4044, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "suhlas_profilovanie", label: "Súhlas s automatizovaným profilovaním", shortLabel: "Profilovanie", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 60, rowNumber: 2, widthPercent: 50 },
  { id: 4045, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "poistna_povinnost", label: "Poistná povinnosť splnená", shortLabel: "Poistná pov.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 70, rowNumber: 3, widthPercent: 50 },
  { id: 4046, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZAKONNE, fieldKey: "overenie_totoznosti", label: "Overenie totožnosti vykonané", shortLabel: "Overenie totoži.", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 80, rowNumber: 3, widthPercent: 50 },

  // === PANEL: Bankové údaje ===
  { id: 4050, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZMLUVNE, fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 4051, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZMLUVNE, fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 4052, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_ZMLUVNE, fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },

  // === PANEL: Štatutárni zástupcovia ===
  { id: 4060, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_meno_1", label: "Štatutár 1 – Meno a priezvisko", shortLabel: "Štatutár 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
  { id: 4061, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_funkcia_1", label: "Štatutár 1 – Funkcia", shortLabel: "Funkcia 1", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
  { id: 4062, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_rc_1", label: "Štatutár 1 – Rodné číslo", shortLabel: "Štatutár 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
  { id: 4063, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_meno_2", label: "Štatutár 2 – Meno a priezvisko", shortLabel: "Štatutár 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
  { id: 4064, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_funkcia_2", label: "Štatutár 2 – Funkcia", shortLabel: "Funkcia 2", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
  { id: 4065, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_STATUTARI, fieldKey: "statutar_rc_2", label: "Štatutár 2 – Rodné číslo", shortLabel: "Štatutár 2 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "pravne", sortOrder: 60, rowNumber: 1, widthPercent: 30 },

  // === PANEL: Inštitucionálny profil ===
  { id: 4070, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_INST_PROFIL, fieldKey: "nadriadeny_organ", label: "Nadriadený orgán / Zriaďovateľ", shortLabel: "Nadr. orgán", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 4071, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_INST_PROFIL, fieldKey: "typ_financovania", label: "Typ financovania", shortLabel: "Typ financ.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Rozpočtová organizácia", "Príspevková organizácia", "Iné"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 1, widthPercent: 50 },
  { id: 4072, clientTypeId: 6, sectionId: VS_SECTION_DOPLNKOVE, panelId: VS_PANEL_INST_PROFIL, fieldKey: "rozpoctova_kapitola_vs", label: "Rozpočtová kapitola", shortLabel: "Rozp. kap.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 30, rowNumber: 1, widthPercent: 50 },

  // === INÉ ÚDAJE ===
  { id: 4080, clientTypeId: 6, sectionId: VS_SECTION_INE, panelId: null, fieldKey: "poznamka_interna", label: "Interná poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "ine", categoryCode: "ine", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
];

export function getFieldsForType(clientType: string): StaticField[] {
  switch (clientType) {
    case "fo": return FO_FIELDS;
    case "szco": return SZCO_FIELDS;
    case "po": return PO_FIELDS;
    case "ns": return NS_FIELDS;
    case "vs": return VS_FIELDS;
    default: return FO_FIELDS;
  }
}

export function getSectionsForType(clientType: string): StaticSection[] {
  switch (clientType) {
    case "fo": return FO_SECTIONS;
    case "szco": return SZCO_SECTIONS;
    case "po": return PO_SECTIONS;
    case "ns": return NS_SECTIONS;
    case "vs": return VS_SECTIONS;
    default: return FO_SECTIONS;
  }
}

export function getPanelsForType(clientType: string): StaticPanel[] {
  switch (clientType) {
    case "fo": return FO_PANELS;
    case "szco": return SZCO_PANELS;
    case "po": return PO_PANELS;
    case "ns": return NS_PANELS;
    case "vs": return VS_PANELS;
    default: return FO_PANELS;
  }
}

export function getFieldsForClientTypeId(clientTypeId: number): StaticField[] {
  switch (clientTypeId) {
    case 1: return FO_FIELDS;
    case 3: return SZCO_FIELDS;
    case 4: return PO_FIELDS;
    case 5: return NS_FIELDS;
    case 6: return VS_FIELDS;
    default: return FO_FIELDS;
  }
}

export function getSectionsForClientTypeId(clientTypeId: number): StaticSection[] {
  switch (clientTypeId) {
    case 1: return FO_SECTIONS;
    case 3: return SZCO_SECTIONS;
    case 4: return PO_SECTIONS;
    case 5: return NS_SECTIONS;
    case 6: return VS_SECTIONS;
    default: return FO_SECTIONS;
  }
}

export function getPanelsForClientTypeId(clientTypeId: number): StaticPanel[] {
  switch (clientTypeId) {
    case 1: return FO_PANELS;
    case 3: return SZCO_PANELS;
    case 4: return PO_PANELS;
    case 5: return NS_PANELS;
    case 6: return VS_PANELS;
    default: return FO_PANELS;
  }
}

export type SubjectCategoryKey = "identita" | "legislativa" | "rodina" | "financie" | "profil" | "digitalna" | "servis" | "relacie";

export interface SubjectCategory {
  key: SubjectCategoryKey;
  label: string;
  icon: string;
  color: string;
  panelIds: number[];
  includeIneFields?: boolean;
}

const FO_CATEGORIES: SubjectCategory[] = [
  { key: "identita", label: "Identita", icon: "User", color: "blue", panelIds: [4, 3, 20] },
  { key: "legislativa", label: "Legislatíva", icon: "Shield", color: "red", panelIds: [24, 25, 42] },
  { key: "rodina", label: "Rodina a vzťahy", icon: "Users", color: "pink", panelIds: [22] },
  { key: "financie", label: "Financie a majetok", icon: "CreditCard", color: "emerald", panelIds: [26, 27, 40, 41, 71, 60, 90, 92, 99] },
  { key: "profil", label: "Profil a marketing", icon: "Star", color: "amber", panelIds: [70], includeIneFields: true },
  { key: "digitalna", label: "Digitálna stopa", icon: "Phone", color: "cyan", panelIds: [6, 23] },
  { key: "servis", label: "Servis a archív", icon: "Archive", color: "slate", panelIds: [5, 50, 51, 52, 61, 62] },
  { key: "relacie", label: "Relácie", icon: "Link", color: "violet", panelIds: [] },
];

const SZCO_CATEGORIES: SubjectCategory[] = [
  { key: "identita", label: "Identita", icon: "User", color: "blue", panelIds: [7, 8, 9, 21] },
  { key: "legislativa", label: "Legislatíva", icon: "Shield", color: "red", panelIds: [30, 34] },
  { key: "rodina", label: "Rodina a vzťahy", icon: "Users", color: "pink", panelIds: [] },
  { key: "financie", label: "Financie a majetok", icon: "CreditCard", color: "emerald", panelIds: [35, 93, 94, 95, 100] },
  { key: "profil", label: "Profil a marketing", icon: "Star", color: "amber", panelIds: [31], includeIneFields: true },
  { key: "digitalna", label: "Digitálna stopa", icon: "Phone", color: "cyan", panelIds: [11, 10] },
  { key: "servis", label: "Servis a archív", icon: "Archive", color: "slate", panelIds: [] },
  { key: "relacie", label: "Relácie", icon: "Link", color: "violet", panelIds: [] },
];

const PO_CATEGORIES: SubjectCategory[] = [
  { key: "identita", label: "Identita", icon: "User", color: "blue", panelIds: [13, 14, 102] },
  { key: "legislativa", label: "Legislatíva", icon: "Shield", color: "red", panelIds: [32, 36] },
  { key: "rodina", label: "Rodina a vzťahy", icon: "Users", color: "pink", panelIds: [38] },
  { key: "financie", label: "Financie a majetok", icon: "CreditCard", color: "emerald", panelIds: [37, 96, 97, 98, 101] },
  { key: "profil", label: "Profil a marketing", icon: "Star", color: "amber", panelIds: [33], includeIneFields: true },
  { key: "digitalna", label: "Digitálna stopa", icon: "Phone", color: "cyan", panelIds: [15] },
  { key: "servis", label: "Servis a archív", icon: "Archive", color: "slate", panelIds: [] },
  { key: "relacie", label: "Relácie", icon: "Link", color: "violet", panelIds: [] },
];

const NS_CATEGORIES: SubjectCategory[] = [
  { key: "identita", label: "Identita", icon: "User", color: "blue", panelIds: [110, 111] },
  { key: "legislativa", label: "Legislatíva", icon: "Shield", color: "red", panelIds: [113, 115] },
  { key: "rodina", label: "Rodina a vzťahy", icon: "Users", color: "pink", panelIds: [116] },
  { key: "financie", label: "Financie a majetok", icon: "CreditCard", color: "emerald", panelIds: [114] },
  { key: "profil", label: "Profil a marketing", icon: "Star", color: "amber", panelIds: [117], includeIneFields: true },
  { key: "digitalna", label: "Digitálna stopa", icon: "Phone", color: "cyan", panelIds: [112] },
  { key: "servis", label: "Servis a archív", icon: "Archive", color: "slate", panelIds: [] },
  { key: "relacie", label: "Relácie", icon: "Link", color: "violet", panelIds: [] },
];

const VS_CATEGORIES: SubjectCategory[] = [
  { key: "identita", label: "Identita", icon: "User", color: "blue", panelIds: [120, 121] },
  { key: "legislativa", label: "Legislatíva", icon: "Shield", color: "red", panelIds: [123, 125] },
  { key: "rodina", label: "Rodina a vzťahy", icon: "Users", color: "pink", panelIds: [126] },
  { key: "financie", label: "Financie a majetok", icon: "CreditCard", color: "emerald", panelIds: [124] },
  { key: "profil", label: "Profil a marketing", icon: "Star", color: "amber", panelIds: [127], includeIneFields: true },
  { key: "digitalna", label: "Digitálna stopa", icon: "Phone", color: "cyan", panelIds: [122] },
  { key: "servis", label: "Servis a archív", icon: "Archive", color: "slate", panelIds: [] },
  { key: "relacie", label: "Relácie", icon: "Link", color: "violet", panelIds: [] },
];

export function getCategoriesForClientType(clientTypeId: number): SubjectCategory[] {
  switch (clientTypeId) {
    case 1: return FO_CATEGORIES;
    case 3: return SZCO_CATEGORIES;
    case 4: return PO_CATEGORIES;
    case 5: return NS_CATEGORIES;
    case 6: return VS_CATEGORIES;
    default: return FO_CATEGORIES;
  }
}

export function getCategoryFieldCounts(clientTypeId: number): Record<SubjectCategoryKey, number> {
  const fields = getFieldsForClientTypeId(clientTypeId);
  const categories = getCategoriesForClientType(clientTypeId);
  const counts: Record<string, number> = {};

  for (const cat of categories) {
    if (cat.key === "relacie") {
      counts[cat.key] = 0;
      continue;
    }
    let count = 0;
    for (const f of fields) {
      if (cat.panelIds.includes(f.panelId as number)) {
        count++;
      }
    }
    if (cat.includeIneFields) {
      count += fields.filter(f => f.fieldCategory === "ine").length;
    }
    counts[cat.key] = count;
  }

  return counts as Record<SubjectCategoryKey, number>;
}

export const AI_KEYWORD_ROUTING: Record<string, { targetPanel: string; targetField: string; keywords: string[] }[]> = {
  spec_aktiva: [
    { targetPanel: "spec_aktiva", targetField: "spec_typ_aktiva", keywords: ["plavidlo", "jachta", "loď", "čln", "katamaran", "hausbót", "motorový čln", "plachetnica"] },
    { targetPanel: "spec_aktiva", targetField: "spec_typ_aktiva", keywords: ["lietadlo", "dron", "vrtuľník", "letúň", "UAV", "vzdušné plavidlo"] },
    { targetPanel: "spec_aktiva", targetField: "spec_typ_aktiva", keywords: ["umelecké dielo", "obraz", "socha", "zbierka", "kolekcia", "starožitnosť", "antikvita"] },
    { targetPanel: "spec_aktiva", targetField: "spec_typ_aktiva", keywords: ["drahé kovy", "zlato", "striebro", "platina", "diamant", "šperky", "klenoty"] },
    { targetPanel: "spec_aktiva", targetField: "spec_reg_cislo", keywords: ["registračné číslo plavidla", "MMSI", "IMO číslo", "poznávacia značka lietadla"] },
    { targetPanel: "spec_aktiva", targetField: "spec_pristav", keywords: ["prístav", "marina", "kotvisko", "prístavisko", "kotvenie"] },
    { targetPanel: "spec_aktiva", targetField: "spec_vytlak", keywords: ["výtlak", "BRT", "tonáž", "brutto registrovaná tonáž"] },
  ],
  firemne_portfolio: [
    { targetPanel: "firemne_portfolio", targetField: "firm_typ_majetku", keywords: ["výrobná hala", "prevádzka", "budova", "sklad", "dielňa", "administratívna budova"] },
    { targetPanel: "firemne_portfolio", targetField: "firm_typ_majetku", keywords: ["stroj", "zariadenie", "CNC", "lis", "sústruh", "fréza", "kompresor", "generátor"] },
    { targetPanel: "firemne_portfolio", targetField: "firm_typ_majetku", keywords: ["technológia", "server", "IT infraštruktúra", "softvér", "licencia"] },
    { targetPanel: "firemne_portfolio", targetField: "firm_typ_majetku", keywords: ["vozový park", "nákladné auto", "dodávka", "kamión", "vysokozdvižný vozík"] },
    { targetPanel: "firemne_portfolio", targetField: "firm_inventarne_cislo", keywords: ["inventárne číslo", "majetkové číslo", "evidenčné číslo"] },
    { targetPanel: "firemne_portfolio", targetField: "firm_adresa_prevadzky", keywords: ["adresa prevádzky", "sídlo prevádzky", "miesto podnikania"] },
  ],
  spec_rizika: [
    { targetPanel: "spec_rizika", targetField: "riziko_typ", keywords: ["kybernetické riziko", "kyber poistenie", "cyber", "ransomware", "phishing", "DDoS"] },
    { targetPanel: "spec_rizika", targetField: "riziko_typ", keywords: ["environmentálne riziko", "ekologická škoda", "kontaminácia", "únik chemikálií"] },
    { targetPanel: "spec_rizika", targetField: "riziko_typ", keywords: ["profesná zodpovednosť", "zodpovednosť za škodu", "chyba v poradenstve"] },
    { targetPanel: "spec_rizika", targetField: "riziko_typ", keywords: ["poistenie zbierok", "poistenie drahých kovov", "poistenie cenností"] },
  ],
  eventy: [
    { targetPanel: "eventy", targetField: "event_typ", keywords: ["vernisáž", "výstava", "galéria", "galériová akcia", "umelecká výstava"] },
    { targetPanel: "eventy", targetField: "event_typ", keywords: ["koncert", "turné", "festival", "hudobná akcia", "vystúpenie"] },
    { targetPanel: "eventy", targetField: "event_typ", keywords: ["konferencia", "seminár", "workshop", "školenie", "kongres"] },
    { targetPanel: "eventy", targetField: "event_miesto", keywords: ["miesto konania", "venue", "hala", "štadión", "galéria"] },
    { targetPanel: "eventy", targetField: "event_datum_od", keywords: ["dátum podujatia", "začiatok akcie", "dátum konania"] },
    { targetPanel: "eventy", targetField: "event_poistenie_storna", keywords: ["poistenie storna", "storno poistenie", "zrušenie akcie"] },
  ],
  spec_subjekt: [
    { targetPanel: "spec_subjekt", targetField: "typ_organizacie", keywords: ["štátna inštitúcia", "ministerstvo", "úrad", "orgán štátnej správy"] },
    { targetPanel: "spec_subjekt", targetField: "typ_organizacie", keywords: ["nadácia", "nezisková organizácia", "občianske združenie", "OZ", "NGO"] },
    { targetPanel: "spec_subjekt", targetField: "typ_organizacie", keywords: ["cirkev", "cirkevná organizácia", "farnosť", "biskupstvo"] },
    { targetPanel: "spec_subjekt", targetField: "zriadovatel", keywords: ["zriaďovateľ", "zriaďovacia listina", "štatút"] },
    { targetPanel: "spec_subjekt", targetField: "rozpoctova_kapitola", keywords: ["rozpočtová kapitola", "kapitola rozpočtu", "štátny rozpočet"] },
    { targetPanel: "spec_subjekt", targetField: "opravnenie_konanie", keywords: ["oprávnenie konať", "spôsob konania", "podpisové právo", "plná moc"] },
  ],
};
