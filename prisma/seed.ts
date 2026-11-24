// Demo data: run with `npm run db:seed` (or `npm run db:reset` to wipe first).
// All demo accounts use the password "demo1234".
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { roadKm } from "../src/lib/geo";
import { bookingFee } from "../src/lib/constants";

const db = new PrismaClient();

/** Midnight-ish Manila time, `n` days from today. */
function day(n: number, hour = 8) {
  const now = new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  manila.setDate(manila.getDate() + n);
  const y = manila.getFullYear();
  const m = String(manila.getMonth() + 1).padStart(2, "0");
  const d = String(manila.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${String(hour).padStart(2, "0")}:00:00+08:00`);
}

async function main() {
  // The seed wipes every table before loading demo data. Never let it touch a live database.
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|db)(:|\/)/.test(url);
  if (!local && process.env.ALLOW_DEMO_SEED !== "yes") {
    console.error("Refusing to seed: DATABASE_URL is not a local database. This would delete all live data.");
    console.error("Only for a throwaway database, set ALLOW_DEMO_SEED=yes.");
    process.exit(1);
  }

  await db.smsLog.deleteMany();
  await db.savedLane.deleteMany();
  await db.bookingPhoto.deleteMany();
  await db.verificationDocument.deleteMany();
  await db.creditTransaction.deleteMany();
  await db.storedFile.deleteMany();
  await db.notification.deleteMany();
  await db.booking.deleteMany();
  await db.load.deleteMany();
  await db.returnTrip.deleteMany();
  await db.truck.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = (data: { name: string; email: string; role: string; company?: string; phone: string; city: string; verified?: boolean }) =>
    db.user.create({ data: { ...data, passwordHash, verified: data.verified ?? true } });

  const admin = await user({ name: "Ops Admin", email: "admin@demo.ph", role: "ADMIN", phone: "09170000000", city: "Taguig" });
  const maria = await user({ name: "Maria Santos", email: "shipper@demo.ph", role: "SHIPPER", company: "Luzon Fresh Distribution", phone: "09171234567", city: "Valenzuela" });
  const cebuHw = await user({ name: "Joel Uy", email: "cebu.hardware@demo.ph", role: "SHIPPER", company: "Mandaue Home Depot Supply", phone: "09281112222", city: "Mandaue" });
  const coop = await user({ name: "Liza Bautista", email: "davao.coop@demo.ph", role: "SHIPPER", company: "Tagum Banana Growers Coop", phone: "09353334444", city: "Tagum" });
  const mill = await user({ name: "Ben Agustin", email: "ricemill@demo.ph", role: "SHIPPER", company: "Golden Grain Rice Mill", phone: "09475556666", city: "San Jose (Nueva Ecija)", verified: false });

  const ramon = await user({ name: "Ramon Dela Cruz", email: "trucker@demo.ph", role: "TRUCKER", company: "RDC Trucking Services", phone: "09181239876", city: "Valenzuela" });
  const bisaya = await user({ name: "Nonoy Abellana", email: "bisaya@demo.ph", role: "TRUCKER", company: "Bisaya Haulers", phone: "09223334455", city: "Mandaue" });
  const coldx = await user({ name: "Fatima Ampatuan", email: "coldx@demo.ph", role: "TRUCKER", company: "Mindanao Cold Express", phone: "09335556677", city: "Cagayan de Oro" });
  const ilocos = await user({ name: "Paolo Ramos", email: "ilocos@demo.ph", role: "TRUCKER", company: "Ilocos Freight Lines", phone: "09451231234", city: "Laoag", verified: false });

  const truck = (ownerId: string, plateNumber: string, truckType: string, capacityTons: number, homeCity: string, franchiseNo: string | null, franchiseVerified = true) =>
    db.truck.create({ data: { ownerId, plateNumber, truckType, capacityTons, homeCity, franchiseNo, franchiseVerified } });

  const rdcWing = await truck(ramon.id, "NBC 4821", "WING_VAN_10W", 15, "Valenzuela", "2023-NCR-04417");
  const rdc6w = await truck(ramon.id, "NDA 1290", "SIX_WHEELER", 6, "Valenzuela", "2023-NCR-04418");
  const bisFlat = await truck(bisaya.id, "GAB 7712", "FLATBED_10W", 15, "Mandaue", "2022-VII-00981");
  const coldReefer = await truck(coldx.id, "KAD 3345", "REEFER", 10, "Cagayan de Oro", "2024-X-00211");
  const ilTrailer = await truck(ilocos.id, "ABC 5521", "TRAILER", 30, "Laoag", "2021-I-00554", false);
  const ilWing = await truck(ilocos.id, "ABD 6630", "WING_VAN_10W", 14, "Laoag", null, false);

  const trip = (truckerId: string, truckId: string, originCity: string, destCity: string, from: number, to: number, maxDetourKm: number, extra: { askingRate?: number; notes?: string; status?: string } = {}) =>
    db.returnTrip.create({
      data: { truckerId, truckId, originCity, destCity, availableFrom: day(from, 0), availableTo: day(to, 23), maxDetourKm, ...extra },
    });

  const tBatangas = await trip(ramon.id, rdcWing.id, "Batangas City", "Valenzuela", 1, 2, 60, { notes: "Unloading at Batangas port, free from 10am. With 2 helpers." });
  const tBaguio = await trip(ramon.id, rdc6w.id, "Baguio", "Valenzuela", 2, 3, 40, { askingRate: 9000 });
  const tBohol = await trip(bisaya.id, bisFlat.id, "Tagbilaran", "Mandaue", 1, 4, 30, { notes: "Via Tagbilaran–Cebu RoRo." });
  const tDavao = await trip(coldx.id, coldReefer.id, "Davao City", "Cagayan de Oro", 0, 2, 120, { notes: "Reefer can hold 2–13°C." });
  const tManila = await trip(ilocos.id, ilTrailer.id, "Manila", "Laoag", 2, 5, 150);
  const tSubic = await trip(ilocos.id, ilWing.id, "Subic / Olongapo", "Laoag", 1, 3, 60);

  const load = (shipperId: string, d: { title: string; cargoType: string; weightTons: number; truckType?: string; pickupCity: string; dropCity: string; from: number; to: number; budget?: number; notes?: string; status?: string }) =>
    db.load.create({
      data: {
        shipperId,
        title: d.title,
        cargoType: d.cargoType,
        weightTons: d.weightTons,
        truckType: d.truckType ?? null,
        pickupCity: d.pickupCity,
        dropCity: d.dropCity,
        pickupDate: day(d.from, 0),
        deliverBy: day(d.to, 23),
        budget: d.budget ?? null,
        notes: d.notes ?? null,
        status: d.status ?? "OPEN",
      },
    });

  const lCanned = await load(maria.id, { title: "320 cartons of canned goods", cargoType: "FMCG", weightTons: 11, pickupCity: "Lipa", dropCity: "Quezon City", from: 1, to: 3, budget: 14000, notes: "Palletized. Warehouse open 7am–5pm." });
  const lVeg = await load(maria.id, { title: "Highland vegetables (cabbage, carrots)", cargoType: "AGRI", weightTons: 5, truckType: "SIX_WHEELER", pickupCity: "La Trinidad", dropCity: "Navotas", from: 2, to: 3, budget: 10000 });
  const lAppliance = await load(maria.id, { title: "Appliances for Ilocos branch restock", cargoType: "FURNITURE", weightTons: 8, pickupCity: "Valenzuela", dropCity: "Laoag", from: 2, to: 6, budget: 30000 });
  await load(maria.id, { title: "Office furniture (relocation)", cargoType: "FURNITURE", weightTons: 3, pickupCity: "Manila", dropCity: "Legazpi", from: 4, to: 8, budget: 20000 });
  const lBohol = await load(cebuHw.id, { title: "Bohol-made furniture order", cargoType: "FURNITURE", weightTons: 6, pickupCity: "Tagbilaran", dropCity: "Cebu City", from: 1, to: 4, budget: 18000 });
  await load(coop.id, { title: "Chilled Cavendish bananas", cargoType: "COLD_CHAIN", weightTons: 8, truckType: "REEFER", pickupCity: "Tagum", dropCity: "Cagayan de Oro", from: 0, to: 2, budget: 28000, notes: "Keep at 13°C." });
  await load(mill.id, { title: "Milled rice, 400 sacks x 50 kg", cargoType: "RICE_GRAINS", weightTons: 20, pickupCity: "San Jose (Nueva Ecija)", dropCity: "Vigan", from: 2, to: 5, budget: 40000 });
  await load(cebuHw.id, { title: "GI sheets and steel bars", cargoType: "CONSTRUCTION", weightTons: 12, truckType: "FLATBED_10W", pickupCity: "Toledo", dropCity: "Mandaue", from: 1, to: 3 });

  // --- Live bookings --------------------------------------------------------
  const pendingReq = await db.booking.create({
    data: { loadId: lVeg.id, tripId: tBaguio.id, shipperId: maria.id, truckerId: ramon.id, initiatedBy: "SHIPPER", agreedRate: 9000, message: "Pickup at La Trinidad trading post, 5am.", loadedKm: roadKm("La Trinidad", "Navotas") },
  });
  const pendingOffer = await db.booking.create({
    data: { loadId: lAppliance.id, tripId: tManila.id, shipperId: maria.id, truckerId: ilocos.id, initiatedBy: "TRUCKER", agreedRate: 26000, message: "Trailer can take all 8 t in one trip.", loadedKm: roadKm("Valenzuela", "Laoag") },
  });
  const accepted = await db.booking.create({
    data: { loadId: lBohol.id, tripId: tBohol.id, shipperId: cebuHw.id, truckerId: bisaya.id, initiatedBy: "SHIPPER", agreedRate: 16000, status: "ACCEPTED", feeCharged: bookingFee(16000), loadedKm: roadKm("Tagbilaran", "Cebu City") },
  });
  await db.load.update({ where: { id: lBohol.id }, data: { status: "MATCHED" } });
  await db.returnTrip.update({ where: { id: tBohol.id }, data: { status: "BOOKED" } });

  // --- Delivered history (for stats & ratings) ------------------------------
  const history: [string, string, string, string, string, number, number, number][] = [
    // shipper, trucker, truckId, pickup, drop, tons, rate, rating
    [maria.id, ramon.id, rdcWing.id, "Calamba", "Valenzuela", 12, 9500, 5],
    [maria.id, ramon.id, rdc6w.id, "Urdaneta", "Quezon City", 5, 8500, 4],
    [cebuHw.id, bisaya.id, bisFlat.id, "Toledo", "Mandaue", 10, 7000, 5],
    [coop.id, coldx.id, coldReefer.id, "Davao City", "Malaybalay", 7, 21000, 5],
  ];
  for (const [i, [shipperId, truckerId, truckId, pickup, drop, tons, rate, rating]] of history.entries()) {
    const t = await db.returnTrip.create({
      data: { truckerId, truckId, originCity: pickup, destCity: drop, availableFrom: day(-20 + i * 4, 0), availableTo: day(-19 + i * 4, 23), maxDetourKm: 30, status: "COMPLETED" },
    });
    const l = await db.load.create({
      data: { shipperId, title: ["Bottled water pallets", "Pangasinan mangoes", "Hollow blocks", "Frozen chicken"][i], cargoType: ["FMCG", "AGRI", "CONSTRUCTION", "COLD_CHAIN"][i], weightTons: tons, pickupCity: pickup, dropCity: drop, pickupDate: day(-20 + i * 4, 0), deliverBy: day(-19 + i * 4, 23), status: "DELIVERED" },
    });
    const hb = await db.booking.create({
      data: { loadId: l.id, tripId: t.id, shipperId, truckerId, initiatedBy: "SHIPPER", agreedRate: rate, status: "DELIVERED", feeCharged: bookingFee(rate), rating, loadedKm: roadKm(pickup, drop), pickedUpAt: day(-20 + i * 4, 9), deliveredAt: day(-20 + i * 4, 17), podNote: "Received complete, DR #" + (1040 + i), createdAt: day(-21 + i * 4) },
    });
    await db.creditTransaction.create({
      data: { userId: truckerId, type: "BOOKING_FEE", amount: -bookingFee(rate), bookingId: hb.id, note: "Booking fee", createdAt: day(-21 + i * 4) },
    });
  }

  // --- Credits ----------------------------------------------------------------
  // Approved top-ups, then balance = top-ups minus fees already recorded above.
  const topups: [string, number, string, string][] = [
    [ramon.id, 2500, "GCASH", "1009 882 31457"],
    [bisaya.id, 1500, "MAYA", "MY-55120934"],
    [coldx.id, 2000, "BANK", "BDO-77812"],
  ];
  for (const [userId, amount, method, reference] of topups)
    await db.creditTransaction.create({ data: { userId, type: "TOPUP", amount, method, reference, status: "APPROVED", reviewedAt: day(-25), createdAt: day(-25) } });
  await db.creditTransaction.create({
    data: { userId: bisaya.id, type: "BOOKING_FEE", amount: -bookingFee(16000), bookingId: accepted.id, note: "Booking fee: Bohol-made furniture order" },
  });
  // Ilocos Freight signed up recently: welcome bonus held until their documents are approved.
  await db.creditTransaction.create({
    data: { userId: ilocos.id, type: "SIGNUP_BONUS", amount: 300, status: "PENDING", reference: ilocos.phone, note: "Welcome bonus, credited once your documents are approved" },
  });
  // Ilocos Freight has no credits yet but has a top-up waiting for admin review.
  await db.creditTransaction.create({ data: { userId: ilocos.id, type: "TOPUP", amount: 1000, method: "GCASH", reference: "1012 554 90021", status: "PENDING" } });
  for (const u of [ramon, bisaya, coldx, ilocos]) {
    const sum = await db.creditTransaction.aggregate({ where: { userId: u.id, status: "APPROVED" }, _sum: { amount: true } });
    await db.user.update({ where: { id: u.id }, data: { creditBalance: sum._sum.amount ?? 0 } });
  }

  // --- Saved lanes --------------------------------------------------------------
  await db.savedLane.createMany({
    data: [
      { userId: ramon.id, truckId: rdcWing.id, originCity: "Batangas City", destCity: "Valenzuela", maxDetourKm: 60 },
      { userId: ramon.id, truckId: rdc6w.id, originCity: "Baguio", destCity: "Valenzuela", maxDetourKm: 40 },
      { userId: bisaya.id, truckId: bisFlat.id, originCity: "Toledo", destCity: "Mandaue", maxDetourKm: 30 },
      { userId: maria.id, originCity: "Tarlac City", destCity: "Laoag", weightTons: 10 },
      { userId: coop.id, originCity: "Tagum", destCity: "Cagayan de Oro", weightTons: 8 },
    ],
  });

  // --- Notifications --------------------------------------------------------
  await db.notification.createMany({
    data: [
      { userId: ramon.id, message: `Maria Santos wants your Baguio → Valenzuela return trip for "Highland vegetables" at ₱9,000`, href: `/bookings/${pendingReq.id}` },
      { userId: maria.id, message: `Paolo Ramos offered to carry "Appliances for Ilocos branch restock" for ₱26,000`, href: `/bookings/${pendingOffer.id}` },
      { userId: bisaya.id, message: `Booking confirmed for "Bohol-made furniture order". Coordinate pickup details.`, href: `/bookings/${accepted.id}` },
      { userId: admin.id, message: "New trucker sign-up: Paolo Ramos — verify their documents", href: "/admin" },
      { userId: admin.id, message: "New shipper sign-up: Ben Agustin — verify their documents", href: "/admin" },
    ],
  });

  console.log("Seeded. Log in as shipper@demo.ph / trucker@demo.ph / admin@demo.ph with password demo1234");
  void tDavao;
  void tSubic;
  void tBatangas;
  void lCanned;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
