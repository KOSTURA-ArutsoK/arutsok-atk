import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, sql } from "drizzle-orm";
import {
  subjects,
  contracts,
  globalCounters,
  myCompanies,
  states,
  contractStatuses,
  products,
  appUsers,
} from "../shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const SK_FIRST_NAMES_M = ["Ján", "Peter", "Martin", "Tomáš", "Marek", "Lukáš", "Michal", "Jakub", "Štefan", "Andrej", "Vladimír", "Rastislav", "Igor", "Milan", "Robert", "Dušan", "Roman", "Jozef", "Pavol", "Daniel"];
const SK_FIRST_NAMES_F = ["Mária", "Jana", "Eva", "Anna", "Katarína", "Zuzana", "Monika", "Lucia", "Martina", "Veronika", "Petra", "Iveta", "Andrea", "Elena", "Silvia"];
const SK_LAST_NAMES = ["Novák", "Horváth", "Kováč", "Varga", "Tóth", "Molnár", "Nagy", "Baláž", "Szabó", "Černák", "Krajčír", "Sedlák", "Polák", "Kučera", "Bartoš", "Hudák", "Lukáč", "Miklóš", "Fiala", "Hruška", "Valent", "Juráš", "Kmeťo", "Ondrejka", "Dudáš"];
const SK_COMPANY_NAMES = [
  "ALFA Invest, s.r.o.", "BETA Reality, a.s.", "GAMA Poistenie, s.r.o.", "DELTA Financial, s.r.o.",
  "EPSILON Trade, a.s.", "ZETA Consulting, s.r.o.", "ETA Holdings, a.s.", "THETA Motors, s.r.o.",
  "IOTA Security, s.r.o.", "KAPPA Energy, a.s.", "LAMBDA Tech, s.r.o.", "MÝ Services, s.r.o.",
  "NÝ Logistics, a.s.", "OMI Partners, s.r.o.", "SIGMA Capital, a.s."
];
const SK_CITIES = ["Bratislava", "Košice", "Žilina", "Prešov", "Banská Bystrica", "Nitra", "Trnava", "Trenčín", "Martin", "Poprad", "Zvolen", "Piešťany", "Lučenec", "Michalovce", "Komárno"];
const SK_STREETS = ["Hlavná", "Štúrova", "Dlhá", "Krátka", "Nová", "Školská", "Záhradná", "Hviezdoslavova", "Námestie SNP", "Obchodná", "Kukučínova", "Jánošíkova", "Tatranská", "Dunajská", "Karadžičova"];

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
  return String(30000000 + Math.floor(Math.random() * 20000000));
}

function randomPhone(): string {
  return `+421 9${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}

function randomIBAN(): string {
  return `SK${String(Math.floor(Math.random() * 100)).padStart(2, "0")} ${String(Math.floor(Math.random() * 10000)).padStart(4, "0")} ${String(Math.floor(Math.random() * 10000)).padStart(4, "0")} ${String(Math.floor(Math.random() * 10000)).padStart(4, "0")} ${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}

function randomEmail(first: string, last: string): string {
  const domains = ["gmail.com", "azet.sk", "centrum.sk", "post.sk", "yahoo.com"];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return `${norm(first)}.${norm(last)}${Math.floor(Math.random() * 99)}@${randomPick(domains)}`;
}

function generateClientDetails(type: "person" | "company", city: string) {
  const details: any = {
    dynamicFields: {},
    address: {
      street: `${randomPick(SK_STREETS)} ${1 + Math.floor(Math.random() * 100)}`,
      city: city,
      zip: `${8 + Math.floor(Math.random() * 2)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
      country: "Slovensko",
    },
  };
  if (type === "person") {
    details.dynamicFields.category_1 = {
      datumNarodenia: `${1960 + Math.floor(Math.random() * 40)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
      miestNarodenia: randomPick(SK_CITIES),
      statnaInstitucia: "SR",
      rodinnyStav: randomPick(["slobodný/á", "ženatý/vydatá", "rozvedený/á"]),
    };
    details.dynamicFields.category_3 = {
      trvBydliskoUlica: details.address.street,
      trvBydliskoMesto: city,
      trvBydliskoPsc: details.address.zip,
    };
    details.dynamicFields.category_5 = {
      zamestnanie: randomPick(["zamestnanec", "SZČO", "dôchodca", "študent", "podnikateľ"]),
      mesacnyPrijem: String(800 + Math.floor(Math.random() * 3000)),
    };
  } else {
    details.dynamicFields.category_32 = {
      skNace: `${60 + Math.floor(Math.random() * 30)}.${Math.floor(Math.random() * 10)}0`,
      obrat: String((100000 + Math.floor(Math.random() * 5000000))),
      pocetZamestnancov: String(1 + Math.floor(Math.random() * 200)),
    };
    details.dynamicFields.category_31 = {
      ico: randomICO(),
      dic: `20${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
      icDph: `SK20${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
    };
  }
  return details;
}

async function getNextUid(): Promise<{ uid: string; counter: number }> {
  const counterName = "uid_state_421";
  const result = await db
    .update(globalCounters)
    .set({ currentValue: sql`${globalCounters.currentValue} + 1` })
    .where(eq(globalCounters.counterName, counterName))
    .returning();
  const val = result[0].currentValue;
  const digits = String(val).padStart(12, "0");
  const formatted = `421 ${digits.replace(/(.{3})/g, "$1 ").trim()}`;
  return { uid: formatted, counter: val };
}

async function getNextContractNumber(): Promise<number> {
  const result = await db
    .update(globalCounters)
    .set({ currentValue: sql`${globalCounters.currentValue} + 1` })
    .where(eq(globalCounters.counterName, "contract_global_number"))
    .returning();
  return result[0].currentValue;
}

async function main() {
  console.log("Spustam generovanie 50 testovacich subjektov...\n");

  const allCompanies = await db.select().from(myCompanies);
  const allStates = await db.select().from(states);
  const allStatuses = await db.select().from(contractStatuses);
  const allProducts = await db.select().from(products);
  const allUsers = await db.select().from(appUsers);

  if (!allCompanies.length) {
    console.error("Ziadne spolocnosti v databaze.");
    process.exit(1);
  }

  const activeCompany = allCompanies[0];
  const skState = allStates.find(s => s.name === "Slovensko") || allStates[0];
  const defaultStatus = allStatuses[0];
  const defaultProduct = allProducts[0];
  const defaultUser = allUsers[0];

  console.log(`Spolocnost: ${activeCompany.name} (ID: ${activeCompany.id})`);
  console.log(`Stat: ${skState?.name} (ID: ${skState?.id})`);
  if (defaultStatus) console.log(`Status zmluvy: ${defaultStatus.name} (ID: ${defaultStatus.id})`);
  if (defaultProduct) console.log(`Produkt: ${defaultProduct.name} (ID: ${defaultProduct.id})`);
  console.log(`Uzivatel: ${defaultUser?.username} (ID: ${defaultUser?.id})\n`);

  const createdSubjects: { id: number; uid: string; type: string; name: string }[] = [];

  for (let i = 0; i < 50; i++) {
    const isPerson = i < 35;
    const isMale = Math.random() > 0.4;
    const city = randomPick(SK_CITIES);

    const { uid } = await getNextUid();

    if (isPerson) {
      const firstName = isMale ? randomPick(SK_FIRST_NAMES_M) : randomPick(SK_FIRST_NAMES_F);
      const lastName = randomPick(SK_LAST_NAMES);
      const email = randomEmail(firstName, lastName);
      const phone = randomPhone();
      const birthNumber = randomBirthNumber(isMale);
      const details = generateClientDetails("person", city);

      const [subject] = await db.insert(subjects).values({
        uid,
        type: "person",
        firstName,
        lastName,
        email,
        phone,
        birthNumber,
        iban: randomIBAN(),
        myCompanyId: activeCompany.id,
        stateId: skState?.id || 1,
        details,
        isActive: true,
        bonitaPoints: Math.floor(Math.random() * 100),
        registeredByUserId: defaultUser?.id || 1,
      }).returning();

      createdSubjects.push({ id: subject.id, uid, type: "person", name: `${firstName} ${lastName}` });
      console.log(`  FO #${i + 1}: ${firstName} ${lastName} (${uid})`);
    } else {
      const companyName = SK_COMPANY_NAMES[i - 35] || `Test Firma ${i}, s.r.o.`;
      const ico = randomICO();
      const details = generateClientDetails("company", city);

      const [subject] = await db.insert(subjects).values({
        uid,
        type: "company",
        companyName,
        email: `info@${companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "").slice(0, 10)}.sk`,
        phone: randomPhone(),
        birthNumber: ico,
        iban: randomIBAN(),
        myCompanyId: activeCompany.id,
        stateId: skState?.id || 1,
        details,
        isActive: true,
        bonitaPoints: Math.floor(Math.random() * 100),
        registeredByUserId: defaultUser?.id || 1,
      }).returning();

      createdSubjects.push({ id: subject.id, uid, type: "company", name: companyName });
      console.log(`  PO #${i + 1}: ${companyName} (${uid})`);
    }
  }

  console.log(`\nGenerujem zmluvy pre subjekty...\n`);

  let contractsCreated = 0;
  for (const subj of createdSubjects) {
    const numContracts = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < numContracts; c++) {
      const globalNum = await getNextContractNumber();
      const contractNumber = `ZML-${String(globalNum).padStart(6, "0")}`;
      const signedDate = new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
      const effectiveDate = new Date(signedDate);
      effectiveDate.setMonth(effectiveDate.getMonth() + 1);
      const expiryDate = new Date(signedDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + Math.floor(1 + Math.random() * 5));

      const premium = Math.floor(50 + Math.random() * 500) * 100;
      const commission = Math.floor(premium * (0.05 + Math.random() * 0.15));

      await db.insert(contracts).values({
        uid: `C${String(globalNum).padStart(10, "0")}`,
        contractNumber,
        subjectId: subj.id,
        statusId: defaultStatus?.id || undefined,
        productId: defaultProduct?.id || undefined,
        stateId: skState?.id || 1,
        companyId: activeCompany.id,
        signedDate,
        effectiveDate,
        expiryDate,
        premiumAmount: premium,
        annualPremium: premium * 12,
        commissionAmount: commission,
        currency: "EUR",
        contractType: randomPick(["Nova", "Dodatok", "Prestup"]),
        paymentFrequency: randomPick(["mesačne", "štvrťročne", "polročne", "ročne"]),
        globalNumber: globalNum,
        klientUid: subj.uid,
        uploadedByUserId: defaultUser?.id || 1,
        notes: `Automaticky vygenerovana testovacia zmluva #${globalNum}`,
      });
      contractsCreated++;
    }
  }

  console.log(`Vytvorenych ${contractsCreated} zmluv pre ${createdSubjects.length} subjektov.`);
  console.log(`\nSeed dokonceny! Celkom:`);
  console.log(`   - ${createdSubjects.filter(s => s.type === "person").length} fyzickych osob (FO)`);
  console.log(`   - ${createdSubjects.filter(s => s.type === "company").length} pravnickych osob (PO)`);
  console.log(`   - ${contractsCreated} zmluv`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Chyba pri seedovani:", err);
  process.exit(1);
});
