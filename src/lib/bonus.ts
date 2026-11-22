import { db } from "./db";
import { DOC_TYPES } from "./constants";
import { notify } from "./notify";

// The trucker welcome bonus is reserved at sign-up (a PENDING SIGNUP_BONUS row,
// which also locks the mobile number) and credited once the trucker's required
// verification documents are all approved.

/** Documents a trucker needs approved to unlock the bonus. Business registration is optional for small operators. */
export const BONUS_PERSONAL_DOCS = ["GOV_ID", "DRIVERS_LICENSE"] as const;
export const BONUS_TRUCK_DOCS = ["OR_CR", "LTFRB_CPC"] as const;

type Doc = { docType: string; status: string; truckId: string | null };

/** Labels of what is still missing; empty when the bonus can be released. */
export function missingBonusDocs(docs: Doc[], truckIds: string[]): string[] {
  const approved = docs.filter((d) => d.status === "APPROVED");
  const missing: string[] = BONUS_PERSONAL_DOCS.filter((t) => !approved.some((d) => d.docType === t)).map(
    (t) => DOC_TYPES[t].label,
  );
  const truckDone = truckIds.some((id) =>
    BONUS_TRUCK_DOCS.every((t) => approved.some((d) => d.docType === t && d.truckId === id)),
  );
  if (!truckDone)
    missing.push(
      truckIds.length === 0
        ? "Add a truck, then its OR/CR and LTFRB franchise"
        : `${DOC_TYPES.OR_CR.label} and ${DOC_TYPES.LTFRB_CPC.label} for one of your trucks`,
    );
  return missing;
}

export async function pendingSignupBonus(userId: string) {
  return db.creditTransaction.findFirst({ where: { userId, type: "SIGNUP_BONUS", status: "PENDING" } });
}

/**
 * Credits the reserved bonus if every required document is approved. Safe to call
 * repeatedly; the conditional update means it is credited at most once.
 */
export async function releaseSignupBonusIfEligible(userId: string): Promise<boolean> {
  const bonus = await pendingSignupBonus(userId);
  if (!bonus) return false;
  const [docs, trucks] = await Promise.all([
    db.verificationDocument.findMany({ where: { userId }, select: { docType: true, status: true, truckId: true } }),
    db.truck.findMany({ where: { ownerId: userId }, select: { id: true } }),
  ]);
  if (missingBonusDocs(docs, trucks.map((t) => t.id)).length > 0) return false;

  const released = await db.$transaction(async (tx) => {
    const r = await tx.creditTransaction.updateMany({
      where: { id: bonus.id, status: "PENDING" },
      data: { status: "APPROVED", reviewedAt: new Date() },
    });
    if (r.count === 0) return false;
    await tx.user.update({ where: { id: userId }, data: { creditBalance: { increment: bonus.amount }, verified: true } });
    return true;
  });
  if (released)
    await notify(userId, `Documents approved! Your ₱${bonus.amount.toLocaleString()} welcome bonus is now in your credits.`, "/credits");
  return released;
}
