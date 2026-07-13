// Date helpers working on "YYYY-MM-DD" strings (local, timezone-free).

export function todayIso(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function toIso(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** ISO-8601 week id, e.g. "2026-W29" — must match Android's DateUtils.weekId. */
export function isoWeekId(iso: string): string {
  const date = fromIso(iso);
  // Thursday of the current week decides the ISO year/week.
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setDate(target.getDate() - dayNr + 3);
  const isoYear = target.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${week.toString().padStart(2, '0')}`;
}

/** First day of the display week; honours the browser locale where supported. */
export function firstDayOfWeek(): number {
  try {
    // weekInfo.firstDay: 1 = Monday ... 7 = Sunday
    const loc = new Intl.Locale(navigator.language) as unknown as { weekInfo?: { firstDay?: number } };
    const info = loc.weekInfo ?? (loc as unknown as { getWeekInfo?: () => { firstDay?: number } }).getWeekInfo?.();
    return info?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

/** The 7 ISO dates of the display week containing `iso`. */
export function displayWeekDates(iso: string): string[] {
  const first = firstDayOfWeek() % 7; // JS: Sun=0
  const d = fromIso(iso);
  const back = (d.getDay() - first + 7) % 7;
  const start = addDays(iso, -back);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function prettyDate(iso: string): string {
  const d = fromIso(iso);
  return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDate(iso: string): string {
  const d = fromIso(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dow(iso: string): string {
  return DOWS[fromIso(iso).getDay()];
}

export function weekHeader(iso: string): string {
  const days = displayWeekDates(iso);
  return `${shortDate(days[0])} – ${shortDate(days[6])} · ${isoWeekId(days[3])}`;
}
