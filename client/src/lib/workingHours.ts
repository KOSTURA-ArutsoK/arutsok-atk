// Working hours utility for Slovakia — ArutsoK #247

const WORK_START = 8;
const WORK_END = 17;
const SLA_HOURS_PER_DAY = 8;
const SLA_WORKING_MINUTES = 3 * SLA_HOURS_PER_DAY * 60;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getSkHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`,
    `${year}-01-06`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-05`,
    `${year}-08-29`,
    `${year}-09-01`,
    `${year}-09-15`,
    `${year}-11-01`,
    `${year}-11-17`,
    `${year}-12-24`,
    `${year}-12-25`,
    `${year}-12-26`,
  ];

  const easter = easterSunday(year);
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
  const easterMonday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1);

  return new Set([...fixed, toLocalYMD(goodFriday), toLocalYMD(easterMonday)]);
}

function isWorkingDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  const holidays = getSkHolidays(date.getFullYear());
  return !holidays.has(toLocalYMD(date));
}

export function calculateWorkingMinutesElapsed(createdAt: Date, now: Date = new Date()): number {
  if (now <= createdAt) return 0;

  let elapsed = 0;
  const cursor = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), WORK_START, 0, 0, 0);

  while (cursor < now) {
    if (!isWorkingDay(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), WORK_START, 0, 0, 0);
    const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), WORK_END, 0, 0, 0);

    const periodStart = createdAt > dayStart ? createdAt : dayStart;
    const periodEnd = now < dayEnd ? now : dayEnd;

    if (periodStart < periodEnd) {
      const dayMinutes = (periodEnd.getTime() - periodStart.getTime()) / 60000;
      elapsed += Math.min(dayMinutes, SLA_HOURS_PER_DAY * 60);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.round(elapsed);
}

export function getRemainingWorkingMinutes(createdAt: Date, now: Date = new Date(), slaMinutes: number = SLA_WORKING_MINUTES): number {
  const elapsed = calculateWorkingMinutesElapsed(createdAt, now);
  return Math.max(0, slaMinutes - elapsed);
}

export function formatRemainingHHMM(createdAt: Date, now: Date = new Date(), slaMinutes: number = SLA_WORKING_MINUTES): string {
  const remaining = getRemainingWorkingMinutes(createdAt, now, slaMinutes);
  if (remaining <= 0) return "ONESKORENÉ";
  const hh = Math.floor(remaining / 60);
  const mm = remaining % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function isOverdue(createdAt: Date, now: Date = new Date(), slaMinutes: number = SLA_WORKING_MINUTES): boolean {
  return getRemainingWorkingMinutes(createdAt, now, slaMinutes) === 0;
}

export function isAdminAlert(createdAt: Date, now: Date = new Date()): boolean {
  const elapsed = calculateWorkingMinutesElapsed(createdAt, now);
  return elapsed >= 15 * SLA_HOURS_PER_DAY * 60;
}
