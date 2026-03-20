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
    if (yy >= 54) {
      year = 1900 + yy;
    } else {
      year = 2000 + yy;
    }
  } else {
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
    const rcNum = parseInt(cleaned, 10);
    if (rcNum % 11 !== 0) {
      const first9 = parseInt(cleaned.substring(0, 9), 10);
      const remainder = first9 % 11;
      const lastDigit = parseInt(cleaned[9], 10);
      if (remainder === 10 && lastDigit === 0) {
        // valid
      } else {
        return { valid: false, error: "Kontrolná číslica (MOD11) nesedí" };
      }
    }
  }

  return { valid: true, birthDate: { year, month: mm, day: dd }, gender };
}
