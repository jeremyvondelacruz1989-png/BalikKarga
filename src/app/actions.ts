"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import {
  bookingFee,
  CARGO_TYPE_KEYS,
  DOC_TYPES,
  PAYMENT_METHODS,
  SIGNUP_BONUS,
  TOPUP_MIN,
  TRUCK_TYPE_KEYS,
  TRUCK_TYPES,
} from "@/lib/constants";
import { filesFrom, saveUpload, UploadError } from "@/lib/storage";
import { alertLanesForLoad, alertLanesForTrip } from "@/lib/lanes";
import { isKnownCity } from "@/lib/geo";
import { parseManilaDate } from "@/lib/format";
import { checkTransition, nextStatus, type BookingAction } from "@/lib/booking-rules";
import { scoreMatch } from "@/lib/matching";
import { notify } from "@/lib/notify";
import { normalizePhone } from "@/lib/sms";

export type FormState = { error?: string; ok?: string } | undefined;

const city = z.string().refine(isKnownCity, "Pick a city from the list");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date");
const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter a valid amount");

function firstError(err: z.ZodError) {
  const issue = err.issues[0];
  return issue ? `${issue.path.join(".") || "Form"}: ${issue.message}` : "Invalid input";
}

// ---------------------------------------------------------------- Auth

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  role: z.enum(["SHIPPER", "TRUCKER"]),
  company: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+63|0)9\d{9}$/, "Use a PH mobile number like 09171234567"),
  city: city,
});

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { password, ...rest } = parsed.data;
  const data = { ...rest, phone: normalizePhone(rest.phone) ?? rest.phone };
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "That email is already registered" };
  const passwordHash = await hashPassword(password);

  // Welcome bonus for truckers: once per mobile number, recorded in the credit ledger.
  const bonusTaken =
    data.role !== "TRUCKER" || SIGNUP_BONUS <= 0
      ? true
      : !!(await db.creditTransaction.findFirst({ where: { type: "SIGNUP_BONUS", reference: data.phone } }));
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { ...data, passwordHash, creditBalance: bonusTaken ? 0 : SIGNUP_BONUS },
    });
    if (!bonusTaken)
      await tx.creditTransaction.create({
        data: { userId: u.id, type: "SIGNUP_BONUS", amount: SIGNUP_BONUS, reference: data.phone, note: "Welcome bonus" },
      });
    return u;
  });
  await createSession(user.id);
  if (data.role === "TRUCKER")
    await notify(
      user.id,
      bonusTaken
        ? "Welcome to BalikKarga! Add your truck and post your first return trip."
        : `Welcome to BalikKarga! ₱${SIGNUP_BONUS} free credits are in your account. Add your truck and post your first return trip.`,
      "/trucks",
    );
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) => notify(a.id, `New ${data.role.toLowerCase()} sign-up: ${data.name} — verify their documents`, "/admin", { sms: false })),
  );
  redirect(data.role === "TRUCKER" ? "/trucks" : "/dashboard");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password" };
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------------- Trucks

const truckSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}\s?\d{3,4}$/, "Use a plate like NBC 1234"),
  truckType: z.enum(TRUCK_TYPE_KEYS as [string, ...string[]]),
  capacityTons: z.coerce.number().positive("Enter capacity in tons"),
  homeCity: city,
  franchiseNo: z.string().trim().optional(),
});

export async function addTruck(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TRUCKER");
  const parsed = truckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  const max = TRUCK_TYPES[data.truckType as keyof typeof TRUCK_TYPES].maxTons;
  if (data.capacityTons > max * 1.5) return { error: `That's unusually high for this truck type (typical max ${max} t)` };
  const plateNumber = data.plateNumber.replace(/^([A-Z]{3})\s?/, "$1 ");
  if (await db.truck.findUnique({ where: { plateNumber } })) return { error: "That plate number is already registered" };
  await db.truck.create({ data: { ...data, plateNumber, franchiseNo: data.franchiseNo || null, ownerId: user.id } });
  revalidatePath("/trucks");
  return { ok: "Truck added. An admin will verify the LTFRB franchise." };
}

export async function toggleTruck(formData: FormData) {
  const user = await requireUser("TRUCKER");
  const id = String(formData.get("id"));
  const truck = await db.truck.findFirst({ where: { id, ownerId: user.id } });
  if (!truck) return;
  await db.truck.update({ where: { id }, data: { active: !truck.active } });
  revalidatePath("/trucks");
}

// ---------------------------------------------------------------- Return trips

const tripSchema = z
  .object({
    truckId: z.string().min(1, "Pick a truck"),
    originCity: city,
    destCity: city,
    availableFrom: dateStr,
    availableTo: dateStr,
    maxDetourKm: z.coerce.number().int().min(0).max(500),
    askingRate: optionalNumber,
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.availableTo >= v.availableFrom, { message: "End date is before start date", path: ["availableTo"] })
  .refine((v) => v.originCity !== v.destCity, { message: "Origin and home base are the same", path: ["destCity"] });

export async function createTrip(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TRUCKER");
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const truck = await db.truck.findFirst({ where: { id: d.truckId, ownerId: user.id, active: true } });
  if (!truck) return { error: "Pick one of your active trucks" };
  const trip = await db.returnTrip.create({
    data: {
      truckerId: user.id,
      truckId: truck.id,
      originCity: d.originCity,
      destCity: d.destCity,
      availableFrom: parseManilaDate(d.availableFrom),
      availableTo: parseManilaDate(d.availableTo, true),
      maxDetourKm: d.maxDetourKm,
      askingRate: d.askingRate,
      notes: d.notes || null,
    },
  });
  await alertLanesForTrip({ ...trip, truck });
  redirect(`/trips/${trip.id}`);
}

// ---------------------------------------------------------------- Loads

const loadSchema = z
  .object({
    title: z.string().trim().min(3, "Describe the cargo").max(120),
    cargoType: z.enum(CARGO_TYPE_KEYS as [string, ...string[]]),
    weightTons: z.coerce.number().positive("Enter weight in tons").max(40),
    truckType: z.string().optional(),
    pickupCity: city,
    dropCity: city,
    pickupDate: dateStr,
    deliverBy: dateStr,
    budget: optionalNumber,
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.deliverBy >= v.pickupDate, { message: "Delivery date is before pickup", path: ["deliverBy"] })
  .refine((v) => v.pickupCity !== v.dropCity, { message: "Pickup and drop-off are the same", path: ["dropCity"] })
  .refine((v) => !v.truckType || (TRUCK_TYPE_KEYS as string[]).includes(v.truckType), {
    message: "Unknown truck type",
    path: ["truckType"],
  });

export async function createLoad(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER");
  const parsed = loadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const load = await db.load.create({
    data: {
      shipperId: user.id,
      title: d.title,
      cargoType: d.cargoType,
      weightTons: d.weightTons,
      truckType: d.truckType || null,
      pickupCity: d.pickupCity,
      dropCity: d.dropCity,
      pickupDate: parseManilaDate(d.pickupDate),
      deliverBy: parseManilaDate(d.deliverBy, true),
      budget: d.budget,
      notes: d.notes || null,
    },
  });
  await alertLanesForLoad(load);
  redirect(`/loads/${load.id}`);
}

export async function cancelListing(formData: FormData) {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const id = String(formData.get("id"));
  const kind = String(formData.get("kind"));
  if (kind === "load") {
    await db.load.updateMany({ where: { id, shipperId: user.id, status: "OPEN" }, data: { status: "CANCELLED" } });
    await db.booking.updateMany({ where: { loadId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
    revalidatePath(`/loads/${id}`);
  } else {
    await db.returnTrip.updateMany({ where: { id, truckerId: user.id, status: "OPEN" }, data: { status: "CANCELLED" } });
    await db.booking.updateMany({ where: { tripId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
    revalidatePath(`/trips/${id}`);
  }
}

// ---------------------------------------------------------------- Bookings

/**
 * Shipper requests a trucker's return trip for one of their loads, or a trucker
 * offers one of their return trips on a shipper's load.
 */
export async function proposeBooking(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const loadId = String(formData.get("loadId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const rate = Number(formData.get("agreedRate"));
  const message = String(formData.get("message") ?? "").trim().slice(0, 500) || null;
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Enter a rate" };

  const [load, trip] = await Promise.all([
    db.load.findUnique({ where: { id: loadId } }),
    db.returnTrip.findUnique({ where: { id: tripId }, include: { truck: true } }),
  ]);
  if (!load || !trip) return { error: "Load or trip not found" };
  if (load.status !== "OPEN" || trip.status !== "OPEN") return { error: "This load or trip is no longer open" };

  const initiatedBy = user.role as "SHIPPER" | "TRUCKER";
  if (initiatedBy === "SHIPPER" && load.shipperId !== user.id) return { error: "Pick one of your own loads" };
  if (initiatedBy === "TRUCKER" && trip.truckerId !== user.id) return { error: "Pick one of your own return trips" };

  const match = scoreMatch(trip, load);
  if (!match.eligible) return { error: `Not a fit: ${match.reasons.filter(Boolean)[0]}` };

  if (initiatedBy === "TRUCKER") {
    const fee = bookingFee(rate);
    if (user.creditBalance < fee)
      return { error: `You need ₱${fee.toLocaleString()} in credits to make this offer (you have ₱${user.creditBalance.toLocaleString()}). Top up on the Credits page.` };
  }

  const existing = await db.booking.findFirst({ where: { loadId, tripId, status: { in: ["PENDING", "ACCEPTED"] } } });
  if (existing) return { error: "There is already an active booking for this pair" };

  const booking = await db.booking.create({
    data: {
      loadId,
      tripId,
      shipperId: load.shipperId,
      truckerId: trip.truckerId,
      initiatedBy,
      agreedRate: rate,
      message,
      loadedKm: match.loadedKm,
    },
  });
  const other = initiatedBy === "SHIPPER" ? trip.truckerId : load.shipperId;
  await notify(
    other,
    initiatedBy === "SHIPPER"
      ? `${user.name} wants your ${trip.originCity} → ${trip.destCity} return trip for "${load.title}" at ₱${rate.toLocaleString()}`
      : `${user.name} offered to carry "${load.title}" for ₱${rate.toLocaleString()}`,
    `/bookings/${booking.id}`,
  );
  redirect(`/bookings/${booking.id}`);
}

export async function updateBooking(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const id = String(formData.get("id"));
  const action = String(formData.get("action")) as BookingAction;
  if (!["accept", "decline", "cancel", "start", "deliver"].includes(action)) return { error: "Unknown action" };
  const booking = await db.booking.findUnique({ where: { id }, include: { load: true, trip: true } });
  if (!booking) return { error: "Booking not found" };

  const reason = checkTransition(booking, action, { userId: user.id, role: user.role });
  if (reason) return { error: reason };

  const status = nextStatus(action);
  const otherId = user.id === booking.shipperId ? booking.truckerId : booking.shipperId;
  const href = `/bookings/${id}`;

  if (action === "accept") {
    const fee = bookingFee(booking.agreedRate);
    let failure: "credits" | "taken" | null = null;
    const losers = await db.booking.findMany({
      where: { id: { not: id }, status: "PENDING", OR: [{ loadId: booking.loadId }, { tripId: booking.tripId }] },
    });
    try {
      await db.$transaction(async (tx) => {
        // Conditional updates make this safe against double-accepts and races.
        const charged = await tx.user.updateMany({
          where: { id: booking.truckerId, creditBalance: { gte: fee } },
          data: { creditBalance: { decrement: fee } },
        });
        if (charged.count === 0) throw (failure = "credits");
        const l = await tx.load.updateMany({ where: { id: booking.loadId, status: "OPEN" }, data: { status: "MATCHED" } });
        const t = await tx.returnTrip.updateMany({ where: { id: booking.tripId, status: "OPEN" }, data: { status: "BOOKED" } });
        const b = await tx.booking.updateMany({ where: { id, status: "PENDING" }, data: { status, feeCharged: fee } });
        if (l.count === 0 || t.count === 0 || b.count === 0) throw (failure = "taken");
        await tx.creditTransaction.create({
          data: { userId: booking.truckerId, type: "BOOKING_FEE", amount: -fee, bookingId: id, note: `Booking fee: ${booking.load.title}` },
        });
        await tx.booking.updateMany({ where: { id: { in: losers.map((x) => x.id) } }, data: { status: "DECLINED" } });
      });
    } catch (e) {
      if (failure === "taken") return { error: "The load or trip was already booked by someone else" };
      if (failure === "credits") {
        if (user.id === booking.truckerId)
          return { error: `You need ₱${fee.toLocaleString()} in credits to accept (booking fee). Top up on the Credits page.` };
        await notify(
          booking.truckerId,
          `${user.name} wants to accept your offer for "${booking.load.title}" but you need ₱${fee.toLocaleString()} in credits. Top up now.`,
          "/credits",
        );
        return { error: "The trucker doesn't have enough credits for the booking fee yet. We've asked them to top up; try again later." };
      }
      throw e;
    }
    for (const l of losers) {
      const who = l.initiatedBy === "SHIPPER" ? l.shipperId : l.truckerId;
      await notify(who, "A booking you requested is no longer available — the load or truck was booked.", `/bookings/${l.id}`, { sms: false });
    }
    await notify(otherId, `Booking confirmed for "${booking.load.title}". Contact details are now visible.`, href);
    if (user.id !== booking.truckerId)
      await notify(booking.truckerId, `₱${fee.toLocaleString()} booking fee deducted from your credits.`, "/credits", { sms: false });
  } else if (action === "decline") {
    await db.booking.update({ where: { id }, data: { status } });
    await notify(otherId, `Your booking request for "${booking.load.title}" was declined.`, href);
  } else if (action === "cancel") {
    const wasAccepted = booking.status === "ACCEPTED";
    // Fee policy: refunded when the shipper cancels; kept when the trucker cancels.
    const refund = wasAccepted && booking.feeCharged && user.id === booking.shipperId ? booking.feeCharged : 0;
    await db.$transaction([
      db.booking.update({ where: { id }, data: { status } }),
      ...(wasAccepted
        ? [
            db.load.update({ where: { id: booking.loadId }, data: { status: "OPEN" } }),
            db.returnTrip.update({ where: { id: booking.tripId }, data: { status: "OPEN" } }),
          ]
        : []),
      ...(refund
        ? [
            db.user.update({ where: { id: booking.truckerId }, data: { creditBalance: { increment: refund } } }),
            db.creditTransaction.create({
              data: { userId: booking.truckerId, type: "REFUND", amount: refund, bookingId: id, note: "Shipper cancelled booking" },
            }),
          ]
        : []),
    ]);
    await notify(
      otherId,
      `Booking for "${booking.load.title}" was cancelled by ${user.name}.${refund ? ` Your ₱${refund.toLocaleString()} fee was refunded.` : ""}`,
      href,
    );
  } else if (action === "start" || action === "deliver") {
    const podNote = String(formData.get("podNote") ?? "").trim();
    const photos = filesFrom(formData, "photos");
    if (action === "deliver") {
      if (photos.length === 0) return { error: "Add at least one photo of the signed DR/waybill or the delivered cargo" };
      if (podNote.length < 3) return { error: "Add proof of delivery: receiver name and DR/waybill number" };
    }
    if (photos.length > 6) return { error: "Upload at most 6 photos" };
    const stage = action === "start" ? "PICKUP" : "DELIVERY";
    try {
      for (const f of photos) {
        const stored = await saveUpload(f, user.id, { bookingId: id, imagesOnly: true });
        await db.bookingPhoto.create({ data: { bookingId: id, stage, fileId: stored.id, uploadedById: user.id } });
      }
    } catch (e) {
      if (e instanceof UploadError) return { error: e.message };
      throw e;
    }
    if (action === "start") {
      await db.$transaction([
        db.booking.update({ where: { id }, data: { status, pickedUpAt: new Date() } }),
        db.load.update({ where: { id: booking.loadId }, data: { status: "IN_TRANSIT" } }),
      ]);
      await notify(otherId, `"${booking.load.title}" has been picked up and is on the way.`, href);
    } else {
      await db.$transaction([
        db.booking.update({ where: { id }, data: { status, deliveredAt: new Date(), podNote } }),
        db.load.update({ where: { id: booking.loadId }, data: { status: "DELIVERED" } }),
        db.returnTrip.update({ where: { id: booking.tripId }, data: { status: "COMPLETED" } }),
      ]);
      await notify(otherId, `"${booking.load.title}" was delivered. See the delivery photos and rate your trucker.`, href);
    }
  }

  revalidatePath(href);
  return { ok: "Updated" };
}

export async function rateBooking(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER");
  const id = String(formData.get("id"));
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Pick 1 to 5 stars" };
  const res = await db.booking.updateMany({
    where: { id, shipperId: user.id, status: "DELIVERED", rating: null },
    data: { rating },
  });
  if (res.count === 0) return { error: "This booking can't be rated" };
  const b = await db.booking.findUnique({ where: { id } });
  if (b) await notify(b.truckerId, `You received a ${rating}★ rating.`, `/bookings/${id}`, { sms: false });
  revalidatePath(`/bookings/${id}`);
  return { ok: "Thanks for rating!" };
}

// ---------------------------------------------------------------- Notifications & admin

export async function markNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/dashboard");
}

export async function adminVerify(formData: FormData) {
  await requireUser("ADMIN");
  const kind = String(formData.get("kind"));
  const id = String(formData.get("id"));
  if (kind === "user") {
    const u = await db.user.update({ where: { id }, data: { verified: true } });
    await notify(u.id, "Your account has been verified. You now show a Verified badge.");
  } else if (kind === "truck") {
    const t = await db.truck.update({ where: { id }, data: { franchiseVerified: true } });
    await notify(t.ownerId, `LTFRB franchise for ${t.plateNumber} verified.`, "/trucks");
  }
  revalidatePath("/admin");
}

// ---------------------------------------------------------------- Credits

const topupSchema = z.object({
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
  amount: z.coerce.number().int("Whole pesos only").min(TOPUP_MIN, `Minimum top-up is ₱${TOPUP_MIN}`).max(100000),
  reference: z.string().trim().min(4, "Enter the payment reference number").max(60),
});

export async function requestTopup(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TRUCKER");
  const parsed = topupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const dup = await db.creditTransaction.findFirst({ where: { type: "TOPUP", reference: d.reference, status: { not: "REJECTED" } } });
  if (dup) return { error: "That reference number was already submitted" };
  let receiptId: string | null = null;
  const receipt = filesFrom(formData, "receipt")[0];
  if (receipt) {
    try {
      receiptId = (await saveUpload(receipt, user.id)).id;
    } catch (e) {
      if (e instanceof UploadError) return { error: e.message };
      throw e;
    }
  }
  await db.creditTransaction.create({
    data: { userId: user.id, type: "TOPUP", amount: d.amount, status: "PENDING", method: d.method, reference: d.reference, receiptId },
  });
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins)
    await notify(a.id, `Top-up to confirm: ${user.name} sent ₱${d.amount.toLocaleString()} via ${PAYMENT_METHODS[d.method as keyof typeof PAYMENT_METHODS]} (ref ${d.reference})`, "/admin#topups", { sms: false });
  revalidatePath("/credits");
  return { ok: "Top-up submitted. Credits are added once we confirm your payment (usually within the hour)." };
}

export async function adminReviewTopup(decision: "approve" | "reject", formData: FormData) {
  await requireUser("ADMIN");
  const id = String(formData.get("id"));
  const approve = decision === "approve";
  const note = String(formData.get("note") ?? "").trim() || null;
  const txn = await db.creditTransaction.findUnique({ where: { id } });
  if (!txn || txn.type !== "TOPUP" || txn.status !== "PENDING") return;
  if (approve) {
    await db.$transaction(async (tx) => {
      const r = await tx.creditTransaction.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPROVED", reviewedAt: new Date(), note } });
      if (r.count === 1) await tx.user.update({ where: { id: txn.userId }, data: { creditBalance: { increment: txn.amount } } });
    });
    await notify(txn.userId, `₱${txn.amount.toLocaleString()} credits added to your account. Salamat!`, "/credits");
  } else {
    await db.creditTransaction.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), note } });
    await notify(txn.userId, `Your ₱${txn.amount.toLocaleString()} top-up (ref ${txn.reference}) could not be confirmed.${note ? " " + note : ""}`, "/credits");
  }
  revalidatePath("/admin");
}

// ---------------------------------------------------------------- Verification documents

export async function uploadDocument(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const docType = String(formData.get("docType") ?? "");
  const truckId = String(formData.get("truckId") ?? "") || null;
  const meta = (DOC_TYPES as Record<string, { label: string; for: string }>)[docType];
  if (!meta) return { error: "Choose a document type" };
  if (meta.for === "TRUCKER" && user.role !== "TRUCKER") return { error: "Not needed for shippers" };
  if (meta.for === "TRUCK") {
    if (user.role !== "TRUCKER") return { error: "Only truckers upload truck documents" };
    if (!truckId || !(await db.truck.findFirst({ where: { id: truckId, ownerId: user.id } }))) return { error: "Choose which truck" };
  }
  const file = filesFrom(formData, "file")[0];
  try {
    const stored = await saveUpload(file, user.id);
    await db.verificationDocument.create({
      data: { userId: user.id, truckId: meta.for === "TRUCK" ? truckId : null, docType, fileId: stored.id },
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) await notify(a.id, `${user.name} uploaded ${meta.label} for review`, "/admin#documents", { sms: false });
  revalidatePath("/verification");
  return { ok: `${meta.label} uploaded. We'll review it shortly.` };
}

export async function adminReviewDocument(decision: "approve" | "reject", formData: FormData) {
  await requireUser("ADMIN");
  const id = String(formData.get("id"));
  const approve = decision === "approve";
  const note = String(formData.get("note") ?? "").trim() || null;
  const doc = await db.verificationDocument.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewNote: note, reviewedAt: new Date() },
    include: { truck: true },
  });
  const label = (DOC_TYPES as Record<string, { label: string }>)[doc.docType]?.label ?? doc.docType;
  if (approve && doc.docType === "LTFRB_CPC" && doc.truckId)
    await db.truck.update({ where: { id: doc.truckId }, data: { franchiseVerified: true } });
  await notify(
    doc.userId,
    approve ? `${label}${doc.truck ? ` for ${doc.truck.plateNumber}` : ""} approved.` : `${label} was not accepted${note ? `: ${note}` : ""}. Please upload a clearer copy.`,
    "/verification",
  );
  revalidatePath("/admin");
}

// ---------------------------------------------------------------- Saved lanes & settings

const laneSchema = z
  .object({
    originCity: city,
    destCity: city,
    truckId: z.string().optional(),
    weightTons: optionalNumber,
    maxDetourKm: z.coerce.number().int().min(0).max(500).default(50),
  })
  .refine((v) => v.originCity !== v.destCity, { message: "Origin and destination are the same", path: ["destCity"] });

export async function createLane(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const parsed = laneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (user.role === "TRUCKER" && !(d.truckId && (await db.truck.findFirst({ where: { id: d.truckId, ownerId: user.id } }))))
    return { error: "Choose which truck runs this lane" };
  if ((await db.savedLane.count({ where: { userId: user.id } })) >= 20) return { error: "You can save up to 20 lanes" };
  await db.savedLane.create({
    data: {
      userId: user.id,
      originCity: d.originCity,
      destCity: d.destCity,
      truckId: user.role === "TRUCKER" ? d.truckId : null,
      weightTons: user.role === "SHIPPER" ? d.weightTons : null,
      maxDetourKm: d.maxDetourKm,
    },
  });
  revalidatePath("/lanes");
  return { ok: "Lane saved. We'll text you when something matches." };
}

export async function updateLane(formData: FormData) {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const id = String(formData.get("id"));
  const op = String(formData.get("op"));
  const lane = await db.savedLane.findFirst({ where: { id, userId: user.id } });
  if (!lane) return;
  if (op === "delete") await db.savedLane.delete({ where: { id } });
  else await db.savedLane.update({ where: { id }, data: { active: !lane.active } });
  revalidatePath("/lanes");
}

export async function toggleSms() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { smsEnabled: !user.smsEnabled } });
  revalidatePath("/dashboard");
}
