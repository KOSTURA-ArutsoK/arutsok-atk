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
