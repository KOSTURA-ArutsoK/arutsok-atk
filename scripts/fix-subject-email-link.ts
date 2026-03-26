import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, isNotNull } from "drizzle-orm";
import { subjects, appUsers, companyOfficers } from "../shared/schema";
import { encryptField, decryptField } from "../server/crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("=== Fix: subject email/phone/birth_number linking for kfs@kostura.sk ===\n");

  const SUBJECT_ID = 383;
  const APP_USER_ID = 1;
  const EMAIL = "kfs@kostura.sk";

  const [subj] = await db.select().from(subjects).where(eq(subjects.id, SUBJECT_ID));
  if (!subj) {
    console.error(`Subject ${SUBJECT_ID} not found!`);
    process.exit(1);
  }
  console.log("Subject current state:");
  console.log(`  email:        ${subj.email ?? "(empty)"}`);
  console.log(`  phone:        ${subj.phone ?? "(empty)"}`);
  console.log(`  birth_number: ${subj.birthNumber ? "(set, length " + subj.birthNumber.length + ")" : "(empty)"}`);

  let finalBirthNumber: string;
  if (subj.birthNumber) {
    const decrypted = decryptField(subj.birthNumber);
    if (decrypted !== null) {
      console.log("  → birth_number is already properly encrypted, keeping as-is");
      finalBirthNumber = subj.birthNumber;
    } else {
      console.log("  → birth_number decryption failed; treating existing value as plaintext — encrypting");
      finalBirthNumber = encryptField(subj.birthNumber);
    }
  } else {
    console.error("  → birth_number is empty — cannot fix automatically, manual intervention required");
    process.exit(1);
  }

  const officersLinked = await db
    .select({ phone: companyOfficers.phone, email: companyOfficers.email })
    .from(companyOfficers)
    .where(and(eq(companyOfficers.subjectId, SUBJECT_ID), isNotNull(companyOfficers.phone)));

  const officerPhone = officersLinked.find((o) => o.phone)?.phone ?? null;
  if (!officerPhone) {
    console.error("  → No phone found in linked officer records; cannot set phone — manual intervention required");
    process.exit(1);
  }
  console.log(`  → Phone sourced from linked officer records`);

  await db.update(subjects)
    .set({
      email: EMAIL,
      phone: officerPhone,
      birthNumber: finalBirthNumber,
    })
    .where(eq(subjects.id, SUBJECT_ID));

  console.log(`\n✓ Subject ${SUBJECT_ID} updated: email, phone, birth_number`);

  await db.update(appUsers)
    .set({ linkedSubjectId: SUBJECT_ID })
    .where(eq(appUsers.id, APP_USER_ID));

  console.log(`✓ AppUser ${APP_USER_ID} updated: linked_subject_id = ${SUBJECT_ID}`);

  const [subjAfter] = await db.select().from(subjects).where(eq(subjects.id, SUBJECT_ID));
  const [userAfter] = await db.select().from(appUsers).where(eq(appUsers.id, APP_USER_ID));

  const decryptOk = decryptField(subjAfter.birthNumber!) !== null;

  console.log("\n=== Verification ===");
  console.log(`Subject ${SUBJECT_ID} email:           ${subjAfter.email}`);
  console.log(`Subject ${SUBJECT_ID} phone:           ${subjAfter.phone}`);
  console.log(`Subject ${SUBJECT_ID} birth_number:    ${subjAfter.birthNumber ? "(encrypted, len=" + subjAfter.birthNumber.length + ")" : "(empty)"}`);
  console.log(`Subject ${SUBJECT_ID} decrypt check:   ${decryptOk ? "OK" : "FAILED"}`);
  console.log(`AppUser ${APP_USER_ID} linked_subject: ${userAfter.linkedSubjectId}`);

  await pool.end();
  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
