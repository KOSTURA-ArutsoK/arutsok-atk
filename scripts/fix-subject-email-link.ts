import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { subjects, appUsers } from "../shared/schema";
import { encryptField, decryptField } from "../server/crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("=== Fix: subject email/phone/birth_number linking for kfs@kostura.sk ===\n");

  const SUBJECT_ID = 383;
  const APP_USER_ID = 1;
  const EMAIL = "kfs@kostura.sk";
  const PHONE = "+421907933528";
  const BIRTH_NUMBER_PLAIN = "8001158605";

  const [subj] = await db.select().from(subjects).where(eq(subjects.id, SUBJECT_ID));
  if (!subj) {
    console.error(`Subject ${SUBJECT_ID} not found!`);
    process.exit(1);
  }
  console.log("Subject 383 current state:");
  console.log(`  email:        ${subj.email ?? "(empty)"}`);
  console.log(`  phone:        ${subj.phone ?? "(empty)"}`);
  console.log(`  birth_number: ${subj.birthNumber ?? "(empty)"}`);

  let birthNumberEncrypted: string;
  if (subj.birthNumber) {
    const decrypted = decryptField(subj.birthNumber);
    if (decrypted !== null) {
      console.log(`  → birth_number is already encrypted (decrypts to: ${decrypted})`);
      birthNumberEncrypted = subj.birthNumber;
    } else {
      console.log(`  → birth_number appears to be plain text — encrypting now`);
      birthNumberEncrypted = encryptField(BIRTH_NUMBER_PLAIN);
    }
  } else {
    console.log(`  → birth_number is empty — encrypting`);
    birthNumberEncrypted = encryptField(BIRTH_NUMBER_PLAIN);
  }

  await db.update(subjects)
    .set({
      email: EMAIL,
      phone: PHONE,
      birthNumber: birthNumberEncrypted,
    } as any)
    .where(eq(subjects.id, SUBJECT_ID));

  console.log(`\n✓ Subject ${SUBJECT_ID} updated: email, phone, birth_number (encrypted)`);

  await db.update(appUsers)
    .set({ linkedSubjectId: SUBJECT_ID } as any)
    .where(eq(appUsers.id, APP_USER_ID));

  console.log(`✓ AppUser ${APP_USER_ID} updated: linked_subject_id = ${SUBJECT_ID}`);

  const [subjAfter] = await db.select().from(subjects).where(eq(subjects.id, SUBJECT_ID));
  const [userAfter] = await db.select().from(appUsers).where(eq(appUsers.id, APP_USER_ID));
  console.log("\n=== Verification ===");
  console.log(`Subject 383 email:        ${subjAfter.email}`);
  console.log(`Subject 383 phone:        ${subjAfter.phone}`);
  console.log(`Subject 383 birth_number: ${subjAfter.birthNumber ? "(encrypted, length " + subjAfter.birthNumber.length + ")" : "(empty)"}`);
  console.log(`AppUser 1 linked_subject: ${(userAfter as any).linkedSubjectId}`);

  const decryptCheck = decryptField(subjAfter.birthNumber!);
  console.log(`Decrypt check:            ${decryptCheck}`);

  await pool.end();
  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
