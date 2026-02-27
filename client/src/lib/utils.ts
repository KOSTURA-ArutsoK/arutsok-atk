import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
  return `${day}.${month}.${year} ${hours}:${minutes}`;
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

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  let digits = phone.replace(/\s+/g, '');
  if (digits.startsWith('00')) {
    digits = '+' + digits.slice(2);
  }
  if (!digits.startsWith('+') && digits.length >= 10) {
    digits = '+' + digits;
  }
  if (digits.startsWith('+') && digits.length >= 12) {
    const cc = digits.slice(0, 4);
    const rest = digits.slice(4);
    const groups = rest.match(/.{1,3}/g) || [];
    return `${cc} ${groups.join(' ')}`;
  }
  if (digits.length >= 9) {
    const groups = digits.match(/.{1,3}/g) || [];
    return groups.join(' ');
  }
  return phone;
};

export function isAuditorReadOnly(appUser: any): boolean {
  if (!appUser) return false;
  return (appUser.sentinelLevel ?? appUser.securityLevel ?? 0) === 9;
}
