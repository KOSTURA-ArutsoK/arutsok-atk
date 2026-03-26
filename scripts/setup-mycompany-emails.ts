import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, isNotNull } from "drizzle-orm";
import { subjects, companyOfficers } from "../shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const MYCOMPANY_SUBJECTS = [
  { id: 384, name: "KOSTURA, spol. s r.o.", companyId: 22 },
  { id: 387, name: "KFS, spol. s r.o.", companyId: 23 },
];

const EMAIL = "kfs@kostura.sk";

async function main() {
  console.log("=== Setup: email on mycompany subjects (384, 387) ===\n");
  console.log(`Target email: ${EMAIL}`);
  console.log("These subjects will appear in the login picker for kfs@kostura.sk\n");

  for (const mc of MYCOMPANY_SUBJECTS) {
    const [subj] = await db.select().from(subjects).where(eq(subjects.id, mc.id));
    if (!subj) {
      console.error(`Subject ${mc.id} (${mc.name}) not found — skipping`);
      continue;
    }

    console.log(`Subject ${mc.id} (${mc.name}):`);
    console.log(`  current email: ${subj.email ?? "(empty)"}`);
    console.log(`  current phone: ${subj.phone ?? "(empty)"}`);

    const officerWithPhone = await db
      .select({ phone: companyOfficers.phone })
      .from(companyOfficers)
      .where(
        and(
          eq(companyOfficers.companyId, mc.companyId),
          eq(companyOfficers.isActive, true),
          isNotNull(companyOfficers.phone)
        )
      )
      .limit(1);

    const phone = officerWithPhone[0]?.phone ?? subj.phone ?? null;

    await db
      .update(subjects)
      .set({ email: EMAIL, ...(phone ? { phone } : {}) })
      .where(eq(subjects.id, mc.id));

    const [after] = await db.select({ email: subjects.email, phone: subjects.phone }).from(subjects).where(eq(subjects.id, mc.id));
    console.log(`  ✓ email set to: ${after.email}`);
    if (phone) console.log(`  ✓ phone set to: ${after.phone}`);
    console.log();
  }

  console.log("=== Done ===");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
