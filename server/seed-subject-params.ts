import { db } from "./db";
import { subjectParamSections, subjectParameters, parameterSynonyms, subjectTemplates, subjectTemplateParams, clientTypes } from "@shared/schema";
import { eq, and, asc, inArray, or, sql } from "drizzle-orm";

type FieldSeed = {
  clientTypeId: number; sectionCode: string; panelCode: string | null; fieldKey: string; label: string;
  shortLabel?: string; fieldType: string; isRequired: boolean; isHidden: boolean; isCollection: boolean;
  extractionHints: any; options: string[]; defaultValue: string | null;
  visibilityRule: { dependsOn: string; value: string } | null;
  unit: string | null; decimalPlaces: number; fieldCategory: string; categoryCode?: string;
  sortOrder: number; rowNumber: number; widthPercent: number;
};

function f(clientTypeId: number, sectionCode: string, panelCode: string, fieldKey: string, label: string, fieldType: string, sortOrder: number, rowNumber: number, widthPercent: number, opts?: Partial<FieldSeed>): FieldSeed {
  return {
    clientTypeId, sectionCode, panelCode, fieldKey, label, fieldType,
    isRequired: false, isHidden: false, isCollection: false, extractionHints: null,
    options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2,
    fieldCategory: sectionCode.includes("povinne") ? "povinne" : "doplnkove",
    sortOrder, rowNumber, widthPercent,
    ...opts,
  };
}

async function _runSubjectParameterSync(onlyMissing: boolean): Promise<{ sectionsCount: number; parametersCount: number; synonymsCount: number }> {
  if (!onlyMissing) {
    const existing = await db.select({ id: subjectParameters.id }).from(subjectParameters).limit(1);
    if (existing.length > 0) {
      console.log("[SEED] Subject parameters already exist, skipping seed.");
      return { sectionsCount: 0, parametersCount: 0, synonymsCount: 0 };
    }
  }

  // Resolve OS client type ID dynamically so we never assume a fixed numeric ID.
  const osTypeRow = await db.select({ id: clientTypes.id }).from(clientTypes).where(eq(clientTypes.code, "OS"));
  const OS_CLIENT_TYPE_ID: number | null = osTypeRow[0]?.id ?? null;
  if (!OS_CLIENT_TYPE_ID) {
    console.warn("[SEED] OS client type not found – OS sections/fields will be skipped.");
  }

  const STATIC_SECTIONS = [
    { clientTypeId: 1, name: "POVINNÉ ÚDAJE", code: "fo_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "DOPLNKOVÉ ÚDAJE", code: "fo_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "VOLITEĽNÉ ÚDAJE", code: "fo_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "Osobné údaje", code: "fo_osobne", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 5 },
    { clientTypeId: 1, name: "Adresa", code: "fo_adresa", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Cudzinec bez rodného čísla", code: "fo_cudzinec", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 1 },
    { clientTypeId: 1, name: "Doklady", code: "fo_doklady", folderCategory: "povinne", sortOrder: 3, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Kontaktné údaje", code: "fo_kontakt", folderCategory: "povinne", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Rodinný kontakt a zastihnutie", code: "fo_rodina", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Doručovacia adresa", code: "fo_dorucovacia", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "AML – PEP a KUV", code: "fo_aml", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Zákonné údaje", code: "fo_zakonne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Bankové údaje", code: "fo_zmluvne", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Majetkové údaje", code: "fo_majetkove", folderCategory: "doplnkove", sortOrder: 5, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Zdravotné údaje", code: "fo_zdravie", folderCategory: "doplnkove", sortOrder: 6, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "PZP – Povinné zmluvné poistenie", code: "fo_poistenie_pzp", folderCategory: "doplnkove", sortOrder: 7, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Životné poistenie", code: "fo_poistenie_zivot", folderCategory: "doplnkove", sortOrder: 8, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Poistenie majetku", code: "fo_poistenie_majetok", folderCategory: "doplnkove", sortOrder: 9, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Vozidlo", code: "fo_auto", folderCategory: "doplnkove", sortOrder: 10, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Nehnuteľnosť", code: "fo_nehnutelnost", folderCategory: "doplnkove", sortOrder: 11, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Deti", code: "fo_deti", folderCategory: "doplnkove", sortOrder: 12, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Zamestnávateľ", code: "fo_zamestnavatel", folderCategory: "doplnkove", sortOrder: 13, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Starobné dôchodkové sporenie (SDS)", code: "fo_sds", folderCategory: "doplnkove", sortOrder: 14, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Doplnkové dôchodkové sporenie (DDS)", code: "fo_dds", folderCategory: "doplnkove", sortOrder: 15, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "POVINNÉ ÚDAJE", code: "szco_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "DOPLNKOVÉ ÚDAJE", code: "szco_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "VOLITEĽNÉ ÚDAJE", code: "szco_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "Subjekt SZČO", code: "szco_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Sídlo", code: "szco_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Osobné údaje", code: "szco_osobne", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Adresa trvalého pobytu", code: "szco_adresa", folderCategory: "povinne", sortOrder: 3, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Kontaktné údaje", code: "szco_kontakt", folderCategory: "povinne", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Doklady", code: "szco_doklady", folderCategory: "povinne", sortOrder: 5, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "AML – KUV", code: "szco_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "Firemný profil", code: "szco_firemny", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Zákonné údaje", code: "szco_zakonne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Bankové údaje", code: "szco_zmluvne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "PZP – Povinné zmluvné poistenie", code: "szco_poistenie_pzp", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Poistenie majetku", code: "szco_poistenie_majetok", folderCategory: "doplnkove", sortOrder: 5, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Vozidlo", code: "szco_auto", folderCategory: "doplnkove", sortOrder: 6, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Nehnuteľnosť", code: "szco_nehnutelnost", folderCategory: "doplnkove", sortOrder: 7, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "Podnikateľské údaje", code: "szco_zamestnavatelia", folderCategory: "doplnkove", sortOrder: 8, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "Starobné dôchodkové sporenie (SDS)", code: "szco_sds", folderCategory: "doplnkove", sortOrder: 9, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "Doplnkové dôchodkové sporenie (DDS)", code: "szco_dds", folderCategory: "doplnkove", sortOrder: 10, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "POVINNÉ ÚDAJE", code: "po_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "DOPLNKOVÉ ÚDAJE", code: "po_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "VOLITEĽNÉ ÚDAJE", code: "po_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "Subjekt PO", code: "po_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Sídlo", code: "po_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 4, name: "Kontaktné údaje", code: "po_kontakt", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "AML – KUV", code: "po_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "Firemný profil", code: "po_firemny", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Zákonné údaje", code: "po_zakonne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Bankové údaje", code: "po_zmluvne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "Štatutári", code: "po_statutari", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "PZP – Povinné zmluvné poistenie", code: "po_poistenie_pzp", folderCategory: "doplnkove", sortOrder: 5, isPanel: true, gridColumns: 4 },
    { clientTypeId: 4, name: "Poistenie majetku", code: "po_poistenie_majetok", folderCategory: "doplnkove", sortOrder: 6, isPanel: true, gridColumns: 4 },
    { clientTypeId: 4, name: "Vozidlo", code: "po_auto", folderCategory: "doplnkove", sortOrder: 7, isPanel: true, gridColumns: 4 },
    { clientTypeId: 4, name: "Nehnuteľnosti", code: "po_nehnutelnosti", folderCategory: "doplnkove", sortOrder: 8, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "Flotila vozidiel", code: "po_flota", folderCategory: "doplnkove", sortOrder: 9, isPanel: true, gridColumns: 3 },
    { clientTypeId: 5, name: "POVINNÉ ÚDAJE", code: "ns_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 5, name: "DOPLNKOVÉ ÚDAJE", code: "ns_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 5, name: "VOLITEĽNÉ ÚDAJE", code: "ns_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 5, name: "INÉ ÚDAJE", code: "ns_ine", folderCategory: "ine", sortOrder: 3, isPanel: false, gridColumns: 1 },
    { clientTypeId: 5, name: "Subjekt NS", code: "ns_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 5, name: "Sídlo organizácie", code: "ns_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 5, name: "Kontaktné údaje", code: "ns_kontakt", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 5, name: "AML – KUV", code: "ns_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 5, name: "Zákonné údaje", code: "ns_zakonne", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 5, name: "Bankové údaje", code: "ns_zmluvne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 3 },
    { clientTypeId: 5, name: "Štatutárni zástupcovia", code: "ns_statutari", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 2 },
    { clientTypeId: 5, name: "Profil organizácie", code: "ns_firemny", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 6, name: "POVINNÉ ÚDAJE", code: "vs_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 6, name: "DOPLNKOVÉ ÚDAJE", code: "vs_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 6, name: "VOLITEĽNÉ ÚDAJE", code: "vs_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 6, name: "INÉ ÚDAJE", code: "vs_ine", folderCategory: "ine", sortOrder: 3, isPanel: false, gridColumns: 1 },
    { clientTypeId: 6, name: "Subjekt VS", code: "vs_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 6, name: "Sídlo inštitúcie", code: "vs_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 6, name: "Kontaktné údaje", code: "vs_kontakt", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 6, name: "AML – KUV", code: "vs_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 6, name: "Zákonné údaje", code: "vs_zakonne", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 6, name: "Bankové údaje", code: "vs_zmluvne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 3 },
    { clientTypeId: 6, name: "Štatutárni zástupcovia", code: "vs_statutari", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 2 },
    { clientTypeId: 6, name: "Inštitucionálny profil", code: "vs_inst_profil", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 2 },
    ...(OS_CLIENT_TYPE_ID ? [
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "POVINNÉ ÚDAJE", code: "os_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "DOPLNKOVÉ ÚDAJE", code: "os_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "VOLITEĽNÉ ÚDAJE", code: "os_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "INÉ ÚDAJE", code: "os_ine", folderCategory: "ine", sortOrder: 3, isPanel: false, gridColumns: 1 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Základné údaje", code: "os_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Sídlo / Adresa", code: "os_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Kontaktné údaje", code: "os_kontakt", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 2 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Správa a riadenie", code: "os_riadenie", folderCategory: "povinne", sortOrder: 3, isPanel: true, gridColumns: 2 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Údaje o bytovom dome", code: "os_bytovy_dom", folderCategory: "povinne", sortOrder: 4, isPanel: true, gridColumns: 3 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Sídlo v domovskej krajine", code: "os_sidlo_zahranicie", folderCategory: "povinne", sortOrder: 5, isPanel: true, gridColumns: 3 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Rozšírené cirkevné údaje", code: "os_cirkev", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 2 },
      { clientTypeId: OS_CLIENT_TYPE_ID, name: "Bankové spojenie", code: "os_banka", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 3 },
    ] : []),
  ];

  const sectionMap: Record<string, number> = {};
  if (onlyMissing) {
    const existingSections = await db.select({ id: subjectParamSections.id, code: subjectParamSections.code }).from(subjectParamSections);
    const existingSectionCodes = new Set(existingSections.map(s => s.code));
    for (const s of existingSections) { sectionMap[s.code] = s.id; }
    for (const sec of STATIC_SECTIONS) {
      if (existingSectionCodes.has(sec.code)) continue;
      const [inserted] = await db.insert(subjectParamSections).values(sec as any).returning();
      sectionMap[sec.code] = inserted.id;
    }
  } else {
    for (const sec of STATIC_SECTIONS) {
      const [inserted] = await db.insert(subjectParamSections).values(sec as any).returning();
      sectionMap[sec.code] = inserted.id;
    }
  }

  const parentCodes: Record<string, string> = {
    fo_osobne: "fo_povinne", fo_adresa: "fo_povinne", fo_cudzinec: "fo_povinne", fo_doklady: "fo_povinne", fo_kontakt: "fo_povinne",
    fo_rodina: "fo_doplnkove", fo_dorucovacia: "fo_doplnkove", fo_aml: "fo_doplnkove", fo_zakonne: "fo_doplnkove", fo_zmluvne: "fo_doplnkove", fo_majetkove: "fo_doplnkove",
    fo_zdravie: "fo_doplnkove", fo_poistenie_pzp: "fo_doplnkove", fo_poistenie_zivot: "fo_doplnkove", fo_poistenie_majetok: "fo_doplnkove",
    fo_auto: "fo_doplnkove", fo_nehnutelnost: "fo_doplnkove", fo_deti: "fo_doplnkove", fo_zamestnavatel: "fo_doplnkove",
    fo_sds: "fo_doplnkove", fo_dds: "fo_doplnkove",
    szco_subjekt: "szco_povinne", szco_sidlo: "szco_povinne", szco_osobne: "szco_povinne", szco_adresa: "szco_povinne", szco_kontakt: "szco_povinne", szco_doklady: "szco_povinne",
    szco_aml: "szco_doplnkove", szco_firemny: "szco_doplnkove", szco_zakonne: "szco_doplnkove", szco_zmluvne: "szco_doplnkove",
    szco_poistenie_pzp: "szco_doplnkove", szco_poistenie_majetok: "szco_doplnkove", szco_auto: "szco_doplnkove", szco_nehnutelnost: "szco_doplnkove", szco_zamestnavatelia: "szco_doplnkove",
    szco_sds: "szco_doplnkove", szco_dds: "szco_doplnkove",
    po_subjekt: "po_povinne", po_sidlo: "po_povinne", po_kontakt: "po_povinne",
    po_aml: "po_doplnkove", po_firemny: "po_doplnkove", po_zakonne: "po_doplnkove", po_zmluvne: "po_doplnkove", po_statutari: "po_doplnkove",
    po_poistenie_pzp: "po_doplnkove", po_poistenie_majetok: "po_doplnkove", po_auto: "po_doplnkove", po_nehnutelnosti: "po_doplnkove", po_flota: "po_doplnkove",
    ns_subjekt: "ns_povinne", ns_sidlo: "ns_povinne", ns_kontakt: "ns_povinne",
    ns_aml: "ns_doplnkove", ns_zakonne: "ns_doplnkove", ns_zmluvne: "ns_doplnkove", ns_statutari: "ns_doplnkove", ns_firemny: "ns_doplnkove",
    vs_subjekt: "vs_povinne", vs_sidlo: "vs_povinne", vs_kontakt: "vs_povinne",
    vs_aml: "vs_doplnkove", vs_zakonne: "vs_doplnkove", vs_zmluvne: "vs_doplnkove", vs_statutari: "vs_doplnkove", vs_inst_profil: "vs_doplnkove",
    os_subjekt: "os_povinne", os_sidlo: "os_povinne", os_kontakt: "os_povinne",
    os_riadenie: "os_povinne", os_bytovy_dom: "os_povinne", os_sidlo_zahranicie: "os_povinne",
    os_cirkev: "os_doplnkove", os_banka: "os_doplnkove",
  };

  for (const [childCode, parentCode] of Object.entries(parentCodes)) {
    const childId = sectionMap[childCode];
    const parentId = sectionMap[parentCode];
    if (childId && parentId) {
      await db.update(subjectParamSections).set({ parentSectionId: parentId }).where(eq(subjectParamSections.id, childId));
    }
  }

  const FIELDS: FieldSeed[] = [
    // ============================================================
    // FO: Osobné údaje (fo_osobne) - 12 fields
    // Row 1 (100%): titul_pred(12) + meno(33) + priezvisko(43) + titul_za(12)
    // Row 2 (100%): rodne_cislo(25) + datum_narodenia(25) + pohlavie(25) + rodinny_stav(25)
    // Row 3 (100%): vek(20) + rodne_priezvisko(40) + miesto_narodenia(40)
    // Row 4 (100%): statna_prislusnost(100)
    // ============================================================
    f(1, "fo_povinne", "fo_osobne", "titul_pred", "Titul pred menom", "short_text", 10, 1, 12, { shortLabel: "Titul pred" }),
    f(1, "fo_povinne", "fo_osobne", "meno", "Meno", "short_text", 20, 1, 33, { isRequired: true }),
    f(1, "fo_povinne", "fo_osobne", "priezvisko", "Priezvisko", "short_text", 30, 1, 43, { isRequired: true }),
    f(1, "fo_povinne", "fo_osobne", "titul_za", "Titul za menom", "short_text", 40, 1, 12, { shortLabel: "Titul za" }),
    f(1, "fo_povinne", "fo_osobne", "rodne_cislo", "Rodné číslo", "short_text", 60, 2, 25, { isRequired: true, shortLabel: "Rod. číslo" }),
    f(1, "fo_povinne", "fo_osobne", "datum_narodenia", "Dátum narodenia", "date", 70, 2, 25, { isRequired: true, shortLabel: "Dát. nar." }),
    f(1, "fo_povinne", "fo_osobne", "pohlavie", "Pohlavie", "jedna_moznost", 80, 2, 25, { options: ["muž", "žena"] }),
    f(1, "fo_povinne", "fo_osobne", "rodinny_stav", "Rodinný stav", "jedna_moznost", 85, 2, 25, { options: ["slobodný/á", "ženatý/vydatá", "rozvedený/á", "vdovec/vdova", "druh/družka"], categoryCode: "osobne" }),
    f(1, "fo_povinne", "fo_osobne", "vek", "Vek", "number", 90, 3, 20, {}),
    f(1, "fo_povinne", "fo_osobne", "rodne_priezvisko", "Rodné priezvisko", "short_text", 100, 3, 40, { shortLabel: "Rod. priez." }),
    f(1, "fo_povinne", "fo_osobne", "miesto_narodenia", "Miesto narodenia", "short_text", 105, 3, 40, { shortLabel: "Miesto nar." }),
    f(1, "fo_povinne", "fo_osobne", "statna_prislusnost", "Štátna príslušnosť", "short_text", 110, 4, 100, { shortLabel: "Št. príslušnosť" }),

    // ============================================================
    // FO: Adresa (fo_adresa) - 21 fields
    // ============================================================
    f(1, "fo_povinne", "fo_adresa", "tp_ulica", "Ulica (trvalý pobyt)", "short_text", 10, 0, 40, { shortLabel: "Ulica" }),
    f(1, "fo_povinne", "fo_adresa", "tp_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(1, "fo_povinne", "fo_adresa", "tp_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Orient. č." }),
    f(1, "fo_povinne", "fo_adresa", "tp_mesto", "Mesto", "short_text", 40, 1, 50),
    f(1, "fo_povinne", "fo_adresa", "tp_psc", "PSČ", "short_text", 50, 1, 25),
    f(1, "fo_povinne", "fo_adresa", "tp_stat", "Štát", "short_text", 60, 1, 25),
    f(1, "fo_povinne", "fo_adresa", "korespond_rovnaka", "Adresa prech. pobytu sa zhoduje s trvalou", "switch", 100, 2, 100, { shortLabel: "Prech. = trvalá" }),
    f(1, "fo_povinne", "fo_adresa", "ka_ulica", "Ulica (prechodný pobyt)", "short_text", 110, 3, 40, { shortLabel: "Ulica (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "ka_supisne", "Súpisné číslo (prechodný)", "short_text", 120, 3, 30, { shortLabel: "Súp. č. (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "ka_orientacne", "Orientačné číslo (prechodný)", "short_text", 130, 3, 30, { shortLabel: "Or. č. (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "ka_mesto", "Mesto (prechodný)", "short_text", 140, 4, 50, { shortLabel: "Mesto (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "ka_psc", "PSČ (prechodný)", "short_text", 150, 4, 25, { shortLabel: "PSČ (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "ka_stat", "Štát (prechodný)", "short_text", 160, 4, 25, { shortLabel: "Štát (prech.)", visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "kontaktna_rovnaka", "Kontaktná adresa sa zhoduje s trvalou", "switch", 200, 5, 100, { shortLabel: "Kontakt. = trvalá" }),
    f(1, "fo_povinne", "fo_adresa", "koa_ulica", "Ulica (kontaktná)", "short_text", 210, 6, 40, { shortLabel: "Ulica (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "koa_supisne", "Súpisné číslo (kontaktná)", "short_text", 220, 6, 30, { shortLabel: "Súp. č. (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "koa_orientacne", "Orientačné číslo (kontaktná)", "short_text", 230, 6, 30, { shortLabel: "Or. č. (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "koa_mesto", "Mesto (kontaktná)", "short_text", 240, 7, 50, { shortLabel: "Mesto (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "koa_psc", "PSČ (kontaktná)", "short_text", 250, 7, 25, { shortLabel: "PSČ (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),
    f(1, "fo_povinne", "fo_adresa", "koa_stat", "Štát (kontaktná)", "short_text", 260, 7, 25, { shortLabel: "Štát (kont.)", visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" } }),

    // ============================================================
    // FO: Cudzinec (fo_cudzinec) - 7 fields (NEW)
    // ============================================================
    f(1, "fo_povinne", "fo_cudzinec", "pas_cislo", "Číslo pasu", "short_text", 10, 0, 33),
    f(1, "fo_povinne", "fo_cudzinec", "pas_platnost", "Platnosť pasu do", "date", 20, 0, 33),
    f(1, "fo_povinne", "fo_cudzinec", "pas_vydal", "Pas vydal", "short_text", 30, 0, 34),
    f(1, "fo_povinne", "fo_cudzinec", "pobyt_typ", "Typ pobytu", "short_text", 40, 1, 33),
    f(1, "fo_povinne", "fo_cudzinec", "pobyt_platnost", "Platnosť pobytu do", "date", 50, 1, 33),
    f(1, "fo_povinne", "fo_cudzinec", "druh_pobytu", "Druh pobytu", "jedna_moznost", 60, 2, 50, { options: ["prechodný", "trvalý", "tolerovaný"] }),
    f(1, "fo_povinne", "fo_cudzinec", "udelenie_azylu", "Azyl udelený dňa", "date", 70, 2, 50),

    // ============================================================
    // FO: Doklady (fo_doklady) - 6 fields
    // ============================================================
    f(1, "fo_povinne", "fo_doklady", "typ_dokladu", "Typ dokladu totožnosti", "jedna_moznost", 10, 0, 20, { isRequired: true, shortLabel: "Typ dokladu", options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"] }),
    f(1, "fo_povinne", "fo_doklady", "typ_dokladu_iny", "Špecifikácia dokladu", "short_text", 20, 0, 20, { isRequired: true, shortLabel: "Špecifikácia", visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" } }),
    f(1, "fo_povinne", "fo_doklady", "cislo_dokladu", "Číslo dokladu totožnosti", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Č. dokladu" }),
    f(1, "fo_povinne", "fo_doklady", "platnost_dokladu", "Platnosť dokladu do", "date", 40, 0, 20, { shortLabel: "Platnosť do" }),
    f(1, "fo_povinne", "fo_doklady", "vydal_organ", "Vydal (orgán)", "short_text", 50, 0, 30, { shortLabel: "Vydal" }),
    f(1, "fo_povinne", "fo_doklady", "kod_vydavajuceho_organu", "Kód vydávajúceho orgánu", "short_text", 60, 1, 100, { shortLabel: "Kód orgánu" }),

    // ============================================================
    // FO: Kontakt (fo_kontakt) - 2 fields
    // ============================================================
    f(1, "fo_povinne", "fo_kontakt", "telefon", "Telefónne číslo (primárne)", "phone", 10, 0, 50, { shortLabel: "Tel. číslo", isCollection: true }),
    f(1, "fo_povinne", "fo_kontakt", "email", "Email (primárny)", "short_text", 20, 0, 50, { shortLabel: "Email", isCollection: true }),

    // ============================================================
    // FO: Rodina (fo_rodina) - 4 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_rodina", "rodinny_kontakt_meno", "Meno rodinného kontaktu", "short_text", 10, 0, 50, { shortLabel: "Rod. kontakt", categoryCode: "komunikacne" }),
    f(1, "fo_doplnkove", "fo_rodina", "rodinny_kontakt_telefon", "Telefón rodinného kontaktu", "phone", 20, 0, 50, { shortLabel: "Rod. telefón", categoryCode: "komunikacne" }),
    f(1, "fo_doplnkove", "fo_rodina", "rodinny_kontakt_vztah", "Vzťah", "jedna_moznost", 30, 1, 50, { options: ["Manžel/ka", "Partner/ka", "Rodič", "Dieťa", "Súrodenec", "Iný"], categoryCode: "komunikacne" }),
    f(1, "fo_doplnkove", "fo_rodina", "zastihnutie", "Najlepšie zastihnutie", "jedna_moznost", 40, 1, 50, { shortLabel: "Zastihnutie", options: ["Ráno (8-12)", "Poobede (12-17)", "Večer (17-21)", "Kedykoľvek"], categoryCode: "komunikacne" }),

    // ============================================================
    // FO: Doručovacia (fo_dorucovacia) - 5 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_dorucovacia", "doruc_rovnaka", "Doručovacia adresa sa zhoduje s trvalou", "switch", 10, 0, 100, { shortLabel: "Doruč. = trvalá", categoryCode: "geolokacne" }),
    f(1, "fo_doplnkove", "fo_dorucovacia", "doruc_ulica", "Ulica (doručovacia)", "short_text", 20, 1, 100, { shortLabel: "Ulica (doruč.)", visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, categoryCode: "geolokacne" }),
    f(1, "fo_doplnkove", "fo_dorucovacia", "doruc_mesto", "Mesto (doručovacia)", "short_text", 30, 2, 50, { shortLabel: "Mesto (doruč.)", visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, categoryCode: "geolokacne" }),
    f(1, "fo_doplnkove", "fo_dorucovacia", "doruc_psc", "PSČ (doručovacia)", "short_text", 40, 2, 25, { shortLabel: "PSČ (doruč.)", visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, categoryCode: "geolokacne" }),
    f(1, "fo_doplnkove", "fo_dorucovacia", "doruc_stat", "Štát (doručovacia)", "short_text", 50, 2, 25, { shortLabel: "Štát (doruč.)", visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, categoryCode: "geolokacne" }),

    // ============================================================
    // FO: AML (fo_aml) - 6 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_aml", "pep", "Politicky exponovaná osoba (PEP)", "jedna_moznost", 10, 0, 33, { shortLabel: "PEP", options: ["Áno", "Nie"], defaultValue: "Nie", categoryCode: "aml" }),
    f(1, "fo_doplnkove", "fo_aml", "pep_funkcia", "PEP – verejná funkcia", "short_text", 20, 0, 33, { shortLabel: "PEP funkcia", visibilityRule: { dependsOn: "pep", value: "Áno" }, categoryCode: "aml" }),
    f(1, "fo_doplnkove", "fo_aml", "pep_vztah", "PEP – vzťah k PEP osobe", "short_text", 30, 0, 33, { shortLabel: "PEP vzťah", visibilityRule: { dependsOn: "pep", value: "Áno" }, categoryCode: "aml" }),
    f(1, "fo_doplnkove", "fo_aml", "kuv_meno_1", "KUV 1 – Meno a priezvisko", "short_text", 40, 1, 40, { shortLabel: "KUV 1 Meno", categoryCode: "aml" }),
    f(1, "fo_doplnkove", "fo_aml", "kuv_rc_1", "KUV 1 – Rodné číslo", "short_text", 50, 1, 30, { shortLabel: "KUV 1 RČ", categoryCode: "aml" }),
    f(1, "fo_doplnkove", "fo_aml", "kuv_podiel_1", "KUV 1 – % podiel", "desatinne_cislo", 60, 1, 30, { shortLabel: "KUV 1 %", unit: "%", categoryCode: "aml" }),

    // ============================================================
    // FO: Zákonné (fo_zakonne) - 4 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_zakonne", "dic", "DIČ", "short_text", 10, 0, 50, { categoryCode: "zakonne" }),
    f(1, "fo_doplnkove", "fo_zakonne", "ic_dph", "IČ DPH", "short_text", 20, 0, 50, { categoryCode: "zakonne" }),
    f(1, "fo_doplnkove", "fo_zakonne", "suhlas_gdpr", "Súhlas so spracovaním osobných údajov (GDPR)", "switch", 30, 1, 50, { shortLabel: "GDPR súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(1, "fo_doplnkove", "fo_zakonne", "suhlas_marketing", "Súhlas s marketingovou komunikáciou", "switch", 40, 1, 50, { shortLabel: "Marketing súhlas", defaultValue: "false", categoryCode: "zakonne" }),

    // ============================================================
    // FO: Bankové (fo_zmluvne) - 3 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_zmluvne", "iban", "IBAN", "short_text", 10, 0, 40, { categoryCode: "zmluvne" }),
    f(1, "fo_doplnkove", "fo_zmluvne", "bic", "BIC/SWIFT", "short_text", 20, 0, 30, { categoryCode: "zmluvne" }),
    f(1, "fo_doplnkove", "fo_zmluvne", "cislo_uctu", "Číslo účtu", "short_text", 30, 0, 30, { categoryCode: "zmluvne" }),

    // ============================================================
    // FO: Majetkové (fo_majetkove) - 2 fields
    // ============================================================
    f(1, "fo_doplnkove", "fo_majetkove", "spz", "ŠPZ vozidla", "short_text", 10, 0, 50, { shortLabel: "ŠPZ", categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_majetkove", "vin", "VIN číslo", "short_text", 20, 0, 50, { shortLabel: "VIN", categoryCode: "majetkove" }),

    // ============================================================
    // FO: Zdravie (fo_zdravie) - 13 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_zdravie", "vyska_cm", "Výška v cm", "number", 10, 0, 25, { unit: "cm", decimalPlaces: 0, categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "hmotnost_kg", "Hmotnosť v kg", "number", 20, 0, 25, { unit: "kg", decimalPlaces: 1, categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "bmi", "BMI", "desatinne_cislo", 30, 0, 25, { decimalPlaces: 1, categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "krvna_skupina", "Krvná skupina", "jedna_moznost", 40, 0, 25, { options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "kurak", "Fajčiar", "jedna_moznost", 50, 1, 33, { options: ["Áno", "Nie", "Bývalý"], categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "alergie", "Alergie", "long_text", 60, 1, 67, { categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "chronicke_choroby", "Chronické ochorenia", "long_text", 70, 2, 50, { categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "hospitalizacia_posledna", "Posledná hospitalizácia", "date", 80, 2, 50, { categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "lieky", "Užívané lieky", "long_text", 90, 3, 100, { categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "invalidny_dochodca", "Invalidný dôchodca", "jedna_moznost", 100, 4, 33, { options: ["Áno", "Nie"], categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "stupen_invalidity", "Stupeň invalidity", "number", 110, 4, 33, { decimalPlaces: 0, categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "telesne_postihnutie", "Telesné postihnutie", "short_text", 120, 4, 34, { categoryCode: "zdravotne" }),
    f(1, "fo_doplnkove", "fo_zdravie", "sport_rizikovy", "Rizikový šport", "long_text", 130, 5, 100, { categoryCode: "zdravotne" }),

    // ============================================================
    // FO: PZP (fo_poistenie_pzp) - 8 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_cislo_poistky", "Číslo poistky PZP", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_poistovatel", "Poisťovateľ PZP", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_zaciatok", "Začiatok poistenia PZP", "date", 30, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_koniec", "Koniec poistenia PZP", "date", 40, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_rocne_poistne", "Ročné poistné PZP", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_bonus_malus", "Bonus/Malus stupeň", "short_text", 60, 1, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_predchadzajuca_poistovna", "Predchádzajúca poisťovňa PZP", "short_text", 70, 1, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_pzp", "pzp_pocet_skod", "Počet škodových udalostí", "number", 80, 1, 25, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // FO: Životné poistenie (fo_poistenie_zivot) - 11 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_cislo_poistky", "Číslo poistky životného poistenia", "short_text", 10, 0, 33, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_poistovatel", "Poisťovateľ ŽP", "short_text", 20, 0, 33, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_typ", "Typ životného poistenia", "jedna_moznost", 30, 0, 34, { options: ["rizikové", "investičné", "kapitálové", "unit-linked"], categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_poistna_suma", "Poistná suma ŽP", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_mesacne_poistne", "Mesačné poistné ŽP", "desatinne_cislo", 50, 1, 33, { unit: "€", categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_zaciatok", "Začiatok poistenia ŽP", "date", 60, 1, 34, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_koniec", "Koniec poistenia ŽP", "date", 70, 2, 33, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_opravnena_osoba", "Oprávnená osoba ŽP", "short_text", 80, 2, 33, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_pripoistenia", "Pripoistenia", "long_text", 90, 2, 34, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_vinkulacia", "Vinkulácia", "jedna_moznost", 100, 3, 50, { options: ["Áno", "Nie"], categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_zivot", "ziv_vinkulacia_banka", "Vinkulácia v prospech banky", "short_text", 110, 3, 50, { categoryCode: "poistenie" }),

    // ============================================================
    // FO: Majetok poistenie (fo_poistenie_majetok) - 11 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_cislo_poistky", "Číslo poistky majetku", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_poistovatel", "Poisťovateľ majetku", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_typ", "Typ poistenia", "jedna_moznost", 30, 0, 25, { options: ["nehnuteľnosť", "domácnosť", "komplex"], categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_poistna_suma", "Poistná suma", "desatinne_cislo", 40, 0, 25, { unit: "€", categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_mesacne_poistne", "Mesačné poistné", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_zaciatok", "Začiatok poistenia", "date", 60, 1, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_koniec", "Koniec poistenia", "date", 70, 1, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_adresa_poistenia", "Adresa poistenej nehnuteľnosti", "short_text", 80, 1, 25, { categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_typ_nehnutelnosti", "Typ nehnuteľnosti", "jedna_moznost", 90, 2, 33, { options: ["byt", "rodinný dom", "chata", "garáž"], categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_rozloha", "Rozloha m²", "number", 100, 2, 33, { unit: "m²", decimalPlaces: 0, categoryCode: "poistenie" }),
    f(1, "fo_doplnkove", "fo_poistenie_majetok", "maj_rok_vystavby", "Rok výstavby", "number", 110, 2, 34, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // FO: Auto (fo_auto) - 10 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_auto", "auto_znacka", "Značka vozidla", "short_text", 10, 0, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_model", "Model vozidla", "short_text", 20, 0, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_rok", "Rok výroby", "number", 30, 0, 25, { decimalPlaces: 0, categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_objem", "Objem motora cm³", "number", 40, 0, 25, { unit: "cm³", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_vykon_kw", "Výkon kW", "number", 50, 1, 25, { unit: "kW", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_palivo", "Palivo", "jedna_moznost", 60, 1, 25, { options: ["benzín", "nafta", "LPG", "elektro", "hybrid"], categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_farba", "Farba vozidla", "short_text", 70, 1, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_pocet_km", "Počet najazdených km", "number", 80, 1, 25, { unit: "km", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_prvy_evid", "Dátum prvej evidencie", "date", 90, 2, 50, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_auto", "auto_ecv", "EČV", "short_text", 100, 2, 50, { categoryCode: "majetkove" }),

    // ============================================================
    // FO: Nehnuteľnosť (fo_nehnutelnost) - 9 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_typ", "Typ nehnuteľnosti", "jedna_moznost", 10, 0, 25, { options: ["byt", "rodinný dom", "pozemok", "komerčný objekt"], categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_adresa", "Adresa nehnuteľnosti", "short_text", 20, 0, 75, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_rozloha", "Rozloha m²", "desatinne_cislo", 30, 1, 33, { unit: "m²", categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_hodnota", "Trhová hodnota", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_lv_cislo", "Číslo listu vlastníctva", "short_text", 50, 1, 34, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_parcela", "Parcela č.", "short_text", 60, 2, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_kataster", "Katastrálne územie", "short_text", 70, 2, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_druh_pozemku", "Druh pozemku", "short_text", 80, 2, 25, { categoryCode: "majetkove" }),
    f(1, "fo_doplnkove", "fo_nehnutelnost", "neh_tiarchy", "Ťarchy na nehnuteľnosti", "long_text", 90, 2, 25, { categoryCode: "majetkove" }),

    // ============================================================
    // FO: Deti (fo_deti) - 9 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_deti", "dieta1_meno", "Dieťa 1 - Meno", "short_text", 10, 0, 34, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta1_rc", "Dieťa 1 - Rodné číslo", "short_text", 20, 0, 33, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta1_datum_nar", "Dieťa 1 - Dátum narodenia", "date", 30, 0, 33, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta2_meno", "Dieťa 2 - Meno", "short_text", 40, 1, 34, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta2_rc", "Dieťa 2 - Rodné číslo", "short_text", 50, 1, 33, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta2_datum_nar", "Dieťa 2 - Dátum narodenia", "date", 60, 1, 33, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta3_meno", "Dieťa 3 - Meno", "short_text", 70, 2, 34, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta3_rc", "Dieťa 3 - Rodné číslo", "short_text", 80, 2, 33, { categoryCode: "rodinne" }),
    f(1, "fo_doplnkove", "fo_deti", "dieta3_datum_nar", "Dieťa 3 - Dátum narodenia", "date", 90, 2, 33, { categoryCode: "rodinne" }),

    // ============================================================
    // FO: Zamestnávateľ (fo_zamestnavatel) - 9 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_nazov", "Názov zamestnávateľa", "short_text", 10, 0, 50, { categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_ico", "IČO zamestnávateľa", "short_text", 20, 0, 50, { categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_adresa", "Adresa zamestnávateľa", "short_text", 30, 1, 100, { categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_pozicia", "Pracovná pozícia", "short_text", 40, 2, 50, { categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_prijem_mesacny", "Mesačný príjem", "desatinne_cislo", 50, 2, 50, { unit: "€", categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_typ_pomeru", "Typ pracovného pomeru", "jedna_moznost", 60, 3, 50, { options: ["TPP", "DPP", "DPČ", "SZČO", "Dôchodca", "Nezamestnaný"], categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_od", "Zamestnaný od", "date", 70, 3, 50, { categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_druhy_prijem", "Druhý príjem", "desatinne_cislo", 80, 4, 50, { unit: "€", categoryCode: "pracovne" }),
    f(1, "fo_doplnkove", "fo_zamestnavatel", "zam_prijem_partner", "Príjem partnera", "desatinne_cislo", 90, 4, 50, { unit: "€", categoryCode: "pracovne" }),

    // ============================================================
    // FO: SDS – Starobné dôchodkové sporenie (fo_sds) - 7 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_sds", "sds_dss", "DSS (správcovská spoločnosť)", "short_text", 10, 0, 50, { shortLabel: "DSS", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_cislo_zmluvy", "Číslo zmluvy SDS", "short_text", 20, 0, 50, { categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_fond", "Fond SDS", "jedna_moznost", 30, 1, 33, { options: ["dlhopisový garantovaný", "zmiešaný negarantovaný", "akciový negarantovaný", "indexový negarantovaný"], categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_mesacny_prispevok", "Mesačný príspevok SDS", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_datum_vstupu", "Dátum vstupu do II. piliera", "date", 50, 1, 34, { categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_aktualny_stav", "Aktuálny stav účtu SDS", "desatinne_cislo", 60, 2, 50, { unit: "€", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_sds", "sds_poznamky", "Poznámky SDS", "long_text", 70, 2, 50, { categoryCode: "dochodkove" }),

    // ============================================================
    // FO: DDS – Doplnkové dôchodkové sporenie (fo_dds) - 8 fields (NEW)
    // ============================================================
    f(1, "fo_doplnkove", "fo_dds", "dds_spolocnost", "DDS spoločnosť (III. pilier)", "short_text", 10, 0, 50, { shortLabel: "DDS spoločnosť", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_cislo_zmluvy", "Číslo zmluvy DDS", "short_text", 20, 0, 50, { categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_fond", "Fond DDS", "jedna_moznost", 30, 1, 33, { options: ["konzervatívny", "vyvážený", "rastový", "príspevkový"], categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_mesacny_prispevok_ucastnik", "Mesačný príspevok účastníka", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_mesacny_prispevok_zamestnavatel", "Mesačný príspevok zamestnávateľa", "desatinne_cislo", 50, 1, 34, { unit: "€", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_datum_vstupu", "Dátum vstupu do III. piliera", "date", 60, 2, 50, { categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_aktualny_stav", "Aktuálny stav účtu DDS", "desatinne_cislo", 70, 2, 50, { unit: "€", categoryCode: "dochodkove" }),
    f(1, "fo_doplnkove", "fo_dds", "dds_poznamky", "Poznámky DDS", "long_text", 80, 3, 100, { categoryCode: "dochodkove" }),

    // ============================================================
    // SZČO: Subjekt (szco_subjekt) - 2 fields
    // ============================================================
    f(3, "szco_povinne", "szco_subjekt", "nazov_firmy", "Obchodné meno SZČO", "short_text", 10, 0, 60, { isRequired: true, shortLabel: "Obch. meno" }),
    f(3, "szco_povinne", "szco_subjekt", "ico", "IČO", "short_text", 20, 0, 40, { isRequired: true }),

    // ============================================================
    // SZČO: Sídlo (szco_sidlo) - 6 fields
    // ============================================================
    f(3, "szco_povinne", "szco_sidlo", "sidlo_ulica", "Ulica (sídlo)", "short_text", 10, 0, 40, { isRequired: true, shortLabel: "Ulica" }),
    f(3, "szco_povinne", "szco_sidlo", "sidlo_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(3, "szco_povinne", "szco_sidlo", "sidlo_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Orient. č." }),
    f(3, "szco_povinne", "szco_sidlo", "sidlo_mesto", "Mesto/Obec", "short_text", 40, 1, 50, { isRequired: true }),
    f(3, "szco_povinne", "szco_sidlo", "sidlo_psc", "PSČ", "short_text", 50, 1, 25, { isRequired: true }),
    f(3, "szco_povinne", "szco_sidlo", "sidlo_stat", "Štát", "short_text", 60, 1, 25),

    // ============================================================
    // SZČO: Osobné (szco_osobne) - 8 fields
    // ============================================================
    f(3, "szco_povinne", "szco_osobne", "titul_pred", "Titul pred menom", "short_text", 10, 0, 12, { isRequired: true, shortLabel: "Titul pred" }),
    f(3, "szco_povinne", "szco_osobne", "meno", "Meno", "short_text", 20, 0, 33, { isRequired: true }),
    f(3, "szco_povinne", "szco_osobne", "priezvisko", "Priezvisko", "short_text", 30, 0, 43, { isRequired: true }),
    f(3, "szco_povinne", "szco_osobne", "titul_za", "Titul za menom", "short_text", 40, 0, 12, { shortLabel: "Titul za" }),
    f(3, "szco_povinne", "szco_osobne", "rodne_cislo", "Rodné číslo", "short_text", 50, 1, 33, { shortLabel: "Rod. číslo" }),
    f(3, "szco_povinne", "szco_osobne", "datum_narodenia", "Dátum narodenia", "date", 60, 1, 33, { shortLabel: "Dát. narodenia" }),
    f(3, "szco_povinne", "szco_osobne", "vek", "Vek", "number", 70, 1, 15),
    f(3, "szco_povinne", "szco_osobne", "statna_prislusnost", "Štátna príslušnosť", "short_text", 80, 2, 100, { shortLabel: "Št. príslušnosť" }),

    // ============================================================
    // SZČO: Kontakt (szco_kontakt) - 2 fields
    // ============================================================
    f(3, "szco_povinne", "szco_kontakt", "telefon", "Telefónne číslo (primárne)", "phone", 10, 0, 50, { shortLabel: "Tel. číslo", isCollection: true }),
    f(3, "szco_povinne", "szco_kontakt", "email", "Email (primárny)", "short_text", 20, 0, 50, { shortLabel: "Email", isCollection: true }),

    // ============================================================
    // SZČO: Doklady (szco_doklady) - 6 fields
    // ============================================================
    f(3, "szco_povinne", "szco_doklady", "typ_dokladu", "Typ dokladu totožnosti", "jedna_moznost", 10, 0, 20, { isRequired: true, shortLabel: "Typ dokladu", options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"] }),
    f(3, "szco_povinne", "szco_doklady", "typ_dokladu_iny", "Špecifikácia dokladu", "short_text", 20, 0, 20, { isRequired: true, shortLabel: "Špecifikácia", visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" } }),
    f(3, "szco_povinne", "szco_doklady", "cislo_dokladu", "Číslo dokladu totožnosti", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Č. dokladu" }),
    f(3, "szco_povinne", "szco_doklady", "platnost_dokladu", "Platnosť dokladu do", "date", 40, 0, 20, { shortLabel: "Platnosť do" }),
    f(3, "szco_povinne", "szco_doklady", "vydal_organ", "Vydal (orgán)", "short_text", 50, 0, 30, { shortLabel: "Vydal" }),
    f(3, "szco_povinne", "szco_doklady", "kod_vydavajuceho_organu", "Kód vydávajúceho orgánu", "short_text", 60, 1, 100, { shortLabel: "Kód orgánu" }),

    // ============================================================
    // SZČO: Adresa (szco_adresa) - 6 fields
    // ============================================================
    f(3, "szco_povinne", "szco_adresa", "tp_ulica", "Ulica (trvalý pobyt)", "short_text", 10, 0, 40, { isRequired: true, shortLabel: "Ulica" }),
    f(3, "szco_povinne", "szco_adresa", "tp_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(3, "szco_povinne", "szco_adresa", "tp_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Orient. č." }),
    f(3, "szco_povinne", "szco_adresa", "tp_mesto", "Mesto", "short_text", 40, 1, 50, { isRequired: true }),
    f(3, "szco_povinne", "szco_adresa", "tp_psc", "PSČ", "short_text", 50, 1, 25, { isRequired: true }),
    f(3, "szco_povinne", "szco_adresa", "tp_stat", "Štát", "short_text", 60, 1, 25, { isRequired: true }),

    // ============================================================
    // SZČO: AML (szco_aml) - 3 fields
    // ============================================================
    f(3, "szco_doplnkove", "szco_aml", "kuv_meno_1", "KUV 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "KUV 1 Meno", categoryCode: "aml" }),
    f(3, "szco_doplnkove", "szco_aml", "kuv_rc_1", "KUV 1 – Rodné číslo", "short_text", 20, 0, 30, { shortLabel: "KUV 1 RČ", categoryCode: "aml" }),
    f(3, "szco_doplnkove", "szco_aml", "kuv_podiel_1", "KUV 1 – % podiel", "desatinne_cislo", 30, 0, 30, { shortLabel: "KUV 1 %", unit: "%", categoryCode: "aml" }),

    // ============================================================
    // SZČO: Firemný profil (szco_firemny) - 2 fields
    // ============================================================
    f(3, "szco_doplnkove", "szco_firemny", "obrat", "Obrat (ročný)", "desatinne_cislo", 10, 0, 50, { shortLabel: "Obrat", unit: "€", categoryCode: "firemny_profil" }),
    f(3, "szco_doplnkove", "szco_firemny", "pocet_zamestnancov", "Počet zamestnancov", "number", 20, 0, 50, { shortLabel: "Zamestnanci", decimalPlaces: 0, categoryCode: "firemny_profil" }),

    // ============================================================
    // SZČO: Zákonné (szco_zakonne) - 4 fields
    // ============================================================
    f(3, "szco_doplnkove", "szco_zakonne", "dic", "DIČ", "short_text", 10, 0, 50, { categoryCode: "zakonne" }),
    f(3, "szco_doplnkove", "szco_zakonne", "ic_dph", "IČ DPH", "short_text", 20, 0, 50, { categoryCode: "zakonne" }),
    f(3, "szco_doplnkove", "szco_zakonne", "suhlas_gdpr", "Súhlas so spracovaním osobných údajov (GDPR)", "switch", 30, 1, 50, { shortLabel: "GDPR súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(3, "szco_doplnkove", "szco_zakonne", "suhlas_marketing", "Súhlas s marketingovou komunikáciou", "switch", 40, 1, 50, { shortLabel: "Marketing súhlas", defaultValue: "false", categoryCode: "zakonne" }),

    // ============================================================
    // SZČO: Bankové (szco_zmluvne) - 3 fields
    // ============================================================
    f(3, "szco_doplnkove", "szco_zmluvne", "iban", "IBAN", "short_text", 10, 0, 40, { categoryCode: "zmluvne" }),
    f(3, "szco_doplnkove", "szco_zmluvne", "bic", "BIC/SWIFT", "short_text", 20, 0, 30, { categoryCode: "zmluvne" }),
    f(3, "szco_doplnkove", "szco_zmluvne", "cislo_uctu", "Číslo účtu", "short_text", 30, 0, 30, { categoryCode: "zmluvne" }),

    // ============================================================
    // SZČO: PZP (szco_poistenie_pzp) - 8 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_cislo_poistky", "Číslo poistky PZP", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_poistovatel", "Poisťovateľ PZP", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_zaciatok", "Začiatok poistenia PZP", "date", 30, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_koniec", "Koniec poistenia PZP", "date", 40, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_rocne_poistne", "Ročné poistné PZP", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_bonus_malus", "Bonus/Malus stupeň", "short_text", 60, 1, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_predchadzajuca_poistovna", "Predchádzajúca poisťovňa PZP", "short_text", 70, 1, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_pzp", "szco_pzp_pocet_skod", "Počet škodových udalostí", "number", 80, 1, 25, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // SZČO: Poistenie majetku (szco_poistenie_majetok) - 11 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_cislo_poistky", "Číslo poistky majetku", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_poistovatel", "Poisťovateľ majetku", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_typ", "Typ poistenia", "jedna_moznost", 30, 0, 25, { options: ["nehnuteľnosť", "domácnosť", "komplex"], categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_poistna_suma", "Poistná suma", "desatinne_cislo", 40, 0, 25, { unit: "€", categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_mesacne_poistne", "Mesačné poistné", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_zaciatok", "Začiatok poistenia", "date", 60, 1, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_koniec", "Koniec poistenia", "date", 70, 1, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_adresa_poistenia", "Adresa poistenej nehnuteľnosti", "short_text", 80, 1, 25, { categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_typ_nehnutelnosti", "Typ nehnuteľnosti", "jedna_moznost", 90, 2, 33, { options: ["byt", "rodinný dom", "chata", "garáž"], categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_rozloha", "Rozloha m²", "number", 100, 2, 33, { unit: "m²", decimalPlaces: 0, categoryCode: "poistenie" }),
    f(3, "szco_doplnkove", "szco_poistenie_majetok", "szco_maj_rok_vystavby", "Rok výstavby", "number", 110, 2, 34, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // SZČO: Auto (szco_auto) - 10 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_znacka", "Značka vozidla", "short_text", 10, 0, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_model", "Model vozidla", "short_text", 20, 0, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_rok", "Rok výroby", "number", 30, 0, 25, { decimalPlaces: 0, categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_objem", "Objem motora cm³", "number", 40, 0, 25, { unit: "cm³", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_vykon_kw", "Výkon kW", "number", 50, 1, 25, { unit: "kW", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_palivo", "Palivo", "jedna_moznost", 60, 1, 25, { options: ["benzín", "nafta", "LPG", "elektro", "hybrid"], categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_farba", "Farba vozidla", "short_text", 70, 1, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_pocet_km", "Počet najazdených km", "number", 80, 1, 25, { unit: "km", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_prvy_evid", "Dátum prvej evidencie", "date", 90, 2, 50, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_auto", "szco_auto_ecv", "EČV", "short_text", 100, 2, 50, { categoryCode: "majetkove" }),

    // ============================================================
    // SZČO: Nehnuteľnosť (szco_nehnutelnost) - 9 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_typ", "Typ nehnuteľnosti", "jedna_moznost", 10, 0, 25, { options: ["byt", "rodinný dom", "pozemok", "komerčný objekt"], categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_adresa", "Adresa nehnuteľnosti", "short_text", 20, 0, 75, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_rozloha", "Rozloha m²", "desatinne_cislo", 30, 1, 33, { unit: "m²", categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_hodnota", "Trhová hodnota", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_lv_cislo", "Číslo listu vlastníctva", "short_text", 50, 1, 34, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_parcela", "Parcela č.", "short_text", 60, 2, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_kataster", "Katastrálne územie", "short_text", 70, 2, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_druh_pozemku", "Druh pozemku", "short_text", 80, 2, 25, { categoryCode: "majetkove" }),
    f(3, "szco_doplnkove", "szco_nehnutelnost", "szco_neh_tiarchy", "Ťarchy na nehnuteľnosti", "long_text", 90, 2, 25, { categoryCode: "majetkove" }),

    // ============================================================
    // SZČO: Podnikateľské údaje (szco_zamestnavatelia) - 5 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_zamestnavatelia", "szco_nace", "SK NACE kód", "short_text", 10, 0, 50, { categoryCode: "firemny_profil" }),
    f(3, "szco_doplnkove", "szco_zamestnavatelia", "szco_predmet_podnikania", "Predmet podnikania", "short_text", 20, 0, 50, { categoryCode: "firemny_profil" }),
    f(3, "szco_doplnkove", "szco_zamestnavatelia", "szco_datum_vzniku", "Dátum vzniku", "date", 30, 1, 33, { categoryCode: "firemny_profil" }),
    f(3, "szco_doplnkove", "szco_zamestnavatelia", "szco_register", "Registrový súd", "short_text", 40, 1, 33, { categoryCode: "firemny_profil" }),
    f(3, "szco_doplnkove", "szco_zamestnavatelia", "szco_spisova_znacka", "Spisová značka", "short_text", 50, 1, 34, { categoryCode: "firemny_profil" }),

    // ============================================================
    // SZČO: SDS – Starobné dôchodkové sporenie (szco_sds) - 7 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_dss", "DSS (správcovská spoločnosť)", "short_text", 10, 0, 50, { shortLabel: "DSS", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_cislo_zmluvy", "Číslo zmluvy SDS", "short_text", 20, 0, 50, { categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_fond", "Fond SDS", "jedna_moznost", 30, 1, 33, { options: ["dlhopisový garantovaný", "zmiešaný negarantovaný", "akciový negarantovaný", "indexový negarantovaný"], categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_mesacny_prispevok", "Mesačný príspevok SDS", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_datum_vstupu", "Dátum vstupu do II. piliera", "date", 50, 1, 34, { categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_aktualny_stav", "Aktuálny stav účtu SDS", "desatinne_cislo", 60, 2, 50, { unit: "€", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_sds", "szco_sds_poznamky", "Poznámky SDS", "long_text", 70, 2, 50, { categoryCode: "dochodkove" }),

    // ============================================================
    // SZČO: DDS – Doplnkové dôchodkové sporenie (szco_dds) - 8 fields (NEW)
    // ============================================================
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_spolocnost", "DDS spoločnosť (III. pilier)", "short_text", 10, 0, 50, { shortLabel: "DDS spoločnosť", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_cislo_zmluvy", "Číslo zmluvy DDS", "short_text", 20, 0, 50, { categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_fond", "Fond DDS", "jedna_moznost", 30, 1, 33, { options: ["konzervatívny", "vyvážený", "rastový", "príspevkový"], categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_mesacny_prispevok_ucastnik", "Mesačný príspevok účastníka", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_mesacny_prispevok_zamestnavatel", "Mesačný príspevok zamestnávateľa", "desatinne_cislo", 50, 1, 34, { unit: "€", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_datum_vstupu", "Dátum vstupu do III. piliera", "date", 60, 2, 50, { categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_aktualny_stav", "Aktuálny stav účtu DDS", "desatinne_cislo", 70, 2, 50, { unit: "€", categoryCode: "dochodkove" }),
    f(3, "szco_doplnkove", "szco_dds", "szco_dds_poznamky", "Poznámky DDS", "long_text", 80, 3, 100, { categoryCode: "dochodkove" }),

    // ============================================================
    // PO: Subjekt (po_subjekt) - 4 fields
    // ============================================================
    f(4, "po_povinne", "po_subjekt", "nazov_firmy", "Obchodné meno", "short_text", 10, 0, 60, { isRequired: true, shortLabel: "Obch. meno" }),
    f(4, "po_povinne", "po_subjekt", "ico", "IČO", "short_text", 20, 0, 40, { isRequired: true }),
    f(4, "po_povinne", "po_subjekt", "pravna_forma", "Právna forma", "jedna_moznost", 30, 1, 50, { shortLabel: "Právna forma", options: ["s.r.o.", "a.s.", "k.s.", "v.o.s.", "družstvo", "nezisková org.", "iná"] }),
    f(4, "po_povinne", "po_subjekt", "datum_zalozenia", "Dátum založenia", "date", 40, 1, 50, { shortLabel: "Založenie" }),

    // ============================================================
    // PO: Sídlo (po_sidlo) - 6 fields
    // ============================================================
    f(4, "po_povinne", "po_sidlo", "sidlo_ulica", "Ulica (sídlo)", "short_text", 10, 0, 40, { isRequired: true, shortLabel: "Ulica" }),
    f(4, "po_povinne", "po_sidlo", "sidlo_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(4, "po_povinne", "po_sidlo", "sidlo_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { isRequired: true, shortLabel: "Orient. č." }),
    f(4, "po_povinne", "po_sidlo", "sidlo_mesto", "Mesto/Obec", "short_text", 40, 1, 50, { isRequired: true }),
    f(4, "po_povinne", "po_sidlo", "sidlo_psc", "PSČ", "short_text", 50, 1, 25, { isRequired: true }),
    f(4, "po_povinne", "po_sidlo", "sidlo_stat", "Štát", "short_text", 60, 1, 25),

    // ============================================================
    // PO: Kontakt (po_kontakt) - 2 fields
    // ============================================================
    f(4, "po_povinne", "po_kontakt", "telefon", "Telefónne číslo", "phone", 10, 0, 50, { shortLabel: "Telefón", isCollection: true }),
    f(4, "po_povinne", "po_kontakt", "email", "Email", "short_text", 20, 0, 50, { isCollection: true }),

    // ============================================================
    // PO: AML (po_aml) - 3 fields
    // ============================================================
    f(4, "po_doplnkove", "po_aml", "kuv_meno_1", "KUV 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "KUV 1 Meno", categoryCode: "aml" }),
    f(4, "po_doplnkove", "po_aml", "kuv_rc_1", "KUV 1 – Rodné číslo / IČO", "short_text", 20, 0, 30, { shortLabel: "KUV 1 RČ", categoryCode: "aml" }),
    f(4, "po_doplnkove", "po_aml", "kuv_podiel_1", "KUV 1 – % podiel", "desatinne_cislo", 30, 0, 30, { shortLabel: "KUV 1 %", unit: "%", categoryCode: "aml" }),

    // ============================================================
    // PO: Zákonné (po_zakonne) - 4 fields
    // ============================================================
    f(4, "po_doplnkove", "po_zakonne", "dic", "DIČ", "short_text", 10, 0, 50, { categoryCode: "zakonne" }),
    f(4, "po_doplnkove", "po_zakonne", "ic_dph", "IČ DPH", "short_text", 20, 0, 50, { categoryCode: "zakonne" }),
    f(4, "po_doplnkove", "po_zakonne", "suhlas_gdpr", "Súhlas GDPR", "switch", 30, 1, 50, { shortLabel: "GDPR", defaultValue: "false", categoryCode: "zakonne" }),
    f(4, "po_doplnkove", "po_zakonne", "suhlas_marketing", "Súhlas marketing", "switch", 40, 1, 50, { shortLabel: "Marketing", defaultValue: "false", categoryCode: "zakonne" }),

    // ============================================================
    // PO: Bankové (po_zmluvne) - 3 fields
    // ============================================================
    f(4, "po_doplnkove", "po_zmluvne", "iban", "IBAN", "short_text", 10, 0, 40, { categoryCode: "zmluvne" }),
    f(4, "po_doplnkove", "po_zmluvne", "bic", "BIC/SWIFT", "short_text", 20, 0, 30, { categoryCode: "zmluvne" }),
    f(4, "po_doplnkove", "po_zmluvne", "cislo_uctu", "Číslo účtu", "short_text", 30, 0, 30, { categoryCode: "zmluvne" }),

    // ============================================================
    // PO: Firemný profil (po_firemny) - 2 fields
    // ============================================================
    f(4, "po_doplnkove", "po_firemny", "obrat", "Obrat (ročný)", "desatinne_cislo", 10, 0, 50, { shortLabel: "Obrat", unit: "€", categoryCode: "firemny_profil" }),
    f(4, "po_doplnkove", "po_firemny", "pocet_zamestnancov", "Počet zamestnancov", "number", 20, 0, 50, { shortLabel: "Zamestnanci", decimalPlaces: 0, categoryCode: "firemny_profil" }),

    // ============================================================
    // PO: Štatutári (po_statutari) - 2 fields
    // ============================================================
    f(4, "po_doplnkove", "po_statutari", "statutar_meno_1", "Štatutár 1 – Meno", "short_text", 10, 0, 50, { shortLabel: "Štat. 1 Meno", categoryCode: "statutarne" }),
    f(4, "po_doplnkove", "po_statutari", "statutar_funkcia_1", "Štatutár 1 – Funkcia", "short_text", 20, 0, 50, { shortLabel: "Štat. 1 Funkcia", categoryCode: "statutarne" }),

    // ============================================================
    // PO: PZP (po_poistenie_pzp) - 8 fields (NEW)
    // ============================================================
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_cislo_poistky", "Číslo poistky PZP", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_poistovatel", "Poisťovateľ PZP", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_zaciatok", "Začiatok poistenia PZP", "date", 30, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_koniec", "Koniec poistenia PZP", "date", 40, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_rocne_poistne", "Ročné poistné PZP", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_bonus_malus", "Bonus/Malus stupeň", "short_text", 60, 1, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_predchadzajuca_poistovna", "Predchádzajúca poisťovňa PZP", "short_text", 70, 1, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_pzp", "po_pzp_pocet_skod", "Počet škodových udalostí", "number", 80, 1, 25, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // PO: Poistenie majetku (po_poistenie_majetok) - 11 fields (NEW)
    // ============================================================
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_cislo_poistky", "Číslo poistky majetku", "short_text", 10, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_poistovatel", "Poisťovateľ majetku", "short_text", 20, 0, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_typ", "Typ poistenia", "jedna_moznost", 30, 0, 25, { options: ["nehnuteľnosť", "domácnosť", "komplex"], categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_poistna_suma", "Poistná suma", "desatinne_cislo", 40, 0, 25, { unit: "€", categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_mesacne_poistne", "Mesačné poistné", "desatinne_cislo", 50, 1, 25, { unit: "€", categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_zaciatok", "Začiatok poistenia", "date", 60, 1, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_koniec", "Koniec poistenia", "date", 70, 1, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_adresa_poistenia", "Adresa poistenej nehnuteľnosti", "short_text", 80, 1, 25, { categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_typ_nehnutelnosti", "Typ nehnuteľnosti", "jedna_moznost", 90, 2, 33, { options: ["byt", "rodinný dom", "chata", "garáž"], categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_rozloha", "Rozloha m²", "number", 100, 2, 33, { unit: "m²", decimalPlaces: 0, categoryCode: "poistenie" }),
    f(4, "po_doplnkove", "po_poistenie_majetok", "po_maj_rok_vystavby", "Rok výstavby", "number", 110, 2, 34, { decimalPlaces: 0, categoryCode: "poistenie" }),

    // ============================================================
    // PO: Auto (po_auto) - 10 fields (NEW)
    // ============================================================
    f(4, "po_doplnkove", "po_auto", "po_auto_znacka", "Značka vozidla", "short_text", 10, 0, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_model", "Model vozidla", "short_text", 20, 0, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_rok", "Rok výroby", "number", 30, 0, 25, { decimalPlaces: 0, categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_objem", "Objem motora cm³", "number", 40, 0, 25, { unit: "cm³", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_vykon_kw", "Výkon kW", "number", 50, 1, 25, { unit: "kW", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_palivo", "Palivo", "jedna_moznost", 60, 1, 25, { options: ["benzín", "nafta", "LPG", "elektro", "hybrid"], categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_farba", "Farba vozidla", "short_text", 70, 1, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_pocet_km", "Počet najazdených km", "number", 80, 1, 25, { unit: "km", decimalPlaces: 0, categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_prvy_evid", "Dátum prvej evidencie", "date", 90, 2, 50, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_auto", "po_auto_ecv", "EČV", "short_text", 100, 2, 50, { categoryCode: "majetkove" }),

    // ============================================================
    // PO: Nehnuteľnosti (po_nehnutelnosti) - 9 fields (NEW)
    // ============================================================
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_typ", "Typ nehnuteľnosti", "jedna_moznost", 10, 0, 25, { options: ["byt", "rodinný dom", "pozemok", "komerčný objekt"], categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_adresa", "Adresa nehnuteľnosti", "short_text", 20, 0, 75, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_rozloha", "Rozloha m²", "desatinne_cislo", 30, 1, 33, { unit: "m²", categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_hodnota", "Trhová hodnota", "desatinne_cislo", 40, 1, 33, { unit: "€", categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_lv_cislo", "Číslo listu vlastníctva", "short_text", 50, 1, 34, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_parcela", "Parcela č.", "short_text", 60, 2, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_kataster", "Katastrálne územie", "short_text", 70, 2, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_druh_pozemku", "Druh pozemku", "short_text", 80, 2, 25, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_nehnutelnosti", "po_neh_tiarchy", "Ťarchy na nehnuteľnosti", "long_text", 90, 2, 25, { categoryCode: "majetkove" }),

    // ============================================================
    // PO: Flotila (po_flota) - 5 fields (NEW)
    // ============================================================
    f(4, "po_doplnkove", "po_flota", "flota_pocet", "Počet vozidiel", "number", 10, 0, 33, { decimalPlaces: 0, categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_flota", "flota_celkove_poistne", "Celkové ročné poistné", "desatinne_cislo", 20, 0, 33, { unit: "€", categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_flota", "flota_poistovatel", "Poisťovateľ flotily", "short_text", 30, 0, 34, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_flota", "flota_zmluva_od", "Zmluva platná od", "date", 40, 1, 50, { categoryCode: "majetkove" }),
    f(4, "po_doplnkove", "po_flota", "flota_zmluva_do", "Zmluva platná do", "date", 50, 1, 50, { categoryCode: "majetkove" }),

    // ============================================================
    // NS: Subjekt NS (ns_subjekt)
    // ============================================================
    f(5, "ns_povinne", "ns_subjekt", "nazov_organizacie", "Názov organizácie", "short_text", 10, 0, 50, { isRequired: true, shortLabel: "Názov org." }),
    f(5, "ns_povinne", "ns_subjekt", "ico", "IČO", "short_text", 20, 0, 50, { isRequired: true }),
    f(5, "ns_povinne", "ns_subjekt", "typ_organizacie", "Typ organizácie", "jedna_moznost", 30, 1, 100, { shortLabel: "Typ org.", options: ["Nadácia", "Nadačný fond", "Občianske združenie (OZ)", "Nezisková organizácia (NO)", "Neinvestičný fond", "Cirkevná organizácia", "Záujmové združenie právnických osôb", "Profesijná komora / Únia", "Politická strana / Hnutie", "Odborová organizácia", "Iné"], defaultValue: "Nezisková organizácia (NO)" }),

    // ============================================================
    // NS: Sídlo (ns_sidlo)
    // ============================================================
    f(5, "ns_povinne", "ns_sidlo", "sidlo_ulica", "Ulica (sídlo)", "short_text", 10, 0, 40, { isRequired: true, shortLabel: "Ulica" }),
    f(5, "ns_povinne", "ns_sidlo", "sidlo_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(5, "ns_povinne", "ns_sidlo", "sidlo_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { shortLabel: "Orient. č." }),
    f(5, "ns_povinne", "ns_sidlo", "sidlo_mesto", "Mesto/Obec", "short_text", 40, 1, 50, { isRequired: true }),
    f(5, "ns_povinne", "ns_sidlo", "sidlo_psc", "PSČ", "short_text", 50, 1, 25, {}),
    f(5, "ns_povinne", "ns_sidlo", "sidlo_stat", "Štát", "short_text", 60, 1, 25, {}),

    // ============================================================
    // NS: Kontakt (ns_kontakt)
    // ============================================================
    f(5, "ns_povinne", "ns_kontakt", "telefon", "Telefónne číslo (primárne)", "phone", 10, 0, 50, { shortLabel: "Tel. číslo" }),
    f(5, "ns_povinne", "ns_kontakt", "email", "Email (primárny)", "short_text", 20, 0, 50, { shortLabel: "Email" }),

    // ============================================================
    // NS: AML (ns_aml)
    // ============================================================
    f(5, "ns_doplnkove", "ns_aml", "kuv_meno_1", "KUV 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "KUV 1 Meno", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_rc_1", "KUV 1 – Rodné číslo", "short_text", 20, 0, 30, { shortLabel: "KUV 1 RČ", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_podiel_1", "KUV 1 – % podiel", "desatinne_cislo", 30, 0, 30, { shortLabel: "KUV 1 %", unit: "%", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_meno_2", "KUV 2 – Meno a priezvisko", "short_text", 40, 1, 40, { shortLabel: "KUV 2 Meno", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_rc_2", "KUV 2 – Rodné číslo", "short_text", 50, 1, 30, { shortLabel: "KUV 2 RČ", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_podiel_2", "KUV 2 – % podiel", "desatinne_cislo", 60, 1, 30, { shortLabel: "KUV 2 %", unit: "%", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_meno_3", "KUV 3 – Meno a priezvisko", "short_text", 70, 2, 40, { shortLabel: "KUV 3 Meno", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_rc_3", "KUV 3 – Rodné číslo", "short_text", 80, 2, 30, { shortLabel: "KUV 3 RČ", categoryCode: "aml" }),
    f(5, "ns_doplnkove", "ns_aml", "kuv_podiel_3", "KUV 3 – % podiel", "desatinne_cislo", 90, 2, 30, { shortLabel: "KUV 3 %", unit: "%", categoryCode: "aml" }),

    // ============================================================
    // NS: Zákonné (ns_zakonne)
    // ============================================================
    f(5, "ns_doplnkove", "ns_zakonne", "dic", "DIČ", "short_text", 10, 0, 50, { categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "suhlas_gdpr", "Súhlas so spracovaním osobných údajov (GDPR)", "switch", 30, 1, 50, { shortLabel: "GDPR súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "suhlas_marketing", "Súhlas s marketingovou komunikáciou", "switch", 40, 1, 50, { shortLabel: "Marketing súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "suhlas_tretie_strany", "Súhlas s poskytnutím údajov tretím stranám", "switch", 50, 2, 50, { shortLabel: "Tretie strany", defaultValue: "false", categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "suhlas_profilovanie", "Súhlas s automatizovaným profilovaním", "switch", 60, 2, 50, { shortLabel: "Profilovanie", defaultValue: "false", categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "poistna_povinnost", "Poistná povinnosť splnená", "switch", 70, 3, 50, { shortLabel: "Poistná pov.", defaultValue: "false", categoryCode: "zakonne" }),
    f(5, "ns_doplnkove", "ns_zakonne", "overenie_totoznosti", "Overenie totožnosti vykonané", "switch", 80, 3, 50, { shortLabel: "Overenie totoži.", defaultValue: "false", categoryCode: "zakonne" }),

    // ============================================================
    // NS: Bankové (ns_zmluvne)
    // ============================================================
    f(5, "ns_doplnkove", "ns_zmluvne", "iban", "IBAN", "short_text", 10, 0, 40, { categoryCode: "zmluvne" }),
    f(5, "ns_doplnkove", "ns_zmluvne", "bic", "BIC/SWIFT", "short_text", 20, 0, 30, { categoryCode: "zmluvne" }),
    f(5, "ns_doplnkove", "ns_zmluvne", "cislo_uctu", "Číslo účtu", "short_text", 30, 0, 30, { categoryCode: "zmluvne" }),

    // ============================================================
    // NS: Štatutári (ns_statutari)
    // ============================================================
    f(5, "ns_doplnkove", "ns_statutari", "statutar_meno_1", "Štatutár 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "Štatutár 1", categoryCode: "pravne" }),
    f(5, "ns_doplnkove", "ns_statutari", "statutar_funkcia_1", "Štatutár 1 – Funkcia", "short_text", 20, 0, 30, { shortLabel: "Funkcia 1", categoryCode: "pravne" }),
    f(5, "ns_doplnkove", "ns_statutari", "statutar_rc_1", "Štatutár 1 – Rodné číslo", "short_text", 30, 0, 30, { shortLabel: "Štatutár 1 RČ", categoryCode: "pravne" }),
    f(5, "ns_doplnkove", "ns_statutari", "statutar_meno_2", "Štatutár 2 – Meno a priezvisko", "short_text", 40, 1, 40, { shortLabel: "Štatutár 2", categoryCode: "pravne" }),
    f(5, "ns_doplnkove", "ns_statutari", "statutar_funkcia_2", "Štatutár 2 – Funkcia", "short_text", 50, 1, 30, { shortLabel: "Funkcia 2", categoryCode: "pravne" }),
    f(5, "ns_doplnkove", "ns_statutari", "statutar_rc_2", "Štatutár 2 – Rodné číslo", "short_text", 60, 1, 30, { shortLabel: "Štatutár 2 RČ", categoryCode: "pravne" }),

    // ============================================================
    // NS: Profil organizácie (ns_firemny)
    // ============================================================
    f(5, "ns_doplnkove", "ns_firemny", "ucel_organizacie", "Účel organizácie / Poslanie", "long_text", 10, 0, 100, { shortLabel: "Účel org.", categoryCode: "firemny_profil" }),
    f(5, "ns_doplnkove", "ns_firemny", "cislo_registracie_ns", "Číslo registrácie", "short_text", 20, 1, 50, { shortLabel: "Č. registrácie", categoryCode: "firemny_profil" }),
    f(5, "ns_doplnkove", "ns_firemny", "datum_registracie_ns", "Dátum registrácie", "date", 30, 1, 50, { shortLabel: "Dát. reg.", categoryCode: "firemny_profil" }),
    f(5, "ns_doplnkove", "ns_firemny", "pocet_zamestnancov_ns", "Počet zamestnancov / dobrovoľníkov", "number", 40, 2, 50, { shortLabel: "Zamestnanci", decimalPlaces: 0, categoryCode: "firemny_profil" }),

    // ============================================================
    // VS: Subjekt VS (vs_subjekt)
    // ============================================================
    f(6, "vs_povinne", "vs_subjekt", "nazov_organizacie", "Názov inštitúcie", "short_text", 10, 0, 50, { isRequired: true, shortLabel: "Názov inšt." }),
    f(6, "vs_povinne", "vs_subjekt", "ico", "IČO", "short_text", 20, 0, 50, { isRequired: true }),
    f(6, "vs_povinne", "vs_subjekt", "typ_institucie", "Typ inštitúcie", "jedna_moznost", 30, 1, 50, { shortLabel: "Typ inšt.", options: ["Ministerstvo", "Ústredný orgán štátnej správy", "Krajský úrad", "Okresný úrad", "Obec / Mesto", "Magistrát", "Vyšší územný celok (VÚC)", "Štátna inštitúcia", "Štátna príspevková organizácia", "Rozpočtová organizácia", "Štátny podnik", "Verejnoprávna inštitúcia", "Iné"], defaultValue: "Štátna inštitúcia" }),
    f(6, "vs_povinne", "vs_subjekt", "uroven_verejnej_spravy", "Úroveň verejnej správy", "jedna_moznost", 40, 1, 50, { shortLabel: "Úroveň VS", options: ["Ústredná (štátna) správa", "Regionálna (VÚC)", "Miestna (obecná/mestská)", "Európska inštitúcia", "Iné"] }),

    // ============================================================
    // VS: Sídlo (vs_sidlo)
    // ============================================================
    f(6, "vs_povinne", "vs_sidlo", "sidlo_ulica", "Ulica (sídlo)", "short_text", 10, 0, 40, { isRequired: true, shortLabel: "Ulica" }),
    f(6, "vs_povinne", "vs_sidlo", "sidlo_supisne", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súpisné č." }),
    f(6, "vs_povinne", "vs_sidlo", "sidlo_orientacne", "Orientačné číslo", "short_text", 30, 0, 30, { shortLabel: "Orient. č." }),
    f(6, "vs_povinne", "vs_sidlo", "sidlo_mesto", "Mesto/Obec", "short_text", 40, 1, 50, { isRequired: true }),
    f(6, "vs_povinne", "vs_sidlo", "sidlo_psc", "PSČ", "short_text", 50, 1, 25, {}),
    f(6, "vs_povinne", "vs_sidlo", "sidlo_stat", "Štát", "short_text", 60, 1, 25, {}),

    // ============================================================
    // VS: Kontakt (vs_kontakt)
    // ============================================================
    f(6, "vs_povinne", "vs_kontakt", "telefon", "Telefónne číslo (primárne)", "phone", 10, 0, 50, { shortLabel: "Tel. číslo" }),
    f(6, "vs_povinne", "vs_kontakt", "email", "Email (primárny)", "short_text", 20, 0, 50, { shortLabel: "Email" }),

    // ============================================================
    // VS: AML (vs_aml)
    // ============================================================
    f(6, "vs_doplnkove", "vs_aml", "kuv_meno_1", "KUV 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "KUV 1 Meno", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_rc_1", "KUV 1 – Rodné číslo", "short_text", 20, 0, 30, { shortLabel: "KUV 1 RČ", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_podiel_1", "KUV 1 – % podiel", "desatinne_cislo", 30, 0, 30, { shortLabel: "KUV 1 %", unit: "%", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_meno_2", "KUV 2 – Meno a priezvisko", "short_text", 40, 1, 40, { shortLabel: "KUV 2 Meno", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_rc_2", "KUV 2 – Rodné číslo", "short_text", 50, 1, 30, { shortLabel: "KUV 2 RČ", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_podiel_2", "KUV 2 – % podiel", "desatinne_cislo", 60, 1, 30, { shortLabel: "KUV 2 %", unit: "%", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_meno_3", "KUV 3 – Meno a priezvisko", "short_text", 70, 2, 40, { shortLabel: "KUV 3 Meno", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_rc_3", "KUV 3 – Rodné číslo", "short_text", 80, 2, 30, { shortLabel: "KUV 3 RČ", categoryCode: "aml" }),
    f(6, "vs_doplnkove", "vs_aml", "kuv_podiel_3", "KUV 3 – % podiel", "desatinne_cislo", 90, 2, 30, { shortLabel: "KUV 3 %", unit: "%", categoryCode: "aml" }),

    // ============================================================
    // VS: Zákonné (vs_zakonne)
    // ============================================================
    f(6, "vs_doplnkove", "vs_zakonne", "dic", "DIČ", "short_text", 10, 0, 50, { categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "suhlas_gdpr", "Súhlas so spracovaním osobných údajov (GDPR)", "switch", 30, 1, 50, { shortLabel: "GDPR súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "suhlas_marketing", "Súhlas s marketingovou komunikáciou", "switch", 40, 1, 50, { shortLabel: "Marketing súhlas", defaultValue: "false", categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "suhlas_tretie_strany", "Súhlas s poskytnutím údajov tretím stranám", "switch", 50, 2, 50, { shortLabel: "Tretie strany", defaultValue: "false", categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "suhlas_profilovanie", "Súhlas s automatizovaným profilovaním", "switch", 60, 2, 50, { shortLabel: "Profilovanie", defaultValue: "false", categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "poistna_povinnost", "Poistná povinnosť splnená", "switch", 70, 3, 50, { shortLabel: "Poistná pov.", defaultValue: "false", categoryCode: "zakonne" }),
    f(6, "vs_doplnkove", "vs_zakonne", "overenie_totoznosti", "Overenie totožnosti vykonané", "switch", 80, 3, 50, { shortLabel: "Overenie totoži.", defaultValue: "false", categoryCode: "zakonne" }),

    // ============================================================
    // VS: Bankové (vs_zmluvne)
    // ============================================================
    f(6, "vs_doplnkove", "vs_zmluvne", "iban", "IBAN", "short_text", 10, 0, 40, { categoryCode: "zmluvne" }),
    f(6, "vs_doplnkove", "vs_zmluvne", "bic", "BIC/SWIFT", "short_text", 20, 0, 30, { categoryCode: "zmluvne" }),
    f(6, "vs_doplnkove", "vs_zmluvne", "cislo_uctu", "Číslo účtu", "short_text", 30, 0, 30, { categoryCode: "zmluvne" }),

    // ============================================================
    // VS: Štatutári (vs_statutari)
    // ============================================================
    f(6, "vs_doplnkove", "vs_statutari", "statutar_meno_1", "Štatutár 1 – Meno a priezvisko", "short_text", 10, 0, 40, { shortLabel: "Štatutár 1", categoryCode: "pravne" }),
    f(6, "vs_doplnkove", "vs_statutari", "statutar_funkcia_1", "Štatutár 1 – Funkcia", "short_text", 20, 0, 30, { shortLabel: "Funkcia 1", categoryCode: "pravne" }),
    f(6, "vs_doplnkove", "vs_statutari", "statutar_rc_1", "Štatutár 1 – Rodné číslo", "short_text", 30, 0, 30, { shortLabel: "Štatutár 1 RČ", categoryCode: "pravne" }),
    f(6, "vs_doplnkove", "vs_statutari", "statutar_meno_2", "Štatutár 2 – Meno a priezvisko", "short_text", 40, 1, 40, { shortLabel: "Štatutár 2", categoryCode: "pravne" }),
    f(6, "vs_doplnkove", "vs_statutari", "statutar_funkcia_2", "Štatutár 2 – Funkcia", "short_text", 50, 1, 30, { shortLabel: "Funkcia 2", categoryCode: "pravne" }),
    f(6, "vs_doplnkove", "vs_statutari", "statutar_rc_2", "Štatutár 2 – Rodné číslo", "short_text", 60, 1, 30, { shortLabel: "Štatutár 2 RČ", categoryCode: "pravne" }),

    // ============================================================
    // VS: Inštitucionálny profil (vs_inst_profil)
    // ============================================================
    f(6, "vs_doplnkove", "vs_inst_profil", "nadriadeny_organ", "Nadriadený orgán / Zriaďovateľ", "short_text", 10, 0, 100, { shortLabel: "Nadr. orgán", categoryCode: "firemny_profil" }),
    f(6, "vs_doplnkove", "vs_inst_profil", "typ_financovania", "Typ financovania", "jedna_moznost", 20, 1, 50, { shortLabel: "Typ financ.", options: ["Rozpočtová organizácia", "Príspevková organizácia", "Iné"], categoryCode: "firemny_profil" }),
    f(6, "vs_doplnkove", "vs_inst_profil", "rozpoctova_kapitola_vs", "Rozpočtová kapitola", "short_text", 30, 1, 50, { shortLabel: "Rozp. kap.", categoryCode: "firemny_profil" }),

    // ============================================================
    // OS: Základné údaje (os_subjekt)  – conditional on OS_CLIENT_TYPE_ID
    // Row 0 (100%): nazov_organizacie(50) + ico(50)
    // Row 1 (100%): specifikacia_os(100) – segmented control
    // Row 2–4 (Cirkev): nazov_cirkvi_institucie(50)+registracia_mk_sr(50),
    //                   ico_cirkvi(33)+dic_cirkvi(33)+ic_dph_cirkvi(34),
    //                   datum_zriadenia(50)+zriadovatel_dieceza(50)
    // ============================================================
    ...(OS_CLIENT_TYPE_ID ? [
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "nazov_organizacie", "Názov subjektu", "short_text", 10, 0, 50, { isRequired: true, shortLabel: "Názov" }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "ico", "IČO", "short_text", 20, 0, 50, { isRequired: true }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "specifikacia_os", "Špecifikácia OS", "segmented", 30, 1, 100, { shortLabel: "Špecifikácia", options: ["Cirkev a náboženská spoločnosť", "Spoločenstvo vlastníkov bytov (SVB)", "Zahraničná osoba", "Organizačná zložka", "Konzorcium / Združenie", "Iný špecifický subjekt"] }),
      // Cirkev-specific rows in os_subjekt (visibilityRule on all)
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "nazov_cirkvi_institucie", "Názov cirkvi / inštitúcie", "short_text", 40, 2, 50, { shortLabel: "Názov cirkvi", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "registracia_mk_sr", "Registrácia MK SR", "short_text", 50, 2, 50, { shortLabel: "Regist. MK SR", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "ico_cirkvi", "IČO cirkvi", "short_text", 60, 3, 33, { shortLabel: "IČO cirkvi", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "dic_cirkvi", "DIČ cirkvi", "short_text", 70, 3, 33, { shortLabel: "DIČ cirkvi", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "ic_dph_cirkvi", "IČ DPH cirkvi", "short_text", 80, 3, 34, { shortLabel: "IČ DPH", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "datum_zriadenia", "Dátum zriadenia", "date", 90, 4, 50, { shortLabel: "Dátum zriad.", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "zriadovatel_dieceza", "Zriaďovateľ / Diecéza", "short_text", 100, 4, 50, { shortLabel: "Zriaď. / Diecéza", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      // SVB-specific rows in os_subjekt (rows 2–4, sortOrders 110–170)
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "nazov_svb", "Názov SVB", "short_text", 110, 2, 50, { shortLabel: "Názov SVB", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "registracia_ou_svb", "Registrácia na Okresnom úrade", "short_text", 120, 2, 50, { shortLabel: "Regist. OÚ", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "ico_svb", "IČO", "short_text", 130, 3, 33, { shortLabel: "IČO", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "dic_svb", "DIČ", "short_text", 140, 3, 33, { shortLabel: "DIČ", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "ic_dph_svb", "IČ DPH", "short_text", 150, 3, 34, { shortLabel: "IČ DPH", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "datum_vzniku_svb", "Dátum vzniku", "date", 160, 4, 50, { shortLabel: "Dátum vzniku", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "zmluva_o_spolocenstve_datum", "Zmluva o spoločenstve zo dňa", "date", 170, 4, 50, { shortLabel: "Zmluva zo dňa", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Správa a riadenie (os_riadenie) – SVB only
      // Row 0: forma_spravy(50) + nazov_spravcu(50)
      // Row 1: cislo_zmluvy_o_sprave(50) + datum_uzatvorenia_spravy(50)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_riadenie", "forma_spravy", "Forma správy", "jedna_moznost", 10, 0, 50, { shortLabel: "Forma správy", options: ["Vlastná správa", "Externý správca"], visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_riadenie", "nazov_spravcu", "Názov správcu", "short_text", 20, 0, 50, { shortLabel: "Názov správcu", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_riadenie", "cislo_zmluvy_o_sprave", "Číslo zmluvy o správe", "short_text", 30, 1, 50, { shortLabel: "Č. zmluvy", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_riadenie", "datum_uzatvorenia_spravy", "Dátum uzatvorenia zmluvy", "date", 40, 1, 50, { shortLabel: "Dátum zmluvy", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Údaje o bytovom dome (os_bytovy_dom) – SVB only
      // Row 0: katastralne_uzemie_svb(50) + cislo_lv_svb(50)
      // Row 1: pocet_bytov(33) + pocet_nebytovych_priestorov(33) + supisne_cisla_domu(34)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_bytovy_dom", "katastralne_uzemie_svb", "Katastrálne územie", "short_text", 10, 0, 50, { shortLabel: "Kat. územie", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_bytovy_dom", "cislo_lv_svb", "Číslo listu vlastníctva", "short_text", 20, 0, 50, { shortLabel: "Č. LV", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_bytovy_dom", "pocet_bytov", "Počet bytov", "number", 30, 1, 33, { shortLabel: "Počet bytov", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_bytovy_dom", "pocet_nebytovych_priestorov", "Počet nebyt. priestorov", "number", 40, 1, 33, { shortLabel: "Neb. priestory", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_bytovy_dom", "supisne_cisla_domu", "Súpisné čísla", "short_text", 50, 1, 34, { shortLabel: "Súp. čísla", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Rozšírené cirkevné údaje (os_cirkev)
      // Row 0: typ_cirkevnej_organizacie(50) + dekanat_seniorat(50)
      // Row 1: patrocinium_titular_kostola(100)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_cirkev", "typ_cirkevnej_organizacie", "Typ cirkevnej organizácie", "jedna_moznost", 10, 0, 50, { shortLabel: "Typ org.", options: ["Farnosť", "Diecéza", "Rehoľa", "Charita", "Iné"], visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_cirkev", "dekanat_seniorat", "Dekanát / Seniorát", "short_text", 20, 0, 50, { shortLabel: "Dekanát", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_cirkev", "patrocinium_titular_kostola", "Patrocínium / Titulár kostola", "short_text", 30, 1, 100, { shortLabel: "Patrocínium", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),

      // ============================================================
      // OS: Sídlo / Adresa (os_sidlo) – Cirkev fields
      // Row 0: ulica(40) + supisne_cislo(30) + orientacne_cislo(30)
      // Row 1: mesto(50) + psc(25) + stat(25)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "ulica", "Ulica", "short_text", 10, 0, 40, { visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "supisne_cislo", "Súpisné číslo", "short_text", 20, 0, 30, { shortLabel: "Súp. č.", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "orientacne_cislo", "Orientačné číslo", "short_text", 30, 0, 30, { shortLabel: "Or. č.", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "mesto", "Mesto", "short_text", 40, 1, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "psc", "PSČ", "short_text", 50, 1, 25, { visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "stat", "Štát", "short_text", 60, 1, 25, { visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      // SVB: Sídlo / Adresa – sortOrders 110–160
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "ulica_svb", "Ulica", "short_text", 110, 0, 40, { visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "supisne_cislo_svb", "Súpisné číslo", "short_text", 120, 0, 30, { shortLabel: "Súp. č.", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "orientacne_cislo_svb", "Orientačné číslo", "short_text", 130, 0, 30, { shortLabel: "Or. č.", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "mesto_svb", "Mesto", "short_text", 140, 1, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "psc_svb", "PSČ", "short_text", 150, 1, 25, { visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo", "stat_svb", "Štát", "short_text", 160, 1, 25, { visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Kontaktné údaje (os_kontakt) – Cirkev fields
      // Row 0: telefon_farnost(50) + email_farnost(50)
      // Row 1: webova_stranka(100)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "telefon_farnost", "Telefón farnosti", "short_text", 10, 0, 50, { shortLabel: "Telefón", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "email_farnost", "E-mail farnosti", "short_text", 20, 0, 50, { shortLabel: "E-mail", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "webova_stranka", "Webová stránka", "short_text", 30, 1, 100, { shortLabel: "Web", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      // SVB: Kontaktné údaje – sortOrders 110–130
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "telefon_svb", "Telefón", "short_text", 110, 0, 50, { shortLabel: "Telefón", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "email_svb", "E-mail", "short_text", 120, 0, 50, { shortLabel: "E-mail", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "portal_vlastnikov", "Webový portál pre vlastníkov", "short_text", 130, 1, 100, { shortLabel: "Portál", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Bankové spojenie (os_banka) – Cirkev fields
      // Row 0: iban(50) + swift_bic(50)
      // Row 1: nazov_banky(100)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "iban", "IBAN", "short_text", 10, 0, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "swift_bic", "SWIFT / BIC", "short_text", 20, 0, 50, { shortLabel: "SWIFT/BIC", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "nazov_banky", "Názov banky", "short_text", 30, 1, 100, { shortLabel: "Banka", visibilityRule: { dependsOn: "specifikacia_os", value: "Cirkev a náboženská spoločnosť" } }),
      // SVB: Bankové spojenie – sortOrders 110–130
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "iban_svb", "IBAN", "short_text", 110, 0, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "swift_svb", "SWIFT / BIC", "short_text", 120, 0, 50, { shortLabel: "SWIFT/BIC", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "nazov_banky_svb", "Názov banky", "short_text", 130, 1, 100, { shortLabel: "Banka", visibilityRule: { dependsOn: "specifikacia_os", value: "Spoločenstvo vlastníkov bytov (SVB)" } }),

      // ============================================================
      // OS: Zahraničná osoba – os_subjekt rows 2–4 (sortOrders 210–270)
      // R2: obchodne_meno_zahranicne(50) + pravna_forma_zahranicna(50)
      // R3: registracne_cislo_zahranicne(33) + krajina_povodu(33) + vat_id_zahranicne(34)
      // R4: datum_vzniku_zahranicnej(50) + nazov_zahranicneho_registra(50)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "obchodne_meno_zahranicne", "Pôvodné obchodné meno", "short_text", 210, 2, 50, { shortLabel: "Obch. meno", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "pravna_forma_zahranicna", "Právna forma v krajine pôvodu", "short_text", 220, 2, 50, { shortLabel: "Právna forma", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "registracne_cislo_zahranicne", "Identifikátor / Registration No.", "short_text", 230, 3, 33, { shortLabel: "Reg. číslo", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "krajina_povodu", "Krajina registrácie", "short_text", 240, 3, 33, { shortLabel: "Krajina", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "vat_id_zahranicne", "Daňové číslo / VAT ID", "short_text", 250, 3, 34, { shortLabel: "VAT ID", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "datum_vzniku_zahranicnej", "Dátum vzniku", "date", 260, 4, 50, { shortLabel: "Dátum vzniku", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_subjekt", "nazov_zahranicneho_registra", "Názov registra v domovskej krajine", "short_text", 270, 4, 50, { shortLabel: "Názov registra", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),

      // ============================================================
      // OS: Sídlo v domovskej krajine (os_sidlo_zahranicie) – Zahraničná osoba only
      // R0: ulica_zahranicie(40) + cislo_zahranicie(30) + psc_zahranicie(30)
      // R1: mesto_zahranicie(50) + stat_provincia(50)
      // ============================================================
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo_zahranicie", "ulica_zahranicie", "Ulica", "short_text", 10, 0, 40, { visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo_zahranicie", "cislo_zahranicie", "Číslo domu / orientačné", "short_text", 20, 0, 30, { shortLabel: "Č. domu", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo_zahranicie", "psc_zahranicie", "ZIP / PSČ", "short_text", 30, 0, 30, { shortLabel: "ZIP/PSČ", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo_zahranicie", "mesto_zahranicie", "Mesto", "short_text", 40, 1, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_sidlo_zahranicie", "stat_provincia", "Štát / Provincia / Región", "short_text", 50, 1, 50, { shortLabel: "Štát / Provincia", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),

      // Zahraničná osoba: Kontaktné údaje – sortOrders 210–230
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "telefon_zahranicie", "Telefón", "short_text", 210, 0, 50, { shortLabel: "Telefón", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "email_zahranicie", "E-mail", "short_text", 220, 0, 50, { shortLabel: "E-mail", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_povinne", "os_kontakt", "web_zahranicie", "Webová stránka", "short_text", 230, 1, 100, { shortLabel: "Web", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),

      // Zahraničná osoba: Bankové spojenie – sortOrders 210–230
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "iban_zahranicne", "IBAN", "short_text", 210, 0, 50, { visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "swift_bic_zahranicne", "SWIFT / BIC", "short_text", 220, 0, 50, { shortLabel: "SWIFT/BIC", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "nazov_banky_zahranicie", "Názov banky", "short_text", 230, 1, 50, { shortLabel: "Banka", visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
      f(OS_CLIENT_TYPE_ID, "os_doplnkove", "os_banka", "mena_uctu", "Mena účtu", "jedna_moznost", 240, 1, 50, { shortLabel: "Mena", options: ["EUR", "USD", "GBP", "CHF", "Ostatné"], visibilityRule: { dependsOn: "specifikacia_os", value: "Zahraničná osoba" } }),
    ] : []),
  ];

  const paramIdMap: Record<string, number> = {};
  const allInsertedParams: number[] = [];

  let existingParamKeys: Set<string> = new Set();
  if (onlyMissing) {
    const existingParams = await db.select({ clientTypeId: subjectParameters.clientTypeId, fieldKey: subjectParameters.fieldKey }).from(subjectParameters);
    existingParamKeys = new Set(existingParams.map(p => `${p.clientTypeId}:${p.fieldKey}`));

    if (existingParamKeys.has("6:typ_organizacie") && !existingParamKeys.has("6:typ_institucie")) {
      await db.update(subjectParameters)
        .set({ fieldKey: "typ_institucie", code: "p_typ_institucie" })
        .where(and(eq(subjectParameters.clientTypeId, 6), eq(subjectParameters.fieldKey, "typ_organizacie")));
      existingParamKeys.delete("6:typ_organizacie");
      existingParamKeys.add("6:typ_institucie");
      console.log("[SEED] Migrated VS typ_organizacie → typ_institucie");
    }

    // Migration #99: Move FO personal fields from panel fo_osobne_udaje (panel 55)
    // to panel fo_osobne (panel 87) and fix all row widths to sum to 100%.
    // Panel 55 is renamed to "Rozšírené osobné údaje" to avoid name collision.
    // Each update is independently idempotent via its own WHERE condition.
    {
      const panelOsobne = sectionMap["fo_osobne"];          // panel 87
      const panelRozsirene = sectionMap["fo_osobne_udaje"]; // panel 55
      if (panelOsobne && panelRozsirene) {
        // Fields to move from panel 55 → panel 87 (each guarded by panelId=panelRozsirene)
        const movedFrom55 = await Promise.all([
          db.update(subjectParameters)
            .set({ panelId: panelOsobne, sortOrder: 80, rowNumber: 2, widthPercent: 25 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "pohlavie"), eq(subjectParameters.panelId, panelRozsirene)))
            .returning({ id: subjectParameters.id }),
          db.update(subjectParameters)
            .set({ panelId: panelOsobne, sortOrder: 85, rowNumber: 2, widthPercent: 25 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "rodinny_stav"), eq(subjectParameters.panelId, panelRozsirene)))
            .returning({ id: subjectParameters.id }),
          db.update(subjectParameters)
            .set({ panelId: panelOsobne, sortOrder: 100, rowNumber: 3, widthPercent: 40 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "rodne_priezvisko"), eq(subjectParameters.panelId, panelRozsirene)))
            .returning({ id: subjectParameters.id }),
          db.update(subjectParameters)
            .set({ panelId: panelOsobne, sortOrder: 105, rowNumber: 3, widthPercent: 40 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "miesto_narodenia"), eq(subjectParameters.panelId, panelRozsirene)))
            .returning({ id: subjectParameters.id }),
        ]);
        // Fix layout of fields already in panel 87 (guarded by panelId=panelOsobne)
        await Promise.all([
          db.update(subjectParameters)
            .set({ sortOrder: 90, rowNumber: 3, widthPercent: 20 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "vek"), eq(subjectParameters.panelId, panelOsobne))),
          db.update(subjectParameters)
            .set({ sortOrder: 110, rowNumber: 4, widthPercent: 100 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "statna_prislusnost"), eq(subjectParameters.panelId, panelOsobne))),
        ]);
        // Fix row assignments for remaining panel 55 fields (guarded by panelId=panelRozsirene)
        await Promise.all([
          db.update(subjectParameters)
            .set({ sortOrder: 10, rowNumber: 1, widthPercent: 50 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "p_predch_priezvisko"), eq(subjectParameters.panelId, panelRozsirene))),
          db.update(subjectParameters)
            .set({ sortOrder: 20, rowNumber: 1, widthPercent: 50 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "p_druhe_obcianstvo"), eq(subjectParameters.panelId, panelRozsirene))),
          db.update(subjectParameters)
            .set({ sortOrder: 30, rowNumber: 2, widthPercent: 50 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "p_krajina_narodenia"), eq(subjectParameters.panelId, panelRozsirene))),
          db.update(subjectParameters)
            .set({ sortOrder: 40, rowNumber: 2, widthPercent: 50 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "p_matersky_jazyk"), eq(subjectParameters.panelId, panelRozsirene))),
          db.update(subjectParameters)
            .set({ sortOrder: 50, rowNumber: 3, widthPercent: 100 })
            .where(and(eq(subjectParameters.clientTypeId, 1), eq(subjectParameters.fieldKey, "p_pocet_deti"), eq(subjectParameters.panelId, panelRozsirene))),
        ]);
        // Rename panel 55 (idempotent – SET is a no-op if already correct)
        await db.update(subjectParamSections)
          .set({ name: "Rozšírené osobné údaje" })
          .where(eq(subjectParamSections.id, panelRozsirene));
        const movedCount = movedFrom55.filter(r => r.length > 0).length;
        if (movedCount > 0) {
          console.log(`[SEED] Migration #99: moved ${movedCount} FO field(s) to fo_osobne, fixed row widths, renamed fo_osobne_udaje`);
        }
      }
    }
  }

  for (const field of FIELDS) {
    const mapKey = `${field.clientTypeId}:${field.fieldKey}`;
    if (onlyMissing && existingParamKeys.has(mapKey)) continue;
    const sectionId = field.sectionCode ? sectionMap[field.sectionCode] : null;
    const panelId = field.panelCode ? sectionMap[field.panelCode] : null;
    const [inserted] = await db.insert(subjectParameters).values({
      clientTypeId: field.clientTypeId,
      sectionId: sectionId || null,
      panelId: panelId || null,
      fieldKey: field.fieldKey,
      code: `p_${field.fieldKey}`,
      label: field.label,
      shortLabel: field.shortLabel || null,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isHidden: field.isHidden,
      isCollection: field.isCollection,
      extractionHints: field.extractionHints,
      options: field.options as any,
      defaultValue: field.defaultValue,
      visibilityRule: field.visibilityRule as any,
      unit: field.unit,
      decimalPlaces: field.decimalPlaces,
      fieldCategory: field.fieldCategory,
      categoryCode: field.categoryCode || null,
      sortOrder: field.sortOrder,
      rowNumber: field.rowNumber,
      widthPercent: field.widthPercent,
    } as any).returning();
    allInsertedParams.push(inserted.id);
    paramIdMap[mapKey] = inserted.id;
  }

  const SYNONYM_DEFS: Record<string, string[]> = {
    "meno": ["krstné meno", "first name", "meno klienta", "given name"],
    "priezvisko": ["family name", "surname", "priezvisko klienta"],
    "rodne_cislo": ["RČ", "birth number", "osobné číslo", "rodné číslo klienta"],
    "datum_narodenia": ["dátum nar.", "born", "date of birth", "DOB"],
    "telefon": ["tel", "telefónne č.", "mobile", "mobil", "kontaktné číslo"],
    "email": ["e-mail", "mail", "emailová adresa", "elektronická pošta"],
    "tp_ulica": ["ulica bydliska", "street", "adresa - ulica"],
    "tp_mesto": ["mesto bydliska", "city", "obec"],
    "tp_psc": ["poštové smerovacie číslo", "ZIP", "postal code"],
    "ico": ["identifikačné číslo", "company ID", "IČ"],
    "dic": ["daňové identifikačné číslo", "tax ID", "DIČ"],
    "iban": ["bankový účet", "číslo účtu", "account number"],
    "cislo_dokladu": ["číslo OP", "ID card number", "č. dokladu"],
    "spz": ["evidenčné číslo", "EČV", "license plate", "ŠPZ vozidla"],
    "vin": ["číslo karosérie", "vehicle identification number", "VIN číslo"],
    "pzp_cislo_poistky": ["číslo PZP", "policy number PZP"],
    "ziv_cislo_poistky": ["číslo ŽP", "life policy number"],
    "auto_znacka": ["značka auta", "car brand", "výrobca vozidla"],
    "auto_ecv": ["evidenčné číslo vozidla", "ŠPZ", "registration number"],
    "neh_lv_cislo": ["list vlastníctva", "LV", "vlastnícky list"],
    "rodinny_stav": ["manželský stav", "marital status", "stav", "rodinný stav klienta"],
    "sds_dss": ["DSS", "dôchodková správcovská spoločnosť", "II. pilier správca", "pension fund company"],
    "sds_cislo_zmluvy": ["číslo zmluvy SDS", "SDS contract number", "zmluva II. pilier"],
    "dds_spolocnost": ["DDS spoločnosť", "III. pilier správca", "doplnkové dôchodkové"],
    "dds_cislo_zmluvy": ["číslo zmluvy DDS", "DDS contract number", "zmluva III. pilier"],
    "nazov_firmy": ["obchodné meno", "company name", "firma", "názov spoločnosti"],
    "sidlo_ulica": ["ulica sídla", "registered street", "sídlo - ulica"],
    "sidlo_mesto": ["mesto sídla", "registered city", "sídlo - mesto"],
    "obrat": ["ročný obrat", "revenue", "turnover", "annual revenue"],
  };

  let synonymsCount = 0;
  const synonymValues: { parameterId: number; synonym: string; language: string; source: string; confidence: number }[] = [];

  for (const [fieldKey, synonyms] of Object.entries(SYNONYM_DEFS)) {
    const clientTypeIds = [1, 3, 4, 5, 6];
    for (const ctId of clientTypeIds) {
      const paramId = paramIdMap[`${ctId}:${fieldKey}`];
      if (paramId) {
        for (const syn of synonyms) {
          synonymValues.push({
            parameterId: paramId,
            synonym: syn,
            language: "sk",
            source: "manual",
            confidence: 100,
          });
        }
      }
    }
  }

  for (let i = 0; i < synonymValues.length; i += 50) {
    const batch = synonymValues.slice(i, i + 50);
    await db.insert(parameterSynonyms).values(batch);
    synonymsCount += batch.length;
  }

  console.log(`[SEED] Synced params=${allInsertedParams.length}, synonyms=${synonymsCount}`);

  return {
    sectionsCount: onlyMissing ? Object.keys(sectionMap).length : STATIC_SECTIONS.length,
    parametersCount: allInsertedParams.length,
    synonymsCount,
  };
}

export async function seedSubjectParameters(): Promise<{ sectionsCount: number; parametersCount: number; synonymsCount: number }> {
  return _runSubjectParameterSync(false);
}

export async function syncSubjectParameters(): Promise<{ sectionsCount: number; parametersCount: number; synonymsCount: number }> {
  return _runSubjectParameterSync(true);
}

export async function seedAssetPanels(): Promise<{ sectionsCount: number; parametersCount: number }> {
  const checkExisting = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
    .where(eq(subjectParamSections.code, "fo_spec_aktiva")).limit(1);
  if (checkExisting.length > 0) {
    console.log("[SEED] Asset panels already exist, skipping.");
    return { sectionsCount: 0, parametersCount: 0 };
  }

  const foVolSection = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
    .where(eq(subjectParamSections.code, "fo_volitelne")).limit(1);
  const szcoVolSection = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
    .where(eq(subjectParamSections.code, "szco_volitelne")).limit(1);
  const poVolSection = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
    .where(eq(subjectParamSections.code, "po_volitelne")).limit(1);

  let foVolId: number, szcoVolId: number, poVolId: number;

  if (foVolSection.length === 0) {
    const [foVol] = await db.insert(subjectParamSections).values({
      clientTypeId: 1, name: "VOLITEĽNÉ ÚDAJE", code: "fo_volitelne", folderCategory: "volitelne", sortOrder: 3, isPanel: false, gridColumns: 1
    }).returning({ id: subjectParamSections.id });
    foVolId = foVol.id;
  } else { foVolId = foVolSection[0].id; }

  if (szcoVolSection.length === 0) {
    const [szcoVol] = await db.insert(subjectParamSections).values({
      clientTypeId: 3, name: "VOLITEĽNÉ ÚDAJE", code: "szco_volitelne", folderCategory: "volitelne", sortOrder: 3, isPanel: false, gridColumns: 1
    }).returning({ id: subjectParamSections.id });
    szcoVolId = szcoVol.id;
  } else { szcoVolId = szcoVolSection[0].id; }

  if (poVolSection.length === 0) {
    const [poVol] = await db.insert(subjectParamSections).values({
      clientTypeId: 4, name: "VOLITEĽNÉ ÚDAJE", code: "po_volitelne", folderCategory: "volitelne", sortOrder: 3, isPanel: false, gridColumns: 1
    }).returning({ id: subjectParamSections.id });
    poVolId = poVol.id;
  } else { poVolId = poVolSection[0].id; }

  const panelInserts = [
    { clientTypeId: 1, name: "⛵ Špeciálne aktíva", code: "fo_spec_aktiva", folderCategory: "volitelne", sortOrder: 0, isPanel: true, parentSectionId: foVolId, gridColumns: 3 },
    { clientTypeId: 1, name: "💎 Špecifické riziká", code: "fo_spec_rizika", folderCategory: "volitelne", sortOrder: 1, isPanel: true, parentSectionId: foVolId, gridColumns: 3 },
    { clientTypeId: 3, name: "⛵ Špeciálne aktíva", code: "szco_spec_aktiva", folderCategory: "volitelne", sortOrder: 0, isPanel: true, parentSectionId: szcoVolId, gridColumns: 3 },
    { clientTypeId: 3, name: "🏗️ Firemné portfólio", code: "szco_firemne_portfolio", folderCategory: "volitelne", sortOrder: 1, isPanel: true, parentSectionId: szcoVolId, gridColumns: 3 },
    { clientTypeId: 3, name: "💎 Špecifické riziká", code: "szco_spec_rizika", folderCategory: "volitelne", sortOrder: 2, isPanel: true, parentSectionId: szcoVolId, gridColumns: 3 },
    { clientTypeId: 4, name: "⛵ Špeciálne aktíva", code: "po_spec_aktiva", folderCategory: "volitelne", sortOrder: 0, isPanel: true, parentSectionId: poVolId, gridColumns: 3 },
    { clientTypeId: 4, name: "🏗️ Firemné portfólio", code: "po_firemne_portfolio", folderCategory: "volitelne", sortOrder: 1, isPanel: true, parentSectionId: poVolId, gridColumns: 3 },
    { clientTypeId: 4, name: "💎 Špecifické riziká", code: "po_spec_rizika", folderCategory: "volitelne", sortOrder: 2, isPanel: true, parentSectionId: poVolId, gridColumns: 3 },
  ];

  const insertedPanels = await db.insert(subjectParamSections).values(panelInserts).returning({ id: subjectParamSections.id, code: subjectParamSections.code });
  const panelMap: Record<string, number> = {};
  insertedPanels.forEach((p, i) => { panelMap[panelInserts[i].code] = p.id; });

  const specAktivaFields = (clientTypeId: number, sectionId: number, panelCode: string) => [
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_typ_aktiva", label: "Typ aktíva", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Plavidlo / Loď", "Lietadlo / Dron", "Umelecké dielo", "Drahé kovy", "Zbierka / Kolekcia", "Iné"], sortOrder: 10, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_nazov", label: "Názov / Označenie", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 20, rowNumber: 0, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_reg_cislo", label: "Registračné číslo", shortLabel: "Reg. č.", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 30, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_typ_plavidla", label: "Typ plavidla", shortLabel: "Typ plav.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Motorová jachta", "Plachetnica", "Katamaran", "Motorový čln", "Hausbót", "Iné"], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, sortOrder: 40, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_pristav", label: "Prístav kotvenia", shortLabel: "Prístav", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, sortOrder: 50, rowNumber: 1, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_vytlak", label: "Výtlak (BRT)", shortLabel: "Výtlak", fieldType: "number", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, unit: "BRT", sortOrder: 60, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_motor_parametre", label: "Parametre motora", shortLabel: "Motor", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Plavidlo / Loď" }, sortOrder: 70, rowNumber: 2, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_typ_lietadla", label: "Typ lietadla / dronu", shortLabel: "Typ liet.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Jednomotorové", "Viacmotorové", "Vrtuľník", "Dron (komerčný)", "Dron (hobby)", "Iné"], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Lietadlo / Dron" }, sortOrder: 80, rowNumber: 1, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_autor", label: "Autor / Pôvod", shortLabel: "Autor", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "spec_typ_aktiva", value: "Umelecké dielo" }, sortOrder: 90, rowNumber: 1, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_hodnota", label: "Odhadovaná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, isActive: true, options: [], unit: "€", sortOrder: 100, rowNumber: 2, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_poistna_zmluva", label: "Číslo poistnej zmluvy", shortLabel: "Č. poistky", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 110, rowNumber: 3, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "spec_poznamka", label: "Poznámka k aktívu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 120, rowNumber: 3, widthPercent: 50, fieldCategory: "volitelne" },
  ];

  const firmPortfolioFields = (clientTypeId: number, sectionId: number, panelCode: string) => [
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_typ_majetku", label: "Typ firemného majetku", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Stroj / Zariadenie", "Budova / Prevádzka", "Technológia", "Vozový park", "Zásoby", "Iné"], sortOrder: 10, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_nazov", label: "Názov / Identifikátor", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 20, rowNumber: 0, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_inventarne_cislo", label: "Inventárne číslo", shortLabel: "Inv. č.", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 30, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_adresa_prevadzky", label: "Adresa prevádzky", shortLabel: "Adresa", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 40, rowNumber: 1, widthPercent: 50, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_uctovna_hodnota", label: "Účtovná hodnota (€)", shortLabel: "Hodnota", fieldType: "number", isRequired: false, isHidden: false, isActive: true, options: [], unit: "€", sortOrder: 50, rowNumber: 1, widthPercent: 25, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_datum_nadobudnutia", label: "Dátum nadobudnutia", shortLabel: "Dátum", fieldType: "date", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 60, rowNumber: 1, widthPercent: 25, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_odpisova_skupina", label: "Odpisová skupina", shortLabel: "Odpis. sk.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["1", "2", "3", "4", "5", "6"], sortOrder: 70, rowNumber: 2, widthPercent: 25, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_poistna_zmluva", label: "Číslo poistnej zmluvy", shortLabel: "Č. poistky", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 80, rowNumber: 2, widthPercent: 25, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_stav", label: "Stav majetku", shortLabel: "Stav", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Nový", "Používaný", "V oprave", "Vyradený"], sortOrder: 90, rowNumber: 2, widthPercent: 25, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "firm_poznamka", label: "Poznámka", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 100, rowNumber: 2, widthPercent: 25, fieldCategory: "volitelne" },
  ];

  const specRizikaFields = (clientTypeId: number, sectionId: number, panelCode: string) => [
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_typ", label: "Typ rizika", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Kybernetické riziko", "Poistenie drahých kovov", "Environmentálne riziko", "Profesná zodpovednosť", "Poistenie zbierok", "Iné"], sortOrder: 10, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_popis", label: "Popis rizika", shortLabel: "Popis", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 20, rowNumber: 0, widthPercent: 67, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, isActive: true, options: [], unit: "€", sortOrder: 30, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_poistovatel", label: "Poisťovateľ", shortLabel: "Poisťovateľ", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 40, rowNumber: 1, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_cislo_zmluvy", label: "Číslo zmluvy", shortLabel: "Č. zmluvy", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 50, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "riziko_poznamka", label: "Poznámka k riziku", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 60, rowNumber: 2, widthPercent: 100, fieldCategory: "volitelne" },
  ];

  const allParams: any[] = [
    ...specAktivaFields(1, foVolId, "fo_spec_aktiva"),
    ...specRizikaFields(1, foVolId, "fo_spec_rizika"),
    ...specAktivaFields(3, szcoVolId, "szco_spec_aktiva"),
    ...firmPortfolioFields(3, szcoVolId, "szco_firemne_portfolio"),
    ...specRizikaFields(3, szcoVolId, "szco_spec_rizika"),
    ...specAktivaFields(4, poVolId, "po_spec_aktiva"),
    ...firmPortfolioFields(4, poVolId, "po_firemne_portfolio"),
    ...specRizikaFields(4, poVolId, "po_spec_rizika"),
  ];

  let paramCount = 0;
  for (let i = 0; i < allParams.length; i += 20) {
    const batch = allParams.slice(i, i + 20);
    await db.insert(subjectParameters).values(batch);
    paramCount += batch.length;
  }

  console.log(`[SEED-ASSETS] Created 3 sections, ${insertedPanels.length} panels, ${paramCount} parameters`);
  return { sectionsCount: 3 + insertedPanels.length, parametersCount: paramCount };
}

export async function seedEventAndEntityPanels(): Promise<{ sectionsCount: number; parametersCount: number }> {
  const checkExisting = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
    .where(eq(subjectParamSections.code, "fo_eventy")).limit(1);
  if (checkExisting.length > 0) {
    console.log("[SEED] Event/Entity panels already exist, skipping.");
    return { sectionsCount: 0, parametersCount: 0 };
  }

  const getVolSectionId = async (code: string) => {
    const rows = await db.select({ id: subjectParamSections.id }).from(subjectParamSections)
      .where(eq(subjectParamSections.code, code)).limit(1);
    return rows[0]?.id;
  };

  const foVolId = await getVolSectionId("fo_volitelne");
  const szcoVolId = await getVolSectionId("szco_volitelne");
  const poVolId = await getVolSectionId("po_volitelne");
  const poPovinneId = await getVolSectionId("pravne_subjekty");

  if (!foVolId || !szcoVolId || !poVolId || !poPovinneId) {
    console.log("[SEED] Missing parent sections for event/entity panels, skipping.");
    return { sectionsCount: 0, parametersCount: 0 };
  }

  const panelInserts = [
    { clientTypeId: 1, name: "🎭 Poistenie podujatí", code: "fo_eventy", folderCategory: "volitelne", sortOrder: 2, isPanel: true, parentSectionId: foVolId, gridColumns: 3 },
    { clientTypeId: 3, name: "🎭 Poistenie podujatí", code: "szco_eventy", folderCategory: "volitelne", sortOrder: 3, isPanel: true, parentSectionId: szcoVolId, gridColumns: 3 },
    { clientTypeId: 4, name: "🎭 Poistenie podujatí", code: "po_eventy", folderCategory: "volitelne", sortOrder: 3, isPanel: true, parentSectionId: poVolId, gridColumns: 3 },
    { clientTypeId: 4, name: "🏛️ Špecifický typ organizácie", code: "po_spec_subjekt", folderCategory: "povinne", sortOrder: 3, isPanel: true, parentSectionId: poPovinneId, gridColumns: 3 },
  ];

  const insertedPanels = await db.insert(subjectParamSections).values(panelInserts).returning({ id: subjectParamSections.id, code: subjectParamSections.code });
  const panelMap: Record<string, number> = {};
  insertedPanels.forEach((p, i) => { panelMap[panelInserts[i].code] = p.id; });

  const eventFields = (clientTypeId: number, sectionId: number, panelCode: string) => [
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_nazov", label: "Názov podujatia", shortLabel: "Názov", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 10, rowNumber: 0, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_typ", label: "Typ podujatia", shortLabel: "Typ", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Vernisáž", "Koncert / Turné", "Festival", "Konferencia", "Výstava", "Športové podujatie", "Súkromná akcia", "Iné"], sortOrder: 20, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_miesto", label: "Miesto konania", shortLabel: "Miesto", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 30, rowNumber: 0, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_datum_od", label: "Dátum začiatku", shortLabel: "Od", fieldType: "date", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 40, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_datum_do", label: "Dátum ukončenia", shortLabel: "Do", fieldType: "date", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 50, rowNumber: 1, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_status", label: "Status podujatia", shortLabel: "Status", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Príprava", "Aktívne", "Prebieha", "Ukončené", "Archív"], defaultValue: "Príprava", sortOrder: 60, rowNumber: 1, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_zodpovednost", label: "Zodpovednosť za návštevníkov", shortLabel: "Zodpovednosť", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Áno – poistenie zodpovednosti", "Nie", "Čiastočne"], sortOrder: 70, rowNumber: 2, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_poistenie_storna", label: "Poistenie storna", shortLabel: "Storno poist.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Áno", "Nie"], sortOrder: 80, rowNumber: 2, widthPercent: 34, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_poistna_suma", label: "Poistná suma (€)", shortLabel: "Poistná suma", fieldType: "number", isRequired: false, isHidden: false, isActive: true, options: [], unit: "€", sortOrder: 90, rowNumber: 2, widthPercent: 33, fieldCategory: "volitelne" },
    { clientTypeId, sectionId, panelId: panelMap[panelCode], fieldKey: "event_poznamka", label: "Poznámka k podujatiu", shortLabel: "Poznámka", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], sortOrder: 100, rowNumber: 3, widthPercent: 100, fieldCategory: "volitelne" },
  ];

  const specSubjektFields = (sectionId: number) => [
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "typ_organizacie", label: "Typ organizácie", shortLabel: "Typ org.", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Obchodná spoločnosť", "Štátna inštitúcia", "Nadácia", "Občianske združenie (OZ)", "Cirkevná organizácia", "Nezisková organizácia", "Príspevková organizácia", "Iné"], defaultValue: "Obchodná spoločnosť", sortOrder: 10, rowNumber: 0, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "zriadovatel", label: "Zriaďovateľ", shortLabel: "Zriaďovateľ", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, sortOrder: 20, rowNumber: 0, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "rozpoctova_kapitola", label: "Rozpočtová kapitola", shortLabel: "Rozpoč. kap.", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, sortOrder: 30, rowNumber: 1, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "statna_sprava_uroven", label: "Úroveň štátnej správy", shortLabel: "Úroveň ŠS", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Ústredný orgán", "Krajský úrad", "Okresný úrad", "Obec / Mesto", "Iné"], visibilityRule: { dependsOn: "typ_organizacie", value: "Štátna inštitúcia" }, sortOrder: 40, rowNumber: 1, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "ucel_nadacie", label: "Účel nadácie / OZ", shortLabel: "Účel", fieldType: "long_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, sortOrder: 50, rowNumber: 2, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "statutar_nadacie", label: "Štatutár nadácie / OZ", shortLabel: "Štatutár", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, sortOrder: 60, rowNumber: 2, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "verejna_zbierka", label: "Oprávnenie na verejnú zbierku", shortLabel: "Ver. zbierka", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Áno", "Nie"], visibilityRule: { dependsOn: "typ_organizacie", value: "Nadácia" }, sortOrder: 70, rowNumber: 3, widthPercent: 33, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "registracny_organ", label: "Registračný orgán", shortLabel: "Reg. orgán", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Občianske združenie (OZ)" }, sortOrder: 80, rowNumber: 2, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "datum_registracie", label: "Dátum registrácie", shortLabel: "Dát. reg.", fieldType: "date", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Občianske združenie (OZ)" }, sortOrder: 90, rowNumber: 2, widthPercent: 50, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "opravnenie_konanie", label: "Oprávnenie na konanie v mene subjektu", shortLabel: "Oprávnenie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, isActive: true, options: ["Samostatne", "Spoločne", "Na základe plnej moci", "Iné"], sortOrder: 100, rowNumber: 3, widthPercent: 34, fieldCategory: "povinne" },
    { clientTypeId: 4, sectionId, panelId: panelMap["po_spec_subjekt"], fieldKey: "cirkevna_registracia", label: "Registrácia (cirkev)", shortLabel: "Cirkev. reg.", fieldType: "short_text", isRequired: false, isHidden: false, isActive: true, options: [], visibilityRule: { dependsOn: "typ_organizacie", value: "Cirkevná organizácia" }, sortOrder: 110, rowNumber: 3, widthPercent: 33, fieldCategory: "povinne" },
  ];

  const allParams: any[] = [
    ...eventFields(1, foVolId, "fo_eventy"),
    ...eventFields(3, szcoVolId, "szco_eventy"),
    ...eventFields(4, poVolId, "po_eventy"),
    ...specSubjektFields(poPovinneId),
  ];

  let paramCount = 0;
  for (let i = 0; i < allParams.length; i += 20) {
    const batch = allParams.slice(i, i + 20);
    await db.insert(subjectParameters).values(batch);
    paramCount += batch.length;
  }

  console.log(`[SEED-EVENTS] Created ${insertedPanels.length} panels, ${paramCount} parameters`);
  return { sectionsCount: insertedPanels.length, parametersCount: paramCount };
}

export async function ensureOsClientType(): Promise<number | null> {
  const [existing] = await db.select({ id: clientTypes.id }).from(clientTypes).where(eq(clientTypes.code, "OS"));
  if (existing) {
    console.log("[SEED] Client type 'OS' already exists, skipping.");
    return existing.id;
  }
  const [inserted] = await db.insert(clientTypes).values({
    code: "OS",
    name: "Ostatné / Špecifické",
    baseParameter: "ico",
    isActive: true,
  }).returning({ id: clientTypes.id });
  console.log(`[SEED] Client type 'OS' created with id=${inserted.id}`);
  return inserted.id;
}

export async function seedNsVsTemplates(): Promise<void> {
  const osType = await db.select({ id: clientTypes.id }).from(clientTypes).where(eq(clientTypes.code, "OS"));
  const osClientTypeId = osType[0]?.id ?? null;

  const TEMPLATES_TO_SEED = [
    {
      code: "subjekt_ns",
      name: "SUBJEKT NS",
      description: "Šablóna pre neziskovú organizáciu – identita, štatutári, KUV, kontakt, GDPR",
      clientTypeId: 5,
    },
    {
      code: "subjekt_vs",
      name: "SUBJEKT VS",
      description: "Šablóna pre inštitúciu verejného sektora – identita, štatutári, KUV, financovanie",
      clientTypeId: 6,
    },
    ...(osClientTypeId ? [{
      code: "subjekt_os",
      name: "SUBJEKT OS",
      description: "Šablóna pre ostatné / špecifické subjekty – identita, IČO, špecifikácia",
      clientTypeId: osClientTypeId,
    }] : []),
  ];

  for (const tpl of TEMPLATES_TO_SEED) {
    const [existing] = await db.select({ id: subjectTemplates.id }).from(subjectTemplates).where(eq(subjectTemplates.code, tpl.code));
    if (existing) {
      console.log(`[SEED] Template '${tpl.code}' already exists, skipping.`);
      continue;
    }

    const [created] = await db.insert(subjectTemplates).values({
      code: tpl.code,
      name: tpl.name,
      description: tpl.description,
      clientTypeId: tpl.clientTypeId,
      isDefault: true,
      isActive: true,
    }).returning();

    const params = await db.select({ id: subjectParameters.id, sortOrder: subjectParameters.sortOrder })
      .from(subjectParameters)
      .where(and(eq(subjectParameters.clientTypeId, tpl.clientTypeId), eq(subjectParameters.isActive, true), eq(subjectParameters.isHidden, false)))
      .orderBy(asc(subjectParameters.sortOrder));

    if (params.length > 0) {
      const entries = params.map(p => ({
        templateId: created.id,
        parameterId: p.id,
        sortOrder: p.sortOrder ?? 0,
        isRequired: false,
      }));
      for (let i = 0; i < entries.length; i += 50) {
        await db.insert(subjectTemplateParams).values(entries.slice(i, i + 50));
      }
    }

    console.log(`[SEED] Template '${tpl.code}' created with ${params.length} params.`);
  }
}

export async function cleanupZombieTemplateParams(): Promise<void> {
  const deleted = await db
    .delete(subjectTemplateParams)
    .where(
      sql`${subjectTemplateParams.parameterId} IN (
        SELECT id FROM ${subjectParameters}
        WHERE is_active = false OR is_hidden = true
      )`
    )
    .returning({ id: subjectTemplateParams.id });

  const removed = deleted.length;
  if (removed > 0) {
    console.log(`[CLEANUP] Removed ${removed} zombie template-param link(s) pointing to inactive or hidden parameters.`);
  } else {
    console.log(`[CLEANUP] No zombie template-param links found.`);
  }
}
