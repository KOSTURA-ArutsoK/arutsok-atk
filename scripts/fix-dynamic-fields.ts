import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, gte, and, isNull } from "drizzle-orm";
import { subjects } from "../shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("Fixing dynamicFields for seeded subjects...\n");

  const allSubjects = await db.select().from(subjects)
    .where(and(gte(subjects.id, 22), isNull(subjects.deletedAt)));

  let fixed = 0;
  for (const subj of allSubjects) {
    const details = (subj.details || {}) as any;
    const df = details.dynamicFields || {};

    const hasNestedCategories = Object.keys(df).some(k => k.startsWith("category_"));
    if (!hasNestedCategories) {
      continue;
    }

    const newDf: Record<string, string> = {};

    if (subj.type === "person") {
      const cat1 = df.category_1 || {};
      if (cat1.datumNarodenia) newDf.datum_narodenia = cat1.datumNarodenia;
      if (cat1.miestNarodenia) newDf.miesto_narodenia = cat1.miestNarodenia;
      if (cat1.statnaInstitucia) newDf.statna_prislusnost = cat1.statnaInstitucia;
      if (cat1.rodinnyStav) newDf.rodinny_stav = cat1.rodinnyStav;

      const cat3 = df.category_3 || {};
      if (cat3.trvBydliskoUlica) newDf.tp_ulica = cat3.trvBydliskoUlica;
      if (cat3.trvBydliskoMesto) newDf.tp_mesto = cat3.trvBydliskoMesto;
      if (cat3.trvBydliskoPsc) newDf.tp_psc = cat3.trvBydliskoPsc;
      newDf.tp_stat = "Slovensko";

      const cat5 = df.category_5 || {};
      if (cat5.zamestnanie) newDf.zamestnanie = cat5.zamestnanie;
      if (cat5.mesacnyPrijem) newDf.mesacny_prijem = cat5.mesacnyPrijem;
    } else {
      const cat32 = df.category_32 || {};
      if (cat32.skNace) newDf.sk_nace = cat32.skNace;
      if (cat32.obrat) newDf.obrat = cat32.obrat;
      if (cat32.pocetZamestnancov) newDf.pocet_zamestnancov = cat32.pocetZamestnancov;

      const cat31 = df.category_31 || {};
      if (cat31.ico) newDf.ico = cat31.ico;
      if (cat31.dic) newDf.dic = cat31.dic;
      if (cat31.icDph) newDf.ic_dph = cat31.icDph;

      if (details.address) {
        newDf.sidlo_ulica = details.address.street || "";
        newDf.sidlo_mesto = details.address.city || "";
        newDf.sidlo_psc = details.address.zip || "";
        newDf.sidlo_stat = details.address.country || "Slovensko";
      }
    }

    const updatedDetails = {
      ...details,
      dynamicFields: newDf,
    };

    await db.update(subjects).set({ details: updatedDetails }).where(eq(subjects.id, subj.id));
    fixed++;

    const label = subj.type === "person"
      ? `${subj.firstName} ${subj.lastName}`
      : subj.companyName;
    console.log(`  Fixed #${subj.id}: ${label} (${Object.keys(newDf).length} fields)`);
  }

  console.log(`\nDone! Fixed ${fixed} subjects.`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
