import { db } from "./db";

const SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages";

/** Semaphore wants 09XXXXXXXXX; we store either 09… or +639…. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^639\d{9}$/.test(digits)) return "0" + digits.slice(2);
  if (/^09\d{9}$/.test(digits)) return digits;
  return null;
}

/** SMS are kept short: one 160-char segment, with a link back to the app. */
export function smsText(message: string, href?: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  const link = href && base ? ` ${base}${href}` : "";
  const prefix = "BalikKarga: ";
  const room = 160 - prefix.length - link.length;
  const body = message.length > room ? message.slice(0, room - 1) + "…" : message;
  return prefix + body + link;
}

/**
 * Sends an SMS through Semaphore. Without SEMAPHORE_API_KEY it runs in test mode
 * and only logs the message (visible on the admin page). Never throws.
 */
export async function sendSms(userId: string | null, phone: string, message: string) {
  const number = normalizePhone(phone);
  if (!number) {
    await db.smsLog.create({ data: { userId, phone, message, status: "FAILED", error: "Invalid PH mobile number" } });
    return;
  }
  const apikey = process.env.SEMAPHORE_API_KEY;
  if (!apikey) {
    await db.smsLog.create({ data: { userId, phone: number, message, status: "TEST" } });
    return;
  }
  try {
    const body = new URLSearchParams({ apikey, number, message, sendername: process.env.SEMAPHORE_SENDER_NAME || "SEMAPHORE" });
    const res = await fetch(SEMAPHORE_URL, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    const ok = res.ok;
    await db.smsLog.create({
      data: { userId, phone: number, message, status: ok ? "SENT" : "FAILED", error: ok ? null : `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` },
    });
  } catch (e) {
    await db.smsLog.create({ data: { userId, phone: number, message, status: "FAILED", error: String(e).slice(0, 200) } });
  }
}
