import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const NAVRH_LABEL_FULL = "Návrh zmluvy / zmluva o budúcej zmluve";
export const NAVRH_LABEL_SHORT = "Návrh zmluvy \u2026";

export const formatDateSlovak = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

export const formatDateTimeSlovak = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
};

export const formatTimestampForFile = (date?: Date): string => {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}_${h}${min}${sec}`;
};

export const formatUid = (uid: string | null | undefined): string => {
  if (!uid) return '-';
  const digits = uid.replace(/\D/g, '');
  if (!digits.length) return uid;
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 3) {
    groups.push(digits.slice(i, i + 3));
  }
  return groups.join(' ');
};

export const expandUid = (input: string, prefix: string = "421"): string => {
  if (!input || !input.trim()) return "";
  const digits = input.replace(/\D/g, '');
  if (!digits.length) return input;
  const prefixDigits = prefix.replace(/\D/g, '') || "421";
  const totalLen = 15;
  let full: string;
  if (digits.length >= totalLen) {
    full = digits.slice(0, totalLen);
  } else if (digits.startsWith(prefixDigits) && digits.length > prefixDigits.length) {
    full = digits.padStart(totalLen, '0');
  } else {
    const suffixLen = totalLen - prefixDigits.length;
    full = prefixDigits + digits.padStart(suffixLen, '0');
  }
  const groups: string[] = [];
  for (let i = 0; i < full.length; i += 3) {
    groups.push(full.slice(i, i + 3));
  }
  return groups.join(' ');
};

export type DateSemaphoreStatus = "expired" | "warning" | "ok" | null;

export function getDateSemaphore(dateValue: string | Date | null | undefined): DateSemaphoreStatus {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "warning";
  return "ok";
}

export function getDateSemaphoreClasses(status: DateSemaphoreStatus): string {
  switch (status) {
    case "expired": return "bg-red-500/15 border-red-500/30 ring-1 ring-red-500/20";
    case "warning": return "bg-orange-500/15 border-orange-500/30 ring-1 ring-orange-500/20";
    default: return "";
  }
}

export function isSemaphoreDateField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  const keywords = ["platnost", "expir", "stk", "vyrocie", "ukonc", "valid_to", "valid_from", "end_date", "expiry"];
  return keywords.some(k => lower.includes(k));
}

const PHONE_FLAG_MAP: Array<[string, string]> = [
  ['+421', '🇸🇰'], ['+420', '🇨🇿'], ['+380', '🇺🇦'], ['+358', '🇫🇮'],
  ['+351', '🇵🇹'], ['+359', '🇧🇬'], ['+385', '🇭🇷'], ['+386', '🇸🇮'],
  ['+381', '🇷🇸'], ['+353', '🇮🇪'], ['+354', '🇮🇸'], ['+371', '🇱🇻'],
  ['+370', '🇱🇹'], ['+372', '🇪🇪'], ['+48', '🇵🇱'],  ['+49', '🇩🇪'],
  ['+43', '🇦🇹'],  ['+36', '🇭🇺'],  ['+44', '🇬🇧'],  ['+33', '🇫🇷'],
  ['+39', '🇮🇹'],  ['+34', '🇪🇸'],  ['+31', '🇳🇱'],  ['+32', '🇧🇪'],
  ['+41', '🇨🇭'],  ['+45', '🇩🇰'],  ['+46', '🇸🇪'],  ['+47', '🇳🇴'],
  ['+40', '🇷🇴'],  ['+30', '🇬🇷'],  ['+90', '🇹🇷'],  ['+7', '🇷🇺'],
  ['+1', '🇺🇸'],
];

export const normalizePhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  let c = raw.replace(/[^\d+]/g, '');
  c = c.replace(/\++/g, '+').replace(/(?!^)\+/g, '');
  if (c.startsWith('00')) c = '+' + c.slice(2);
  if (/^09\d{8}$/.test(c)) c = '+421' + c.slice(1);
  else if (/^9\d{8}$/.test(c)) c = '+421' + c;
  return c;
};

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  const n = normalizePhone(phone);
  if (!n) return phone;
  if (n.startsWith('+')) {
    for (const [prefix, flag] of PHONE_FLAG_MAP) {
      if (n.startsWith(prefix)) {
        const rest = n.slice(prefix.length);
        const groups = rest.match(/.{1,3}/g) || [];
        return `${flag} ${prefix} ${groups.join(' ')}`;
      }
    }
    const cc = n.slice(0, 4);
    const rest = n.slice(4);
    const groups = rest.match(/.{1,3}/g) || [];
    return `📞 ${cc} ${groups.join(' ')}`;
  }
  if (n.length >= 9) {
    const groups = n.match(/.{1,3}/g) || [];
    return groups.join(' ');
  }
  return phone;
};

export function isAdmin(appUser: any): boolean {
  if (!appUser) return false;
  return ['admin', 'superadmin', 'prezident', 'architekt'].includes(appUser.role);
}

export function isRecommender(appUser: any): boolean {
  if (!appUser) return false;
  const pgName = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
  return pgName.includes("odporucitel") || pgName.includes("odporúčateľ") || pgName.includes("recommender");
}

export function rcToBirthDateStr(rc: string | null | undefined): string {
  if (!rc) return "—";
  const cleaned = rc.replace(/[\s\/-]/g, "");
  if (!/^\d{9,10}$/.test(cleaned)) return "—";
  const yy = parseInt(cleaned.substring(0, 2), 10);
  let mm = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);
  let year: number;
  if (cleaned.length === 9) year = 1900 + yy;
  else year = yy >= 54 ? 1900 + yy : 2000 + yy;
  if (mm > 70) mm -= 70;
  else if (mm > 50) mm -= 50;
  else if (mm > 20) mm -= 20;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "—";
  return `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${year}`;
}

export function isArchitekt(appUser: any): boolean {
  if (!appUser) return false;
  return appUser.role === 'architekt' || appUser.role === 'superadmin' || appUser.role === 'prezident';
}

export function canCreateRecords(appUser: any): boolean {
  return !!appUser;
}

export function canCreateSubjects(appUser: any): boolean {
  return !!appUser;
}

export function canDeleteRecords(appUser: any): boolean {
  return isAdmin(appUser);
}

export function canEditRecords(appUser: any): boolean {
  return !!appUser;
}

const TITLES_BEFORE = [
  "Ing. arch.", "prof.", "doc.", "Ing.", "Mgr.", "Bc.", "JUDr.", "MUDr.", "PhDr.", "RNDr.",
  "MVDr.", "ThDr.", "PharmDr.", "PaedDr.", "RSDr.", "DiS.",
  "MgA.", "BcA.", "ThLic.", "ICDr.",
].sort((a, b) => b.length - a.length);
const TITLES_AFTER = [
  "PhD.", "Ph.D.", "CSc.", "DrSc.", "MBA", "MSc.", "LL.M.", "MPH", "DBA", "ArtD.",
  "DiS.",
].sort((a, b) => b.length - a.length);

export function parsePersonName(fullName: string): {
  titleBefore: string;
  firstName: string;
  lastName: string;
  titleAfter: string;
} {
  if (!fullName || !fullName.trim()) {
    return { titleBefore: "", firstName: "", lastName: "", titleAfter: "" };
  }

  let remaining = fullName.trim();
  const foundBefore: string[] = [];
  const foundAfter: string[] = [];

  let afterChanged = true;
  while (afterChanged) {
    afterChanged = false;
    for (const t of TITLES_AFTER) {
      const escaped = t.replace(/\./g, "\\.").replace(/\s/g, "\\s");
      const pattern = new RegExp(`[,\\s]+${escaped}\\s*$`, "i");
      if (pattern.test(remaining)) {
        remaining = remaining.replace(pattern, "").trim();
        foundAfter.unshift(t);
        afterChanged = true;
        break;
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const t of TITLES_BEFORE) {
      const escaped = t.replace(/\./g, "\\.").replace(/\s/g, "\\s");
      const pattern = new RegExp(`^${escaped}\\s+`, "i");
      if (pattern.test(remaining)) {
        remaining = remaining.replace(pattern, "").trim();
        foundBefore.push(t);
        changed = true;
        break;
      }
    }
  }

  remaining = remaining.replace(/,\s*$/, "").trim();

  const nameParts = remaining.split(/\s+/).filter(Boolean);
  let firstName = "";
  let lastName = "";
  if (nameParts.length === 1) {
    lastName = nameParts[0];
  } else if (nameParts.length === 2) {
    firstName = nameParts[0];
    lastName = nameParts[1];
  } else if (nameParts.length >= 3) {
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(" ");
  }

  return {
    titleBefore: foundBefore.join(" "),
    firstName,
    lastName,
    titleAfter: foundAfter.join(" "),
  };
}
