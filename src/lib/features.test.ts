import { describe, expect, it } from "vitest";
import { bookingFee } from "./constants";
import { normalizePhone, smsText } from "./sms";
import { laneAsLoad, laneAsTrip } from "./lanes";
import { scoreMatch } from "./matching";

describe("booking fee", () => {
  it("is 5% with a ₱150 minimum", () => {
    expect(bookingFee(1000)).toBe(150);
    expect(bookingFee(16000)).toBe(800);
    expect(bookingFee(9500)).toBe(475);
  });
});

describe("sms", () => {
  it("normalizes PH mobile numbers", () => {
    expect(normalizePhone("+63 917 123 4567")).toBe("09171234567");
    expect(normalizePhone("0917-123-4567")).toBe("09171234567");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("fits one 160-character SMS", () => {
    const t = smsText("x".repeat(300), "/bookings/abc");
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t.startsWith("BalikKarga: ")).toBe(true);
  });
});

describe("saved lanes", () => {
  const truck = { truckType: "WING_VAN_10W", capacityTons: 15 } as never;
  const lane = { originCity: "Batangas City", destCity: "Valenzuela", maxDetourKm: 60, weightTons: 10 } as never;
  const load = {
    cargoType: "FMCG",
    weightTons: 11,
    truckType: null,
    pickupCity: "Lipa",
    dropCity: "Quezon City",
    pickupDate: new Date("2026-12-01"),
    deliverBy: new Date("2026-12-03"),
    budget: null,
  };

  it("matches a load along a trucker's lane", () => {
    const trip = laneAsTrip({ ...(lane as object), truck } as never, load);
    expect(scoreMatch(trip, load).eligible).toBe(true);
    expect(scoreMatch(trip, { ...load, pickupCity: "Naga", dropCity: "Legazpi" }).eligible).toBe(false);
  });

  it("matches a trip that can carry a shipper's lane", () => {
    const trip = {
      originCity: "Batangas City",
      destCity: "Valenzuela",
      availableFrom: new Date("2026-12-01"),
      availableTo: new Date("2026-12-02"),
      maxDetourKm: 60,
      askingRate: null,
      truck: { truckType: "WING_VAN_10W", capacityTons: 15 },
    };
    const shipperLane = { originCity: "Lipa", destCity: "Quezon City", weightTons: 10 } as never;
    expect(scoreMatch(trip, laneAsLoad(shipperLane, trip)).eligible).toBe(true);
  });
});
