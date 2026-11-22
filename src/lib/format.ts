const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export const php = (n: number | null | undefined) => (n == null ? "—" : peso.format(n));
export const fmtDate = (d: Date) => dateFmt.format(d);
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);
export const fmtRange = (a: Date, b: Date) => `${fmtDate(a)} – ${fmtDate(b)}`;
export const km = (n: number) => `${Math.round(n).toLocaleString("en-PH")} km`;

/** Parse an <input type="date"> value as a Manila-local date. */
export function parseManilaDate(value: string, endOfDay = false): Date {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`);
}

/** Format a Date for an <input type="date"> value, in Manila time. */
export function toDateInput(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
}
