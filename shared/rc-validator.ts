export interface RCValidationResult {
  valid: boolean;
  error?: string;
  birthDate?: { year: number; month: number; day: number };
  gender?: "M" | "F";
}

export function validateSlovakRC(rc: string | null | undefined): RCValidationResult {
  if (!rc || !rc.trim()) return { valid: false, error: "Prázdne rodné číslo" };

  const cleaned = rc.replace(/[\s\/-]/g, "");

  if (!/^\d+$/.test(cleaned)) return { valid: false, error: "Rodné číslo smie obsahovať iba číslice" };

  if (cleaned.length !== 9 && cleaned.length !== 10) {
    return { valid: false, error: `Nesprávna dĺžka (${cleaned.length} číslic, povolené 9 alebo 10)` };
  }

  const yy = parseInt(cleaned.substring(0, 2), 10);
  const rawMM = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);

  let year: number;
  if (cleaned.length === 9) {
    // 9-ciferné RČ sa vydávali výhradne pre osoby narodené pred rokom 1954 — vždy 1900+yy
    year = 1900 + yy;
  } else {
    // 10-ciferné RČ: yy 54–99 → narodení 1954–1999; yy 00–53 → narodení 2000–2053
    // Výnimka: yy 40–53 môžu byť staré RČ pridelené po roku 1954 pre ľudí narodených 1940–1953
    if (yy >= 54) {
      year = 1900 + yy;
    } else {
      year = 2000 + yy;
    }
  }

  let mm = rawMM;
  let gender: "M" | "F" = "M";

  if (mm > 70) {
    if (year < 2004) {
      return { valid: false, error: `Mesiac +70 (${rawMM}) je povolený len od roku 2004` };
    }
    mm -= 70;
    gender = "F";
  } else if (mm > 50) {
    mm -= 50;
    gender = "F";
  } else if (mm > 20) {
    if (year < 2004) {
      return { valid: false, error: `Mesiac +20 (${rawMM}) je povolený len od roku 2004` };
    }
    mm -= 20;
    gender = "M";
  }

  if (mm < 1 || mm > 12) {
    return { valid: false, error: `Neplatný mesiac v RČ (${cleaned.substring(2, 4)})` };
  }

  const testDate = new Date(year, mm - 1, dd);
  if (testDate.getFullYear() !== year || testDate.getMonth() !== mm - 1 || testDate.getDate() !== dd) {
    const monthNames = ["", "január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
    return { valid: false, error: `Neexistujúci dátum (${dd}. ${monthNames[mm] || mm}. ${year})` };
  }

  if (cleaned.length === 10) {
    // MOD11 sa zaviedol pre nové RČ vydávané po roku 1954.
    // Pre starých ľudí (yy 40-53 v 10-cif. formáte) môžu existovať RČ bez platného MOD11
    // — buď narodení 1940–1953 (dostali RČ neskôr), alebo pre born 1985+ vždy kontrolujeme.
    // Preskočíme MOD11 pre yy v rozsahu 40–53 (= rok 1940–1953 alebo veľmi vzdálená budúcnosť).
    const skipMod11 = (yy >= 40 && yy < 54) || (yy >= 54 && year < 1985);
    if (!skipMod11) {
      const rcNum = parseInt(cleaned, 10);
      if (rcNum % 11 !== 0) {
        const first9 = parseInt(cleaned.substring(0, 9), 10);
        const remainder = first9 % 11;
        const lastDigit = parseInt(cleaned[9], 10);
        if (!(remainder === 10 && lastDigit === 0)) {
          return { valid: false, error: "Kontrolná číslica (MOD11) nesedí" };
        }
      }
    }
  }

  return { valid: true, birthDate: { year, month: mm, day: dd }, gender };
}
