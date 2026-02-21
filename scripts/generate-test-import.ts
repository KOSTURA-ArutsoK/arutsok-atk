import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, sql, isNotNull, and, ne } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import {
  subjects,
  globalCounters,
} from "../shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "default-encryption-key-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptField(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(ciphertext, "base64");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}

const SK_FIRST_NAMES_M = ["Ján", "Peter", "Martin", "Tomáš", "Marek", "Lukáš", "Michal", "Jakub", "Štefan", "Andrej", "Vladimír", "Rastislav", "Igor", "Milan", "Robert"];
const SK_FIRST_NAMES_F = ["Mária", "Jana", "Eva", "Anna", "Katarína", "Zuzana", "Monika", "Lucia", "Martina", "Veronika"];
const SK_LAST_NAMES = ["Novák", "Horváth", "Kováč", "Varga", "Tóth", "Molnár", "Nagy", "Baláž", "Szabó", "Černák", "Krajčír", "Sedlák", "Polák", "Kučera", "Bartoš"];
const SK_COMPANY_NAMES = [
  "OMEGA Finance, s.r.o.", "RHO Invest, a.s.", "PSI Reality, s.r.o.", "CHI Motors, s.r.o.",
  "PHI Capital, a.s.", "UPSILON Trade, s.r.o.", "TAU Logistics, a.s.", "SIGMA Defense, s.r.o.",
];
const SK_CITIES = ["Bratislava", "Košice", "Žilina", "Prešov", "Banská Bystrica", "Nitra", "Trnava", "Trenčín", "Martin", "Poprad"];
const SK_STREETS = ["Hlavná", "Štúrova", "Dlhá", "Krátka", "Nová", "Školská", "Záhradná", "Hviezdoslavova"];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBirthNumber(isMale: boolean): string {
  const year = 60 + Math.floor(Math.random() * 40);
  let month = 1 + Math.floor(Math.random() * 12);
  if (!isMale) month += 50;
  const day = 1 + Math.floor(Math.random() * 28);
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}/${suffix}`;
}

function randomICO(): string {
  return String(40000000 + Math.floor(Math.random() * 10000000));
}

function randomPhone(): string {
  return `+421 9${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}

function randomVIN(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let vin = "";
  for (let i = 0; i < 17; i++) vin += chars[Math.floor(Math.random() * chars.length)];
  return vin;
}

function randomSPZ(): string {
  const letters = "ABCDEFGHKLMNPRSTVXZ";
  const district = randomPick(["BA", "BB", "BN", "BR", "BT", "BY", "CA", "DK", "DS", "DT", "GA", "GL", "HC", "HE", "IL", "KA", "KE", "KI", "KN", "KS", "LC", "LE", "LM", "LV", "MA", "MI", "ML", "MT", "MY", "NM", "NO", "NR", "NZ", "PE", "PB", "PD", "PK", "PM", "PN", "PO", "PP", "PT", "PU", "RA", "RK", "RS", "RV", "SA", "SC", "SE", "SI", "SK", "SL", "SN", "SO", "SP", "SB", "SK", "SL", "SN", "SO", "SP", "SB", "SL", "SN", "SO", "SP", "SB", "TO", "TR", "TS", "TT", "TN", "TV", "VK", "VT", "ZA", "ZC", "ZH", "ZI", "ZK", "ZL", "ZM", "ZV"]);
  const num = String(100 + Math.floor(Math.random() * 900));
  const let1 = letters[Math.floor(Math.random() * letters.length)];
  const let2 = letters[Math.floor(Math.random() * letters.length)];
  return `${district}${num}${let1}${let2}`;
}

function randomDate(yearFrom: number, yearTo: number): string {
  const year = yearFrom + Math.floor(Math.random() * (yearTo - yearFrom + 1));
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

async function main() {
  console.log("Generujem testovaciu vzorku 50 zmlúv pre hromadný import...\n");

  const existingSubjects = await db.select().from(subjects).where(
    and(eq(subjects.isActive, true), isNotNull(subjects.birthNumber), ne(subjects.birthNumber, ""))
  );

  const decryptedSubjects = existingSubjects.map(s => ({
    ...s,
    decryptedBN: decryptField(s.birthNumber),
  })).filter(s => s.decryptedBN && s.decryptedBN.length >= 6);

  const foSubjects = decryptedSubjects.filter(s => s.type === "person");
  const poSubjects = decryptedSubjects.filter(s => s.type === "company");

  console.log(`Existujúce FO subjekty: ${foSubjects.length}`);
  console.log(`Existujúce PO subjekty: ${poSubjects.length}`);

  const SHARED_VIN_1 = randomVIN();
  const SHARED_VIN_2 = randomVIN();
  const SHARED_SPZ_1 = randomSPZ();

  const headers = [
    "rodne_cislo", "ico", "meno", "priezvisko", "nazov_firmy",
    "email", "telefon", "cislo_zmluvy", "cislo_navrhu", "kik",
    "vin", "spz", "lehotne_poistne", "frekvencia", "mena",
    "datum_storna", "poznamky",
    "tp_ulica", "tp_mesto", "tp_psc",
  ];

  const rows: string[][] = [];
  let scenario = 0;

  function addRow(data: Record<string, string>, comment: string) {
    scenario++;
    const row = headers.map(h => data[h] || "");
    rows.push(row);
    console.log(`  Riadok ${scenario}: ${comment}`);
  }

  // ---- SCENÁR 1-5: Existujúce FO subjekty (RČ matching → "updated") ----
  const matchFO = foSubjects.slice(0, 5);
  for (let i = 0; i < Math.min(5, matchFO.length); i++) {
    const s = matchFO[i];
    addRow({
      rodne_cislo: s.decryptedBN!,
      meno: s.firstName || "Aktualizovaný",
      priezvisko: s.lastName || "Import",
      email: `updated${i}@import-test.sk`,
      telefon: randomPhone(),
      cislo_zmluvy: `IMP-FO-${String(i + 1).padStart(3, "0")}`,
      cislo_navrhu: `NAV-${String(scenario + 1).padStart(4, "0")}`,
      vin: i === 0 ? SHARED_VIN_1 : randomVIN(),
      spz: i === 1 ? SHARED_SPZ_1 : randomSPZ(),
      lehotne_poistne: String(100 + Math.floor(Math.random() * 500)),
      frekvencia: randomPick(["mesačne", "štvrťročne", "ročne"]),
      mena: "EUR",
      datum_storna: i < 3 ? randomDate(2025, 2026) : "",
      poznamky: `Automatický import – existujúca FO (RČ match) #${i + 1}`,
      tp_ulica: `${randomPick(SK_STREETS)} ${1 + Math.floor(Math.random() * 50)}`,
      tp_mesto: randomPick(SK_CITIES),
      tp_psc: `${8 + Math.floor(Math.random() * 2)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    }, `FO existujúci – RČ match (${s.firstName} ${s.lastName}), ${i < 3 ? "má dátum storna" : "BEZ dátumu storna"}${i === 0 ? ", SHARED VIN 1" : ""}${i === 1 ? ", SHARED ŠPZ 1" : ""}`);
  }

  // ---- SCENÁR 6-10: Existujúce PO subjekty (IČO matching → "updated") ----
  const matchPO = poSubjects.slice(0, 5);
  for (let i = 0; i < Math.min(5, matchPO.length); i++) {
    const s = matchPO[i];
    addRow({
      ico: s.decryptedBN!,
      nazov_firmy: s.companyName || `Aktualizovaná Firma ${i}`,
      email: `firma-update${i}@import-test.sk`,
      telefon: randomPhone(),
      cislo_zmluvy: `IMP-PO-${String(i + 1).padStart(3, "0")}`,
      cislo_navrhu: `NAV-PO-${String(i + 1).padStart(4, "0")}`,
      vin: i === 2 ? SHARED_VIN_1 : randomVIN(),
      spz: i === 3 ? SHARED_SPZ_1 : randomSPZ(),
      lehotne_poistne: String(500 + Math.floor(Math.random() * 2000)),
      frekvencia: randomPick(["štvrťročne", "polročne", "ročne"]),
      mena: "EUR",
      datum_storna: i < 2 ? randomDate(2025, 2026) : "",
      poznamky: `Automatický import – existujúca PO (IČO match) #${i + 1}`,
    }, `PO existujúci – IČO match (${s.companyName || s.decryptedBN}), ${i < 2 ? "má dátum storna" : "BEZ dátumu storna"}${i === 2 ? ", SHARED VIN 1 (duplicita!)" : ""}${i === 3 ? ", SHARED ŠPZ 1 (duplicita!)" : ""}`);
  }

  // ---- SCENÁR 11-25: Nové FO subjekty (nové RČ → "created") ----
  for (let i = 0; i < 15; i++) {
    const isMale = Math.random() > 0.4;
    const firstName = isMale ? randomPick(SK_FIRST_NAMES_M) : randomPick(SK_FIRST_NAMES_F);
    const lastName = randomPick(SK_LAST_NAMES);
    const rc = randomBirthNumber(isMale);
    const city = randomPick(SK_CITIES);

    addRow({
      rodne_cislo: rc,
      meno: firstName,
      priezvisko: lastName,
      email: `${firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}${Math.floor(Math.random() * 99)}@import-test.sk`,
      telefon: randomPhone(),
      cislo_zmluvy: `IMP-NEW-${String(i + 1).padStart(3, "0")}`,
      cislo_navrhu: `NAV-NEW-${String(i + 1).padStart(4, "0")}`,
      vin: i === 0 ? SHARED_VIN_2 : (i === 5 ? SHARED_VIN_1 : randomVIN()),
      spz: i === 1 ? SHARED_SPZ_1 : randomSPZ(),
      lehotne_poistne: String(50 + Math.floor(Math.random() * 400)),
      frekvencia: randomPick(["mesačne", "štvrťročne", "polročne", "ročne"]),
      mena: "EUR",
      datum_storna: i < 8 ? randomDate(2025, 2026) : "",
      poznamky: `Nový FO subjekt z importu #${i + 1}`,
      tp_ulica: `${randomPick(SK_STREETS)} ${1 + Math.floor(Math.random() * 100)}`,
      tp_mesto: city,
      tp_psc: `${8 + Math.floor(Math.random() * 2)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    }, `Nová FO – ${firstName} ${lastName} (${rc.substring(0, 6)}...), ${i < 8 ? "má dátum storna" : "BEZ dátumu storna"}${i === 0 ? ", SHARED VIN 2" : ""}${i === 5 ? ", SHARED VIN 1 (duplicita cross-batch!)" : ""}${i === 1 ? ", SHARED ŠPZ 1 (duplicita cross-batch!)" : ""}`);
  }

  // ---- SCENÁR 26-33: Nové PO subjekty (nové IČO → "created") ----
  for (let i = 0; i < 8; i++) {
    const ico = randomICO();
    const companyName = SK_COMPANY_NAMES[i] || `Import Test Firma ${i + 1}, s.r.o.`;

    addRow({
      ico,
      nazov_firmy: companyName,
      email: `${companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "").slice(0, 12)}@import-test.sk`,
      telefon: randomPhone(),
      cislo_zmluvy: `IMP-FIRMA-${String(i + 1).padStart(3, "0")}`,
      cislo_navrhu: `NAV-FIRMA-${String(i + 1).padStart(4, "0")}`,
      vin: i === 3 ? SHARED_VIN_2 : randomVIN(),
      spz: randomSPZ(),
      lehotne_poistne: String(1000 + Math.floor(Math.random() * 5000)),
      frekvencia: randomPick(["štvrťročne", "polročne", "ročne"]),
      mena: "EUR",
      datum_storna: i < 4 ? randomDate(2025, 2026) : "",
      poznamky: `Nová PO z importu – ${companyName}`,
    }, `Nová PO – ${companyName} (IČO: ${ico}), ${i < 4 ? "má dátum storna" : "BEZ dátumu storna"}${i === 3 ? ", SHARED VIN 2 (duplicita!)" : ""}`);
  }

  // ---- SCENÁR 34-40: VIN duplicity v rámci rovnakého batchu ----
  const BATCH_VIN = randomVIN();
  const BATCH_SPZ = randomSPZ();
  for (let i = 0; i < 7; i++) {
    const isMale = Math.random() > 0.4;
    const firstName = isMale ? randomPick(SK_FIRST_NAMES_M) : randomPick(SK_FIRST_NAMES_F);
    const lastName = randomPick(SK_LAST_NAMES);
    const rc = randomBirthNumber(isMale);

    addRow({
      rodne_cislo: rc,
      meno: firstName,
      priezvisko: lastName,
      email: `dup-batch${i}@import-test.sk`,
      telefon: randomPhone(),
      cislo_zmluvy: `IMP-DUP-${String(i + 1).padStart(3, "0")}`,
      vin: i < 4 ? BATCH_VIN : randomVIN(),
      spz: i >= 4 ? BATCH_SPZ : randomSPZ(),
      lehotne_poistne: String(100 + Math.floor(Math.random() * 300)),
      frekvencia: "mesačne",
      mena: "EUR",
      datum_storna: i < 2 ? randomDate(2025, 2026) : "",
      poznamky: `Duplicitný batch test #${i + 1} – ${i < 4 ? "rovnaký VIN" : "rovnaká ŠPZ"}`,
    }, `Duplicita IN-BATCH – ${firstName} ${lastName}, ${i < 4 ? `rovnaký VIN (${BATCH_VIN})` : `rovnaká ŠPZ (${BATCH_SPZ})`}, ${i < 2 ? "má storno" : "BEZ storna"}`);
  }

  // ---- SCENÁR 41-45: Chýbajúce povinné údaje (neúplné zmluvy) ----
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = isMale ? randomPick(SK_FIRST_NAMES_M) : randomPick(SK_FIRST_NAMES_F);
    const lastName = randomPick(SK_LAST_NAMES);
    const rc = randomBirthNumber(isMale);

    const data: Record<string, string> = {
      rodne_cislo: rc,
      meno: firstName,
      priezvisko: lastName,
      cislo_zmluvy: `IMP-INC-${String(i + 1).padStart(3, "0")}`,
      lehotne_poistne: String(200 + Math.floor(Math.random() * 300)),
      frekvencia: "mesačne",
      mena: "EUR",
      poznamky: `Neúplná zmluva #${i + 1} – chýba telefón a/alebo ŠPZ`,
    };

    if (i % 2 === 0) data.telefon = randomPhone();
    if (i >= 3) data.spz = randomSPZ();

    addRow(data, `Neúplná zmluva – ${firstName} ${lastName}, chýba ${i % 2 !== 0 ? "telefón" : ""}${i < 3 ? (i % 2 !== 0 ? " + ŠPZ" : "ŠPZ") : ""}`);
  }

  // ---- SCENÁR 46-50: Mix scenárov (edge cases) ----
  // 46: FO bez emailu
  addRow({
    rodne_cislo: randomBirthNumber(true),
    meno: "Anonymný",
    priezvisko: "Klient",
    telefon: randomPhone(),
    cislo_zmluvy: "IMP-EDGE-001",
    vin: randomVIN(),
    spz: randomSPZ(),
    lehotne_poistne: "350",
    frekvencia: "ročne",
    mena: "EUR",
    datum_storna: randomDate(2025, 2026),
    poznamky: "Edge case: FO bez emailu",
  }, "Edge case: FO bez emailu");

  // 47: PO bez názvu firmy
  addRow({
    ico: randomICO(),
    email: "bezfirmy@edge-test.sk",
    telefon: randomPhone(),
    cislo_zmluvy: "IMP-EDGE-002",
    vin: randomVIN(),
    spz: randomSPZ(),
    lehotne_poistne: "2500",
    frekvencia: "polročne",
    mena: "EUR",
    poznamky: "Edge case: PO len s IČO, bez názvu firmy, BEZ storna",
  }, "Edge case: PO len s IČO, bez názvu, BEZ storna");

  // 48: Veľmi vysoké poistné
  addRow({
    rodne_cislo: randomBirthNumber(false),
    meno: "Veľká",
    priezvisko: "Zmluva",
    email: "velka.zmluva@edge-test.sk",
    telefon: randomPhone(),
    cislo_zmluvy: "IMP-EDGE-003",
    vin: randomVIN(),
    spz: randomSPZ(),
    lehotne_poistne: "99999",
    frekvencia: "ročne",
    mena: "EUR",
    datum_storna: randomDate(2026, 2027),
    poznamky: "Edge case: vysoké poistné 99999 EUR",
  }, "Edge case: vysoké poistné 99999 EUR");

  // 49: Zmluva v CZK
  addRow({
    rodne_cislo: randomBirthNumber(true),
    meno: "České",
    priezvisko: "Poistenie",
    email: "ceske@edge-test.sk",
    telefon: "+420 777 123456",
    cislo_zmluvy: "IMP-EDGE-004",
    vin: randomVIN(),
    spz: "3A12345",
    lehotne_poistne: "5000",
    frekvencia: "mesačne",
    mena: "CZK",
    datum_storna: "",
    poznamky: "Edge case: CZK mena, česká ŠPZ, BEZ storna",
  }, "Edge case: CZK mena, česká ŠPZ, BEZ storna");

  // 50: Prázdny riadok len s RČ a menom
  addRow({
    rodne_cislo: randomBirthNumber(true),
    meno: "Minimálny",
    priezvisko: "Záznam",
    cislo_zmluvy: "IMP-EDGE-005",
    poznamky: "Edge case: minimálne dáta – len RČ, meno, číslo zmluvy",
  }, "Edge case: minimálne dáta – len RČ, meno, číslo zmluvy");

  // Pad to exactly 50 rows with extra FO/PO mix
  while (rows.length < 50) {
    const remaining = 50 - rows.length;
    const isPO = remaining <= 3;
    if (isPO) {
      const ico = randomICO();
      const name = `Extra Firma ${remaining}, s.r.o.`;
      addRow({
        ico,
        nazov_firmy: name,
        email: `extra-firma${remaining}@import-test.sk`,
        telefon: randomPhone(),
        cislo_zmluvy: `IMP-PAD-${String(remaining).padStart(3, "0")}`,
        vin: randomVIN(),
        spz: randomSPZ(),
        lehotne_poistne: String(500 + Math.floor(Math.random() * 3000)),
        frekvencia: randomPick(["štvrťročne", "polročne", "ročne"]),
        mena: "EUR",
        datum_storna: remaining % 2 === 0 ? randomDate(2025, 2026) : "",
        poznamky: `Doplnkový PO subjekt #${remaining}`,
      }, `Doplnkový PO – ${name}, ${remaining % 2 === 0 ? "má storno" : "BEZ storna"}`);
    } else {
      const isMale = Math.random() > 0.5;
      const firstName = isMale ? randomPick(SK_FIRST_NAMES_M) : randomPick(SK_FIRST_NAMES_F);
      const lastName = randomPick(SK_LAST_NAMES);
      addRow({
        rodne_cislo: randomBirthNumber(isMale),
        meno: firstName,
        priezvisko: lastName,
        email: `extra${remaining}@import-test.sk`,
        telefon: randomPhone(),
        cislo_zmluvy: `IMP-PAD-${String(remaining).padStart(3, "0")}`,
        vin: randomVIN(),
        spz: randomSPZ(),
        lehotne_poistne: String(100 + Math.floor(Math.random() * 500)),
        frekvencia: randomPick(["mesačne", "štvrťročne", "ročne"]),
        mena: "EUR",
        datum_storna: remaining % 2 === 0 ? randomDate(2025, 2026) : "",
        poznamky: `Doplnkový FO subjekt #${remaining}`,
        tp_ulica: `${randomPick(SK_STREETS)} ${1 + Math.floor(Math.random() * 50)}`,
        tp_mesto: randomPick(SK_CITIES),
        tp_psc: `${8 + Math.floor(Math.random() * 2)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
      }, `Doplnkový FO – ${firstName} ${lastName}, ${remaining % 2 === 0 ? "má storno" : "BEZ storna"}`);
    }
  }

  // Build CSV
  const csvLines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    csvLines.push(row.map(escapeCsv).join(","));
  }
  const csvContent = csvLines.join("\n");

  const outputPath = path.join(process.cwd(), "test-import-50.csv");
  fs.writeFileSync(outputPath, csvContent, "utf-8");

  console.log(`\n======================================`);
  console.log(`CSV súbor vygenerovaný: ${outputPath}`);
  console.log(`Celkom riadkov: ${rows.length}`);
  console.log(`======================================`);

  await pool.end();
}

main().catch((err) => {
  console.error("Chyba:", err);
  process.exit(1);
});
