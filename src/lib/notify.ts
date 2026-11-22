import { db } from "./db";
import { sendSms, smsText } from "./sms";

/**
 * Records an in-app notification and, when the user has SMS on, texts it to them.
 * Most PH truckers live in SMS/Viber rather than apps, so important events go out by text.
 * Pass sms: false for low-value events that should stay in-app only.
 */
export async function notify(userId: string, message: string, href?: string, opts: { sms?: boolean } = {}) {
  await db.notification.create({ data: { userId, message, href } });
  if (opts.sms === false) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true, smsEnabled: true } });
  if (user?.phone && user.smsEnabled) await sendSms(userId, user.phone, smsText(message, href));
}
