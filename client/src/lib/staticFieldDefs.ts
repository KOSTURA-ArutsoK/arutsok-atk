export interface StaticField {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  panelId: number | null;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isHidden: boolean;
  options: string[];
  defaultValue: string | null;
  visibilityRule: { dependsOn: string; value: string } | null;
  unit: string | null;
  decimalPlaces: number;
  fieldCategory: string;
  sortOrder: number;
  rowNumber: number;
  widthPercent: number;
}

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

const SZCO_SECTION_POVINNE = 11;
const SZCO_SECTION_DOPLNKOVE = 18;
const SZCO_SECTION_VOLITELNE = 12;
const SZCO_PANEL_SUBJEKT = 7;
const SZCO_PANEL_SIDLO = 8;
const SZCO_PANEL_OSOBNE = 9;
const SZCO_PANEL_ADRESA = 10;
const SZCO_PANEL_KONTAKT = 11;

const PO_SECTION_POVINNE = 15;
const PO_SECTION_DOPLNKOVE = 19;
const PO_SECTION_VOLITELNE = 16;
const PO_PANEL_SUBJEKT = 13;
const PO_PANEL_SIDLO = 14;
const PO_PANEL_KONTAKT = 15;

export const FO_SECTIONS: StaticSection[] = [
  { id: FO_SECTION_POVINNE, clientTypeId: 1, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: FO_SECTION_DOPLNKOVE, clientTypeId: 1, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: FO_SECTION_VOLITELNE, clientTypeId: 1, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
];

export const FO_PANELS: StaticPanel[] = [
  { id: FO_PANEL_OSOBNE, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Osobné údaje", gridColumns: 5, sortOrder: 0 },
  { id: FO_PANEL_ADRESA, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Adresa", gridColumns: 4, sortOrder: 1 },
  { id: FO_PANEL_CUDZINEC, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Cudzinec bez rodného čísla", gridColumns: 1, sortOrder: 2 },
  { id: FO_PANEL_KONTAKT, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 3 },
];

export const FO_FIELDS: StaticField[] = [
  { id: 9, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "titul_pred", label: "Titul pred menom", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 1, widthPercent: 15 },
  { id: 109, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 1, widthPercent: 20 },
  { id: 11, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 3, rowNumber: 1, widthPercent: 30 },
  { id: 12, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "titul_za", label: "Titul za menom", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 1, widthPercent: 15 },
  { id: 13, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "rodne_cislo", label: "Rodné číslo", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 5, rowNumber: 0, widthPercent: 100 },
  { id: 22, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "rodne_priezvisko", label: "Rodné priezvisko", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 6, rowNumber: 2, widthPercent: 100 },
  { id: 21, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "pohlavie", label: "Pohlavie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["muž", "žena"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 7, rowNumber: 0, widthPercent: 100 },
  { id: 14, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "datum_narodenia", label: "Dátum narodenia", fieldType: "date", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 17, rowNumber: 2, widthPercent: 100 },
  { id: 20, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "miesto_narodenia", label: "Miesto narodenia", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 21, rowNumber: 0, widthPercent: 100 },
  { id: 15, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 23, rowNumber: 2, widthPercent: 100 },
  { id: 16, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 24, rowNumber: 0, widthPercent: 100 },
  { id: 17, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: ["Občiansky preukaz", "Cestovný pas", "Povolenie na pobyt"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 26, rowNumber: 3, widthPercent: 100 },
  { id: 18, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 28, rowNumber: 3, widthPercent: 100 },
  { id: 19, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_OSOBNE, fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 3, widthPercent: 100 },
  { id: 23, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 9, rowNumber: 0, widthPercent: 100 },
  { id: 24, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_supisne", label: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 25, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_orientacne", label: "Orientačné č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 11, rowNumber: 0, widthPercent: 100 },
  { id: 26, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 12, rowNumber: 0, widthPercent: 100 },
  { id: 27, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 13, rowNumber: 0, widthPercent: 100 },
  { id: 28, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 14, rowNumber: 0, widthPercent: 100 },
  { id: 29, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "korespond_rovnaka", label: "Adresa prech. pobytu sa zhoduje s trvalou", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 16, rowNumber: 0, widthPercent: 100 },
  { id: 30, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_ulica", label: "Ulica (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 18, rowNumber: 0, widthPercent: 100 },
  { id: 31, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_supisne", label: "Súpisné č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 19, rowNumber: 0, widthPercent: 100 },
  { id: 32, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_orientacne", label: "Orientačné č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 100 },
  { id: 33, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_mesto", label: "Mesto (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 22, rowNumber: 0, widthPercent: 100 },
  { id: 34, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_psc", label: "PSČ (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 25, rowNumber: 0, widthPercent: 100 },
  { id: 35, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "ka_stat", label: "Štát (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 27, rowNumber: 0, widthPercent: 100 },
  { id: 36, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "kontaktna_rovnaka", label: "Kontaktná adresa sa zhoduje s trvalou", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 29, rowNumber: 0, widthPercent: 100 },
  { id: 37, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_ulica", label: "Ulica (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 31, rowNumber: 0, widthPercent: 100 },
  { id: 38, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_supisne", label: "Súpisné č. (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 32, rowNumber: 0, widthPercent: 100 },
  { id: 39, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_orientacne", label: "Orientačné č. (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 33, rowNumber: 0, widthPercent: 100 },
  { id: 40, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_mesto", label: "Mesto (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 34, rowNumber: 0, widthPercent: 100 },
  { id: 41, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_psc", label: "PSČ (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 35, rowNumber: 0, widthPercent: 100 },
  { id: 42, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_ADRESA, fieldKey: "koa_stat", label: "Štát (kontaktná)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 36, rowNumber: 0, widthPercent: 100 },
  { id: 43, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_KONTAKT, fieldKey: "telefon", label: "Tel. číslo (primárne)", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 8, rowNumber: 1, widthPercent: 100 },
  { id: 44, clientTypeId: 1, sectionId: FO_SECTION_POVINNE, panelId: FO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
];

export const SZCO_SECTIONS: StaticSection[] = [
  { id: SZCO_SECTION_POVINNE, clientTypeId: 3, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: SZCO_SECTION_DOPLNKOVE, clientTypeId: 3, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: SZCO_SECTION_VOLITELNE, clientTypeId: 3, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
];

export const SZCO_PANELS: StaticPanel[] = [
  { id: SZCO_PANEL_SUBJEKT, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Subjekt SZČO", gridColumns: 3, sortOrder: 0 },
  { id: SZCO_PANEL_SIDLO, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Sídlo spoločnosti", gridColumns: 4, sortOrder: 1 },
  { id: SZCO_PANEL_OSOBNE, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Osobné údaje", gridColumns: 4, sortOrder: 2 },
  { id: SZCO_PANEL_ADRESA, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Adresa trvalého pobytu", gridColumns: 4, sortOrder: 3 },
  { id: SZCO_PANEL_KONTAKT, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 4 },
];

export const SZCO_FIELDS: StaticField[] = [
  { id: 45, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov organizácie", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 46, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 47, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SUBJEKT, fieldKey: "sk_nace", label: "SK NACE", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 48, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 49, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 50, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 51, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 3, rowNumber: 0, widthPercent: 100 },
  { id: 52, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 0, widthPercent: 100 },
  { id: 53, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 5, rowNumber: 0, widthPercent: 100 },
  { id: 54, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_rovnaky", label: "Adresa výkonu činnosti sa zhoduje so sídlom", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 6, rowNumber: 0, widthPercent: 100 },
  { id: 55, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_ulica", label: "Ulica (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 7, rowNumber: 0, widthPercent: 100 },
  { id: 56, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_supisne", label: "Súpisné č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 8, rowNumber: 0, widthPercent: 100 },
  { id: 57, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_orientacne", label: "Orientačné č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 9, rowNumber: 0, widthPercent: 100 },
  { id: 58, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_mesto", label: "Mesto/Obec (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 59, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_psc", label: "PSČ (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 11, rowNumber: 0, widthPercent: 100 },
  { id: 60, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_SIDLO, fieldKey: "vykon_stat", label: "Štát (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 12, rowNumber: 0, widthPercent: 100 },
  { id: 61, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "titul_pred", label: "Titul pred menom", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 62, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 107, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "druhe_meno", label: "Druhé meno/priezvisko", fieldType: "TEXT", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 63, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 3, rowNumber: 0, widthPercent: 100 },
  { id: 64, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "titul_za", label: "Titul za menom", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 0, widthPercent: 100 },
  { id: 65, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "rodne_cislo", label: "Rodné číslo", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 0, widthPercent: 100 },
  { id: 66, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "datum_narodenia", label: "Dátum narodenia", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 5, rowNumber: 0, widthPercent: 100 },
  { id: 67, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 6, rowNumber: 0, widthPercent: 100 },
  { id: 68, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 7, rowNumber: 0, widthPercent: 100 },
  { id: 69, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 8, rowNumber: 0, widthPercent: 100 },
  { id: 70, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 9, rowNumber: 0, widthPercent: 100 },
  { id: 71, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_OSOBNE, fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 72, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 73, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_supisne", label: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 74, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_orientacne", label: "Orientačné č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 75, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 3, rowNumber: 0, widthPercent: 100 },
  { id: 76, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 0, widthPercent: 100 },
  { id: 77, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 5, rowNumber: 0, widthPercent: 100 },
  { id: 78, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "korespond_rovnaka", label: "Adresa prech. pobytu sa zhoduje s trvalou", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 6, rowNumber: 0, widthPercent: 100 },
  { id: 79, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_ulica", label: "Ulica (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 7, rowNumber: 0, widthPercent: 100 },
  { id: 80, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_supisne", label: "Súpisné č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 8, rowNumber: 0, widthPercent: 100 },
  { id: 81, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_orientacne", label: "Orientačné č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 9, rowNumber: 0, widthPercent: 100 },
  { id: 82, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_mesto", label: "Mesto (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 83, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_ADRESA, fieldKey: "ka_psc", label: "PSČ (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 11, rowNumber: 0, widthPercent: 100 },
  { id: 84, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_KONTAKT, fieldKey: "telefon", label: "Tel. číslo (primárne)", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 85, clientTypeId: 3, sectionId: SZCO_SECTION_POVINNE, panelId: SZCO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
];

export const PO_SECTIONS: StaticSection[] = [
  { id: PO_SECTION_POVINNE, clientTypeId: 4, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
  { id: PO_SECTION_DOPLNKOVE, clientTypeId: 4, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
  { id: PO_SECTION_VOLITELNE, clientTypeId: 4, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
];

export const PO_PANELS: StaticPanel[] = [
  { id: PO_PANEL_SUBJEKT, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Subjekt PO", gridColumns: 2, sortOrder: 0 },
  { id: PO_PANEL_SIDLO, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Sídlo spoločnosti", gridColumns: 2, sortOrder: 1 },
  { id: PO_PANEL_KONTAKT, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, name: "Kontaktné údaje", gridColumns: 2, sortOrder: 2 },
];

export const PO_FIELDS: StaticField[] = [
  { id: 87, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "nazov_organizacie", label: "Názov organizácie", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 88, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 89, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SUBJEKT, fieldKey: "sk_nace", label: "SK NACE", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 90, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 91, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_supisne", label: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
  { id: 92, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_orientacne", label: "Orientačné č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 2, rowNumber: 0, widthPercent: 100 },
  { id: 93, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 3, rowNumber: 0, widthPercent: 100 },
  { id: 94, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 4, rowNumber: 0, widthPercent: 100 },
  { id: 95, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 5, rowNumber: 0, widthPercent: 100 },
  { id: 96, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_rovnaky", label: "Adresa výkonu činnosti sa zhoduje so sídlom", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 6, rowNumber: 0, widthPercent: 100 },
  { id: 97, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_ulica", label: "Ulica (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 7, rowNumber: 0, widthPercent: 100 },
  { id: 98, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_supisne", label: "Súpisné č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 8, rowNumber: 0, widthPercent: 100 },
  { id: 99, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_orientacne", label: "Orientačné č. (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 9, rowNumber: 0, widthPercent: 100 },
  { id: 100, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_mesto", label: "Mesto/Obec (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
  { id: 101, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_psc", label: "PSČ (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 11, rowNumber: 0, widthPercent: 100 },
  { id: 102, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_SIDLO, fieldKey: "vykon_stat", label: "Štát (výkon)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "vykon_rovnaky", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 12, rowNumber: 0, widthPercent: 100 },
  { id: 103, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_KONTAKT, fieldKey: "telefon", label: "Tel. číslo (primárne)", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 0, rowNumber: 0, widthPercent: 100 },
  { id: 104, clientTypeId: 4, sectionId: PO_SECTION_POVINNE, panelId: PO_PANEL_KONTAKT, fieldKey: "email", label: "Email (primárny)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 1, rowNumber: 0, widthPercent: 100 },
];

export function getFieldsForType(clientType: string): StaticField[] {
  switch (clientType) {
    case "fo": return FO_FIELDS;
    case "szco": return SZCO_FIELDS;
    case "po": return PO_FIELDS;
    default: return FO_FIELDS;
  }
}

export function getSectionsForType(clientType: string): StaticSection[] {
  switch (clientType) {
    case "fo": return FO_SECTIONS;
    case "szco": return SZCO_SECTIONS;
    case "po": return PO_SECTIONS;
    default: return FO_SECTIONS;
  }
}

export function getPanelsForType(clientType: string): StaticPanel[] {
  switch (clientType) {
    case "fo": return FO_PANELS;
    case "szco": return SZCO_PANELS;
    case "po": return PO_PANELS;
    default: return FO_PANELS;
  }
}

export function getFieldsForClientTypeId(clientTypeId: number): StaticField[] {
  switch (clientTypeId) {
    case 1: return FO_FIELDS;
    case 3: return SZCO_FIELDS;
    case 4: return PO_FIELDS;
    default: return FO_FIELDS;
  }
}

export function getSectionsForClientTypeId(clientTypeId: number): StaticSection[] {
  switch (clientTypeId) {
    case 1: return FO_SECTIONS;
    case 3: return SZCO_SECTIONS;
    case 4: return PO_SECTIONS;
    default: return FO_SECTIONS;
  }
}

export function getPanelsForClientTypeId(clientTypeId: number): StaticPanel[] {
  switch (clientTypeId) {
    case 1: return FO_PANELS;
    case 3: return SZCO_PANELS;
    case 4: return PO_PANELS;
    default: return FO_PANELS;
  }
}
