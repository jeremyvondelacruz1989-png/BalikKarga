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
/**
 * Booking fee, paid by the trucker from prepaid credits (1 credit = PHP 1) when a
 * booking is accepted. Contact details are revealed only after the fee is paid.
 */
export const BOOKING_FEE_RATE = 0.05;
export const BOOKING_FEE_MIN = 150;
export const TOPUP_MIN = 200;
export const TOPUP_PACKAGES = [500, 1000, 2500, 5000];
/**
 * Welcome credits for new truckers, to get them to sign up and try their first booking.
 * One bonus per mobile number. Set SIGNUP_BONUS=0 in .env to turn the promo off.
 */
export const SIGNUP_BONUS = Number(process.env.SIGNUP_BONUS ?? 300) || 0;

export function bookingFee(agreedRate: number): number {
  return Math.max(BOOKING_FEE_MIN, Math.round(agreedRate * BOOKING_FEE_RATE));
}

export const PAYMENT_METHODS = { GCASH: "GCash", MAYA: "Maya", BANK: "Bank transfer" } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** Where truckers send top-up payments. Set these in .env; the defaults are placeholders. */
export const PAYMENT_ACCOUNTS: Record<PaymentMethod, string> = {
  GCASH: process.env.NEXT_PUBLIC_PAY_GCASH || "0917 000 0000 (BalikKarga Inc.) — set NEXT_PUBLIC_PAY_GCASH",
  MAYA: process.env.NEXT_PUBLIC_PAY_MAYA || "0918 000 0000 (BalikKarga Inc.) — set NEXT_PUBLIC_PAY_MAYA",
  BANK: process.env.NEXT_PUBLIC_PAY_BANK || "BDO 0000-0000-0000 (BalikKarga Inc.) — set NEXT_PUBLIC_PAY_BANK",
};

export const DOC_TYPES = {
  GOV_ID: { label: "Government ID", for: "ALL" },
  DRIVERS_LICENSE: { label: "Driver's license", for: "TRUCKER" },
  DTI_SEC: { label: "DTI / SEC registration", for: "ALL" },
  BIR_2303: { label: "BIR Form 2303", for: "ALL" },
  OR_CR: { label: "Truck OR/CR", for: "TRUCK" },
  LTFRB_CPC: { label: "LTFRB franchise (CPC)", for: "TRUCK" },
} as const;
export type DocType = keyof typeof DOC_TYPES;
/** Rough diesel truck emissions, for the "CO2 avoided" figure. */
export const KG_CO2_PER_KM = 0.9;

export function truckTypeLabel(t: string | null | undefined): string {
  if (!t) return "Any truck";
  return (TRUCK_TYPES as Record<string, { label: string }>)[t]?.label ?? t;
}

export function cargoTypeLabel(t: string): string {
  return (CARGO_TYPES as Record<string, string>)[t] ?? t;
}
