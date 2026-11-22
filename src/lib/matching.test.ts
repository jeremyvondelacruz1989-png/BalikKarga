import { describe, expect, it } from "vitest";
import { marketRate, scoreMatch, suggestedBackhaulRate, type LoadInput, type TripInput } from "./matching";
import { needsRoro, roadKm } from "./geo";

const d = (s: string) => new Date(s);

// Truck delivered in Batangas City, heading home to Valenzuela.
const trip: TripInput = {
  originCity: "Batangas City",
  destCity: "Valenzuela",
  availableFrom: d("2026-12-01T06:00:00+08:00"),
  availableTo: d("2026-12-02T18:00:00+08:00"),
  maxDetourKm: 40,
  askingRate: null,
  truck: { truckType: "WING_VAN_10W", capacityTons: 15 },
};

const load: LoadInput = {
  cargoType: "FMCG",
  weightTons: 12,
  truckType: null,
  pickupCity: "Lipa",
  dropCity: "Quezon City",
  pickupDate: d("2026-12-01T08:00:00+08:00"),
  deliverBy: d("2026-12-02T12:00:00+08:00"),
  budget: 15000,
};

describe("geo", () => {
  it("estimates road distance", () => {
    const km = roadKm("Manila", "Batangas City");
    expect(km).toBeGreaterThan(100);
    expect(km).toBeLessThan(140);
  });
  it("detects sea crossings", () => {
    expect(needsRoro("Manila", "Cebu City")).toBe(true);
    expect(needsRoro("Tacloban", "Catbalogan")).toBe(false); // San Juanico bridge
    expect(needsRoro("Manila", "Baguio")).toBe(false);
  });
});

describe("pricing", () => {
  it("applies the backhaul discount and minimum fare", () => {
    expect(suggestedBackhaulRate("WING_VAN_10W", 200)).toBeLessThan(marketRate("WING_VAN_10W", 200));
    expect(marketRate("CLOSED_VAN_4W", 1)).toBe(3500);
  });
  it("passes RoRo fees through undiscounted", () => {
    const withRoro = suggestedBackhaulRate("SIX_WHEELER", 100, 1);
    const without = suggestedBackhaulRate("SIX_WHEELER", 100, 0);
    expect(withRoro - without).toBe(6500);
  });
});

describe("scoreMatch", () => {
  it("scores an on-the-way load highly", () => {
    const m = scoreMatch(trip, load);
    expect(m.eligible).toBe(true);
    expect(m.score).toBeGreaterThan(60);
    expect(m.detourKm).toBeLessThanOrEqual(40);
  });

  it("rejects loads heavier than the truck", () => {
    const m = scoreMatch(trip, { ...load, weightTons: 20 });
    expect(m.eligible).toBe(false);
    expect(m.reasons.join(" ")).toMatch(/truck carries/);
  });

  it("rejects loads in the wrong direction", () => {
    const m = scoreMatch(trip, { ...load, pickupCity: "Lucena", dropCity: "Naga" });
    expect(m.eligible).toBe(false);
    expect(m.reasons.join(" ")).toMatch(/Detour/);
  });

  it("rejects when dates don't overlap", () => {
    const m = scoreMatch(trip, { ...load, pickupDate: d("2026-12-05"), deliverBy: d("2026-12-06") });
    expect(m.eligible).toBe(false);
  });

  it("requires a reefer for cold chain", () => {
    expect(scoreMatch(trip, { ...load, cargoType: "COLD_CHAIN" }).eligible).toBe(false);
    const reefer = { ...trip, truck: { truckType: "REEFER", capacityTons: 10 } };
    expect(scoreMatch(reefer, { ...load, cargoType: "COLD_CHAIN", weightTons: 8 }).eligible).toBe(true);
  });

  it("lets a wing van take a 6-wheeler load", () => {
    expect(scoreMatch(trip, { ...load, truckType: "SIX_WHEELER", weightTons: 5 }).eligible).toBe(true);
  });

  it("penalises budgets below the asking rate", () => {
    const rich = scoreMatch({ ...trip, askingRate: 10000 }, { ...load, budget: 20000 });
    const poor = scoreMatch({ ...trip, askingRate: 10000 }, { ...load, budget: 5000 });
    expect(rich.score).toBeGreaterThan(poor.score);
  });
});
