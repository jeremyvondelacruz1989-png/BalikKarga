import { db } from "./db";

/**
 * Records an in-app notification. This is the single place to plug in SMS/Viber
 * (e.g. Semaphore, Twilio, Viber Business Messages) when going live — most PH
 * truckers live in Viber/SMS, not in apps.
 */
export async function notify(userId: string, message: string, href?: string) {
  await db.notification.create({ data: { userId, message, href } });
  if (process.env.NODE_ENV !== "test") console.log(`[notify → ${userId}] ${message}`);
}
