import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, sql, isNotNull, and, ne, lte, desc } from "drizzle-orm";
import * as fs from "fs";
import crypto from "crypto";
import { parse } from "csv-parse/sync";
import {
  subjects,
  contracts,
  globalCounters,
  contractStatuses,
  panelParameters,
  appUsers,
  myCompanies,
  states,
  auditLogs,
} from "../shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// UID vyhradené výhradne pre vzorovú Fyzickú Osobu (FO) v seed dátach.
// NESMIE byť pridelené subjektom iného typu (NS=5, VS=6, mycompany, system).
const SAMPLE_FO_UID = "421000000000002";

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "default-encryption-key-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
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

async function getNextUid(): Promise<string> {
  const counterName = "uid_state_421";
  let val: number;
  let retries = 0;
  while (true) {
    const result = await db
      .update(globalCounters)
      .set({ currentValue: sql`${globalCounters.currentValue} + 1` })
      .where(eq(globalCounters.counterName, counterName))
      .returning();
    val = result[0].currentValue;
    const normalized = `421${String(val).padStart(12, "0")}`;
    // Preskočiť vyhradené UID pre vzorovú FO (SAMPLE_FO_UID)
    if (normalized !== SAMPLE_FO_UID) break;
    if (++retries > 100) throw new Error("Príliš veľa pokusov pri generovaní UID");
  }
  const digits = String(val!).padStart(12, "0");
  return `421 ${digits.replace(/(.{3})/g, "$1 ").trim()}`;
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
  console.log("=== HROMADNÝ IMPORT – TEST 50 ZMLÚV ===\n");

  const csvPath = process.cwd() + "/test-import-50.csv";
  if (!fs.existsSync(csvPath)) {
    console.error("CSV súbor neexistuje! Najprv spusti generate-test-import.ts");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Načítaných ${records.length} riadkov z CSV\n`);

  const allSubjects = await db.select().from(subjects).where(eq(subjects.isActive, true));
  const allStatuses = await db.select().from(contractStatuses);
  const defaultStatus = allStatuses[0];
  const allCompanies = await db.select().from(myCompanies);
  const allStates = await db.select().from(states);
  const allUsers = await db.select().from(appUsers);
  const activeCompany = allCompanies[0];
  const skState = allStates.find(s => s.name === "Slovensko") || allStates[0];
  const defaultUser = allUsers[0];

  let pendingStatus = allStatuses.find(s => s.name === "Čaká na posúdenie bonusu/malusu");
  if (!pendingStatus) {
    const [created] = await db.insert(contractStatuses).values({
      name: "Čaká na posúdenie bonusu/malusu",
      color: "#f59e0b",
      sortOrder: 997,
      isCommissionable: false,
      isFinal: false,
      assignsNumber: false,
      definesContractEnd: false,
      isSystem: false,
    }).returning();
    pendingStatus = created;
    console.log(`Vytvorený status: "Čaká na posúdenie bonusu/malusu"`);
  }

  const categoryMappings = new Map<string, string>();
  const allPanelParams = await db.select().from(panelParameters).where(isNotNull(panelParameters.targetCategoryCode));
  for (const pp of allPanelParams) {
    if (pp.targetCategoryCode) {
      const paramName = pp.label || pp.name || "";
      categoryMappings.set(String(paramName).toLowerCase(), pp.targetCategoryCode);
    }
  }

  const batchId = `BATCH-TEST-${Date.now()}`;
  const vinSpzTracker = new Map<string, { uid: string; subjectId: number; row: number }>();
  
  const stats = {
    total: records.length,
    success: 0,
    errors: 0,
    created: 0,
    updated: 0,
    matched: 0,
    warnings: 0,
    duplicityWarnings: [] as { row: number; field: string; value: string; existingUid: string; newUid: string }[],
    pendingBonusMalus: 0,
    incomplete: 0,
  };

  const details: { row: number; status: string; action: string; warnings: string[] }[] = [];

  for (let rowIdx = 0; rowIdx < records.length; rowIdx++) {
    const rowNum = rowIdx + 2;
    const rowData = records[rowIdx];
    const rowWarnings: string[] = [];

    try {
      const rc = rowData["rodne_cislo"] || null;
      const ico = rowData["ico"] || null;
      const firstName = rowData["meno"] || null;
      const lastName = rowData["priezvisko"] || null;
      const companyName = rowData["nazov_firmy"] || null;
      const email = rowData["email"] || null;
      const phone = rowData["telefon"] || null;

      let subjectId: number | null = null;
      let subjectAction = "none";
      let currentSubjectUid = "";

      if (rc) {
        const existing = allSubjects.find(s => {
          if (!s.birthNumber) return false;
          const decrypted = decryptField(s.birthNumber);
          return decrypted === rc;
        });
        if (existing) {
          subjectId = existing.id;
          subjectAction = "updated";
          currentSubjectUid = existing.uid;
          const updates: any = {};
          if (firstName && firstName !== existing.firstName) updates.firstName = firstName;
          if (lastName && lastName !== existing.lastName) updates.lastName = lastName;
          if (email && email !== existing.email) updates.email = email;
          if (phone && phone !== existing.phone) updates.phone = phone;
          if (Object.keys(updates).length > 0) {
            await db.update(subjects).set(updates).where(eq(subjects.id, existing.id));
            rowWarnings.push(`Subjekt aktualizovaný (${Object.keys(updates).join(", ")})`);
          }
        }
      }

      if (!subjectId && ico) {
        const existing = allSubjects.find(s => {
          if (!s.birthNumber) return false;
          const decrypted = decryptField(s.birthNumber);
          return decrypted === ico;
        });
        if (existing) {
          subjectId = existing.id;
          subjectAction = "updated";
          currentSubjectUid = existing.uid;
          const updates: any = {};
          if (companyName && companyName !== existing.companyName) updates.companyName = companyName;
          if (email && email !== existing.email) updates.email = email;
          if (phone && phone !== existing.phone) updates.phone = phone;
          if (Object.keys(updates).length > 0) {
            await db.update(subjects).set(updates).where(eq(subjects.id, existing.id));
            rowWarnings.push(`Firma aktualizovaná (${Object.keys(updates).join(", ")})`);
          }
        }
      }

      if (!subjectId) {
        const uid = await getNextUid();
        currentSubjectUid = uid;
        const isPerson = !!rc && !ico;
        const type = isPerson ? "person" : "company";

        const newSubject: any = {
          uid,
          type,
          firstName: firstName || null,
          lastName: lastName || null,
          companyName: companyName || null,
          email: email || null,
          phone: phone || null,
          birthNumber: rc ? encryptField(rc) : (ico ? encryptField(ico) : null),
          myCompanyId: activeCompany?.id || null,
          stateId: skState?.id || 1,
          isActive: true,
          bonitaPoints: 0,
          registeredByUserId: defaultUser?.id || 1,
          details: { dynamicFields: {} },
        };

        const [created] = await db.insert(subjects).values(newSubject).returning();
        subjectId = created.id;
        subjectAction = "created";
        allSubjects.push(created);
      }

      const spz = rowData["spz"] || null;
      const vin = rowData["vin"] || null;

      if (spz) {
        const spzUpper = spz.toUpperCase();
        if (vinSpzTracker.has(`spz:${spzUpper}`)) {
          const prev = vinSpzTracker.get(`spz:${spzUpper}`)!;
          stats.duplicityWarnings.push({
            row: rowNum,
            field: "ŠPZ",
            value: spzUpper,
            existingUid: prev.uid,
            newUid: currentSubjectUid,
          });
          rowWarnings.push(`Duplicitná ŠPZ ${spzUpper} – rovnaká ako riadok ${prev.row}`);

          await db.insert(auditLogs).values({
            userId: defaultUser?.id || 1,
            action: "DUPLICITY_WARNING",
            module: "import",
            entityName: `ŠPZ: ${spzUpper}`,
            oldData: { existingSubjectUid: prev.uid },
            newData: { newSubjectUid: currentSubjectUid, batchId, field: "ŠPZ", value: spzUpper },
          });
        }
        vinSpzTracker.set(`spz:${spzUpper}`, { uid: currentSubjectUid, subjectId: subjectId || 0, row: rowNum });
      }

      if (vin) {
        const vinUpper = vin.toUpperCase();
        if (vinSpzTracker.has(`vin:${vinUpper}`)) {
          const prev = vinSpzTracker.get(`vin:${vinUpper}`)!;
          stats.duplicityWarnings.push({
            row: rowNum,
            field: "VIN",
            value: vinUpper,
            existingUid: prev.uid,
            newUid: currentSubjectUid,
          });
          rowWarnings.push(`Duplicitný VIN ${vinUpper} – rovnaký ako riadok ${prev.row}`);

          await db.insert(auditLogs).values({
            userId: defaultUser?.id || 1,
            action: "DUPLICITY_WARNING",
            module: "import",
            entityName: `VIN: ${vinUpper}`,
            oldData: { existingSubjectUid: prev.uid },
            newData: { newSubjectUid: currentSubjectUid, batchId, field: "VIN", value: vinUpper },
          });
        }
        vinSpzTracker.set(`vin:${vinUpper}`, { uid: currentSubjectUid, subjectId: subjectId || 0, row: rowNum });
      }

      const stornoDate = rowData["datum_storna"] || null;
      let contractStatusId = defaultStatus?.id || null;
      let pendingBM = false;

      if (!stornoDate && pendingStatus) {
        contractStatusId = pendingStatus.id;
        pendingBM = true;
        stats.pendingBonusMalus++;
        rowWarnings.push("Chýba dátum storna – čaká na manuálne posúdenie bonusu/malusu");
      }

      const globalNum = await getNextContractNumber();
      const telefon = phone;
      const missingFields: string[] = [];
      if (!spz) missingFields.push("ŠPZ");
      if (!telefon) missingFields.push("Telefón");
      const isIncomplete = missingFields.length > 0;
      if (isIncomplete) stats.incomplete++;

      const contractData: any = {
        uid: `C${String(globalNum).padStart(10, "0")}`,
        contractNumber: rowData["cislo_zmluvy"] || null,
        proposalNumber: rowData["cislo_navrhu"] || null,
        kik: rowData["kik"] || null,
        subjectId,
        klientUid: currentSubjectUid,
        statusId: contractStatusId,
        stateId: skState?.id || 1,
        companyId: activeCompany?.id || null,
        premiumAmount: rowData["lehotne_poistne"] ? parseInt(rowData["lehotne_poistne"]) : null,
        paymentFrequency: rowData["frekvencia"] || null,
        currency: rowData["mena"] || "EUR",
        notes: rowData["poznamky"] || null,
        globalNumber: globalNum,
        uploadedByUserId: defaultUser?.id || 1,
        incompleteData: isIncomplete,
        incompleteDataReason: isIncomplete ? `Chýba: ${missingFields.join(", ")}` : null,
        importedAt: new Date(),
        importBatchId: batchId,
      };

      await db.insert(contracts).values(contractData);

      if (subjectId) {
        const dynUpdates: Record<string, string> = {};
        for (const [headerKey, value] of Object.entries(rowData)) {
          if (!value) continue;
          if (categoryMappings.has(headerKey)) {
            dynUpdates[categoryMappings.get(headerKey)!] = value;
          }
        }

        const directMappings: Record<string, string> = {
          tp_ulica: "tp_ulica",
          tp_mesto: "tp_mesto",
          tp_psc: "tp_psc",
        };
        for (const [csvKey, fieldKey] of Object.entries(directMappings)) {
          if (rowData[csvKey]) {
            dynUpdates[fieldKey] = rowData[csvKey];
          }
        }

        if (Object.keys(dynUpdates).length > 0) {
          const subject = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
          if (subject[0]) {
            const currentDetails = (subject[0].details as any) || {};
            const currentDyn = currentDetails.dynamicFields || {};
            const merged = { ...currentDyn, ...dynUpdates };
            await db.update(subjects).set({
              details: { ...currentDetails, dynamicFields: merged },
            }).where(eq(subjects.id, subjectId));
            rowWarnings.push(`Mapované do kategórií: ${Object.keys(dynUpdates).join(", ")}`);
          }
        }
      }

      if (rowWarnings.length > 0) stats.warnings += rowWarnings.length;

      switch (subjectAction) {
        case "created": stats.created++; break;
        case "updated": stats.updated++; break;
        case "matched": stats.matched++; break;
      }

      stats.success++;
      details.push({ row: rowNum, status: "ok", action: subjectAction, warnings: rowWarnings });
      
      const actionSymbol = subjectAction === "created" ? "🆕" : subjectAction === "updated" ? "🔄" : "✅";
      const warningSymbol = rowWarnings.length > 0 ? ` ⚠️ ${rowWarnings.length}` : "";
      const stornoSymbol = pendingBM ? " 🟡" : "";
      console.log(`  [${rowNum}] ${actionSymbol} ${rowData["meno"] || rowData["nazov_firmy"] || "?"} ${rowData["priezvisko"] || ""} – ${subjectAction}${stornoSymbol}${warningSymbol}`);
      
    } catch (err: any) {
      stats.errors++;
      details.push({ row: rowNum, status: "error", action: "failed", warnings: [err.message] });
      console.log(`  [${rowNum}] ❌ CHYBA: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`VÝSLEDKY IMPORTU`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Celkom riadkov:      ${stats.total}`);
  console.log(`  Úspešných:           ${stats.success}`);
  console.log(`  Chýb:                ${stats.errors}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Nové subjekty:       ${stats.created}`);
  console.log(`  Aktualizované:       ${stats.updated}`);
  console.log(`  Matchnuté (UID):     ${stats.matched}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Čaká na bonus/malus: ${stats.pendingBonusMalus}`);
  console.log(`  Neúplné zmluvy:      ${stats.incomplete}`);
  console.log(`  Upozornenia:         ${stats.warnings}`);
  console.log(`  Duplicity VIN/ŠPZ:   ${stats.duplicityWarnings.length}`);
  
  if (stats.duplicityWarnings.length > 0) {
    console.log(`\n  DUPLICITY VIN/ŠPZ:`);
    for (const dup of stats.duplicityWarnings) {
      console.log(`    Riadok ${dup.row}: ${dup.field} = ${dup.value} | ${dup.existingUid} ↔ ${dup.newUid}`);
    }
  }

  console.log(`\n  Batch ID: ${batchId}`);
  console.log(`${"=".repeat(60)}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("Kritická chyba:", err);
  process.exit(1);
});
