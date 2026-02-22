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

const VALIDITY_FROM_DATE_FIELDS: Record<string, { validDays: number; label: string }> = {
  inv_datum_dotaznika: { validDays: 365, label: "Revízia investičného dotazníka" },
};

export function getValidityFromDateStatus(fieldKey: string, dateValue: string | null | undefined): ValidityResult | null {
  const config = VALIDITY_FROM_DATE_FIELDS[fieldKey];
  if (!config || !dateValue) return null;

  const filledDate = new Date(dateValue);
  const expiryDate = new Date(filledDate);
  expiryDate.setDate(expiryDate.getDate() + config.validDays);
  expiryDate.setHours(23, 59, 59, 999);

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      status: "expired",
      label: `${config.label} – expirovaný`,
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
      label: `${config.label} – o ${daysRemaining}d`,
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

export function isValidityFromDateField(fieldKey: string): boolean {
  return fieldKey in VALIDITY_FROM_DATE_FIELDS;
}

const CONTRACT_ANNIVERSARY_PARAMS: Record<number, { warningDays: number; label: string }> = {
  54: { warningDays: 42, label: "Výročie zmluvy" },
};

export function getContractAnniversaryStatus(parameterId: number, dateValue: string | null | undefined): ValidityResult | null {
  const config = CONTRACT_ANNIVERSARY_PARAMS[parameterId];
  if (!config || !dateValue) return null;

  const annivDate = new Date(dateValue);
  if (isNaN(annivDate.getTime())) return null;
  const now = new Date();
  const thisYear = now.getFullYear();

  let nextAnniv = new Date(annivDate);
  nextAnniv.setFullYear(thisYear);
  if (nextAnniv < now) nextAnniv.setFullYear(thisYear + 1);

  const diffMs = nextAnniv.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil <= config.warningDays) {
    return {
      status: "expiring",
      label: `${config.label} – o ${daysUntil} dní`,
      daysRemaining: daysUntil,
      colorClass: "text-orange-500",
      borderClass: "border-orange-500 ring-1 ring-orange-500/50",
      bgClass: "bg-orange-500/10",
      dotClass: "bg-orange-500",
      textClass: "text-orange-500",
    };
  }

  return {
    status: "valid",
    label: `${config.label} – o ${daysUntil} dní`,
    daysRemaining: daysUntil,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/50",
    bgClass: "",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
  };
}

export function isContractAnniversaryParam(parameterId: number): boolean {
  return parameterId in CONTRACT_ANNIVERSARY_PARAMS;
}

const GAP_PARAM_ID = 73;
const CONTRACT_END_PARAM_ID = 50;

export function getGapInsuranceStatus(gapEndDate: string | null | undefined, contractEndDate: string | null | undefined): ValidityResult | null {
  if (!gapEndDate) return null;
  const gapEnd = new Date(gapEndDate);
  if (isNaN(gapEnd.getTime())) return null;

  const now = new Date();
  const diffFromNow = Math.ceil((gapEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffFromNow <= 0) {
    return {
      status: "expired",
      label: `GAP poistenie – vypršané`,
      daysRemaining: diffFromNow,
      colorClass: "text-red-500",
      borderClass: "border-red-500 ring-1 ring-red-500/50",
      bgClass: "bg-red-500/10",
      dotClass: "bg-red-500",
      textClass: "text-red-500",
    };
  }

  if (contractEndDate) {
    const contractEnd = new Date(contractEndDate);
    if (!isNaN(contractEnd.getTime()) && gapEnd < contractEnd) {
      const gapBeforeContract = Math.ceil((contractEnd.getTime() - gapEnd.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: "expiring",
        label: `GAP končí ${gapBeforeContract} dní pred zmluvou`,
        daysRemaining: diffFromNow,
        colorClass: "text-orange-500",
        borderClass: "border-orange-500 ring-1 ring-orange-500/50",
        bgClass: "bg-orange-500/10",
        dotClass: "bg-orange-500",
        textClass: "text-orange-500",
      };
    }
  }

  return {
    status: "valid",
    label: `GAP poistenie – platné (${diffFromNow} dní)`,
    daysRemaining: diffFromNow,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/50",
    bgClass: "",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
  };
}

export function isGapParam(parameterId: number): boolean {
  return parameterId === GAP_PARAM_ID;
}

export { GAP_PARAM_ID, CONTRACT_END_PARAM_ID };

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
