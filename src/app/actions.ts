"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { CARGO_TYPE_KEYS, TRUCK_TYPE_KEYS, TRUCK_TYPES } from "@/lib/constants";
import { isKnownCity } from "@/lib/geo";
import { parseManilaDate } from "@/lib/format";
import { checkTransition, nextStatus, type BookingAction } from "@/lib/booking-rules";
import { scoreMatch } from "@/lib/matching";
import { notify } from "@/lib/notify";

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
  const { password, ...data } = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "That email is already registered" };
  const user = await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) => notify(a.id, `New ${data.role.toLowerCase()} sign-up: ${data.name} — verify their documents`, "/admin")),
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
    if (booking.load.status !== "OPEN" || booking.trip.status !== "OPEN")
      return { error: "The load or trip was already booked by someone else" };
    const losers = await db.booking.findMany({
      where: { id: { not: id }, status: "PENDING", OR: [{ loadId: booking.loadId }, { tripId: booking.tripId }] },
    });
    await db.$transaction([
      db.booking.update({ where: { id }, data: { status } }),
      db.load.update({ where: { id: booking.loadId }, data: { status: "MATCHED" } }),
      db.returnTrip.update({ where: { id: booking.tripId }, data: { status: "BOOKED" } }),
      db.booking.updateMany({ where: { id: { in: losers.map((l) => l.id) } }, data: { status: "DECLINED" } }),
    ]);
    for (const l of losers) {
      const who = l.initiatedBy === "SHIPPER" ? l.shipperId : l.truckerId;
      await notify(who, "A booking you requested is no longer available — the load or truck was booked.", `/bookings/${l.id}`);
    }
    await notify(otherId, `Booking confirmed for "${booking.load.title}". Coordinate pickup details.`, href);
  } else if (action === "decline") {
    await db.booking.update({ where: { id }, data: { status } });
    await notify(otherId, `Your booking request for "${booking.load.title}" was declined.`, href);
  } else if (action === "cancel") {
    const wasAccepted = booking.status === "ACCEPTED";
    await db.$transaction([
      db.booking.update({ where: { id }, data: { status } }),
      ...(wasAccepted
        ? [
            db.load.update({ where: { id: booking.loadId }, data: { status: "OPEN" } }),
            db.returnTrip.update({ where: { id: booking.tripId }, data: { status: "OPEN" } }),
          ]
        : []),
    ]);
    await notify(otherId, `Booking for "${booking.load.title}" was cancelled by ${user.name}.`, href);
  } else if (action === "start") {
    await db.$transaction([
      db.booking.update({ where: { id }, data: { status, pickedUpAt: new Date() } }),
      db.load.update({ where: { id: booking.loadId }, data: { status: "IN_TRANSIT" } }),
    ]);
    await notify(otherId, `"${booking.load.title}" has been picked up and is on the way.`, href);
  } else if (action === "deliver") {
    const podNote = String(formData.get("podNote") ?? "").trim();
    if (podNote.length < 3) return { error: "Add proof of delivery: receiver name and DR/waybill number" };
    await db.$transaction([
      db.booking.update({ where: { id }, data: { status, deliveredAt: new Date(), podNote } }),
      db.load.update({ where: { id: booking.loadId }, data: { status: "DELIVERED" } }),
      db.returnTrip.update({ where: { id: booking.tripId }, data: { status: "COMPLETED" } }),
    ]);
    await notify(otherId, `"${booking.load.title}" was delivered. Please rate your trucker.`, href);
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
  if (b) await notify(b.truckerId, `You received a ${rating}★ rating.`, `/bookings/${id}`);
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
