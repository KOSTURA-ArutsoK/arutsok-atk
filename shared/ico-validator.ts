export interface ICOValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

export function validateSlovakICO(ico: string | null | undefined): ICOValidationResult {
  if (!ico || !ico.trim()) return { valid: false, error: "Prázdne IČO" };

  const cleaned = ico.replace(/[\s\/-]/g, "");

  if (!/^\d+$/.test(cleaned)) return { valid: false, error: "IČO smie obsahovať iba číslice" };

  if (cleaned.length > 8) return { valid: false, error: `Nesprávna dĺžka (${cleaned.length} číslic, povolených je 8)` };

  const padded = cleaned.padStart(8, "0");

  const weights = [8, 7, 6, 5, 4, 3, 2];
  let weightedSum = 0;
  for (let i = 0; i < 7; i++) {
    weightedSum += parseInt(padded[i], 10) * weights[i];
  }

  const remainder = weightedSum % 11;
  let expectedK: number;
  if (remainder === 0) {
    expectedK = 1;
  } else if (remainder === 1) {
    expectedK = 0;
  } else {
    expectedK = 11 - remainder;
  }

  const actualK = parseInt(padded[7], 10);

  if (expectedK !== actualK) {
    return { valid: false, normalized: padded, error: "Neplatné IČO (chybná kontrolná číslica)" };
  }

  return { valid: true, normalized: padded };
}
