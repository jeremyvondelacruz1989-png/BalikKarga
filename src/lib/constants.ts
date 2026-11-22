export const ROLES = ["ADMIN", "SHIPPER", "TRUCKER"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Truck classes common in PH trucking, with indicative full-trip rates.
 * ratePerKm / minFare are rough market estimates for a one-way loaded trip
 * (PHP, 2026) and should be tuned with real lane data before launch.
 */
export const TRUCK_TYPES = {
  CLOSED_VAN_4W: { label: "4-wheeler closed van", maxTons: 2, ratePerKm: 40, minFare: 3500, roroFee: 3500 },
  SIX_WHEELER: { label: "6-wheeler (dropside/closed)", maxTons: 6, ratePerKm: 60, minFare: 6000, roroFee: 6500 },
  WING_VAN_6W: { label: "6-wheeler wing van", maxTons: 7, ratePerKm: 70, minFare: 7000, roroFee: 7000 },
  WING_VAN_10W: { label: "10-wheeler wing van", maxTons: 15, ratePerKm: 90, minFare: 10000, roroFee: 11000 },
  FLATBED_10W: { label: "10-wheeler dropside/flatbed", maxTons: 15, ratePerKm: 85, minFare: 9500, roroFee: 11000 },
  REEFER: { label: "Reefer (refrigerated) van", maxTons: 10, ratePerKm: 110, minFare: 12000, roroFee: 11000 },
  TRAILER: { label: "Tractor head + trailer", maxTons: 30, ratePerKm: 120, minFare: 15000, roroFee: 18000 },
} as const;
export type TruckType = keyof typeof TRUCK_TYPES;
export const TRUCK_TYPE_KEYS = Object.keys(TRUCK_TYPES) as TruckType[];

export const CARGO_TYPES = {
  GENERAL: "General cargo",
  FMCG: "FMCG / consumer goods",
  AGRI: "Agri / fresh produce",
  COLD_CHAIN: "Cold chain (frozen/chilled)",
  CONSTRUCTION: "Construction materials",
  FURNITURE: "Furniture / appliances",
  RICE_GRAINS: "Rice / grains / feeds",
} as const;
export type CargoType = keyof typeof CARGO_TYPES;
export const CARGO_TYPE_KEYS = Object.keys(CARGO_TYPES) as CargoType[];

export const TRIP_STATUSES = ["OPEN", "BOOKED", "COMPLETED", "CANCELLED"] as const;
export const LOAD_STATUSES = ["OPEN", "MATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
export const BOOKING_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Backhaul loads are sold at a discount to a regular trip because the truck is coming back anyway. */
export const BACKHAUL_DISCOUNT = 0.6; // suggested price = 60% of the regular market rate
/** Platform commission taken from the agreed rate (shown to admins only in this MVP). */
export const PLATFORM_FEE_RATE = 0.08;
/** Rough diesel truck emissions, for the "CO2 avoided" figure. */
export const KG_CO2_PER_KM = 0.9;

export function truckTypeLabel(t: string | null | undefined): string {
  if (!t) return "Any truck";
  return (TRUCK_TYPES as Record<string, { label: string }>)[t]?.label ?? t;
}

export function cargoTypeLabel(t: string): string {
  return (CARGO_TYPES as Record<string, string>)[t] ?? t;
}
