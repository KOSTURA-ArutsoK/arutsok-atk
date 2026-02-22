export type ValidityStatus = "expired" | "expiring" | "valid" | "unknown";

export interface ValidityResult {
  status: ValidityStatus;
  label: string;
  daysRemaining: number | null;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  dotClass: string;
  textClass: string;
}

export function getDocumentValidityStatus(dateValue: string | null | undefined): ValidityResult {
  if (!dateValue) {
    return {
      status: "unknown",
      label: "",
      daysRemaining: null,
      colorClass: "",
      borderClass: "",
      bgClass: "",
      dotClass: "bg-gray-400",
      textClass: "",
    };
  }

  const expiry = new Date(dateValue);
  expiry.setHours(23, 59, 59, 999);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      status: "expired",
      label: "Neplatný",
      daysRemaining,
      colorClass: "text-red-500",
      borderClass: "border-red-500 ring-1 ring-red-500/50",
      bgClass: "bg-red-500/10",
      dotClass: "bg-red-500",
      textClass: "text-red-500 font-semibold",
    };
  }

  if (daysRemaining <= 90) {
    return {
      status: "expiring",
      label: `Expiruje o ${daysRemaining}d`,
      daysRemaining,
      colorClass: "text-orange-500",
      borderClass: "border-orange-500 ring-1 ring-orange-500/50",
      bgClass: "bg-orange-500/10",
      dotClass: "bg-orange-500",
      textClass: "text-orange-500",
    };
  }

  return {
    status: "valid",
    label: "Platný",
    daysRemaining,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/50",
    bgClass: "",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
  };
}

const DOCUMENT_PAIRS: Record<string, string> = {
  op_platnost: "op_cislo",
  pas_platnost: "pas_cislo",
  platnost_dokladu: "cislo_dokladu",
  voz_stk_platnost: "voz_ecv",
  voz_ek_platnost: "voz_ecv",
};

const VALIDITY_FIELD_KEYS = new Set(Object.keys(DOCUMENT_PAIRS));

export function isValidityField(fieldKey: string): boolean {
  return VALIDITY_FIELD_KEYS.has(fieldKey) || fieldKey.endsWith("_platnost");
}

export function getPairedNumberField(validityFieldKey: string): string | null {
  if (DOCUMENT_PAIRS[validityFieldKey]) return DOCUMENT_PAIRS[validityFieldKey];
  const match = validityFieldKey.match(/^(.+)_platnost$/);
  if (match) return `${match[1]}_cislo`;
  return null;
}

export function isNumberFieldWithExpiredPair(
  fieldKey: string,
  allValues: Record<string, string>
): ValidityResult | null {
  for (const [validityKey, numberKey] of Object.entries(DOCUMENT_PAIRS)) {
    if (numberKey === fieldKey) {
      const dateVal = allValues[validityKey];
      if (dateVal) {
        return getDocumentValidityStatus(dateVal);
      }
    }
  }
  const possibleValidityKey = fieldKey.replace(/_cislo$/, "_platnost");
  if (possibleValidityKey !== fieldKey && allValues[possibleValidityKey]) {
    return getDocumentValidityStatus(allValues[possibleValidityKey]);
  }
  return null;
}
