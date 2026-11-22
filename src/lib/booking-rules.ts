// Booking state machine. Who may move a booking from one status to another.
//
//   PENDING ──accept──▶ ACCEPTED ──start──▶ IN_TRANSIT ──deliver──▶ DELIVERED
//      │  └─decline─▶ DECLINED      │
//      └──cancel──▶ CANCELLED ◀─────┘
//
// A booking is created either by a shipper requesting a return trip (initiatedBy SHIPPER)
// or by a trucker offering on a load (initiatedBy TRUCKER). The *other* side accepts.

import type { BookingStatus } from "./constants";

export type BookingAction = "accept" | "decline" | "cancel" | "start" | "deliver";

export interface BookingActor {
  userId: string;
  role: string;
}

export interface BookingState {
  status: string;
  initiatedBy: string;
  shipperId: string;
  truckerId: string;
}

export function nextStatus(action: BookingAction): BookingStatus {
  return ({
    accept: "ACCEPTED",
    decline: "DECLINED",
    cancel: "CANCELLED",
    start: "IN_TRANSIT",
    deliver: "DELIVERED",
  } as const)[action];
}

/** Returns null when allowed, or a human-readable reason when not. */
export function checkTransition(b: BookingState, action: BookingAction, actor: BookingActor): string | null {
  const isShipper = actor.userId === b.shipperId;
  const isTrucker = actor.userId === b.truckerId;
  if (!isShipper && !isTrucker) return "You are not part of this booking";
  const isInitiator = (b.initiatedBy === "SHIPPER" && isShipper) || (b.initiatedBy === "TRUCKER" && isTrucker);

  switch (action) {
    case "accept":
    case "decline":
      if (b.status !== "PENDING") return "Only pending bookings can be accepted or declined";
      if (isInitiator) return "Waiting for the other side to respond";
      return null;
    case "cancel":
      if (b.status === "PENDING") return isInitiator ? null : "Decline the request instead";
      if (b.status === "ACCEPTED") return null;
      return "This booking can no longer be cancelled";
    case "start":
      if (!isTrucker) return "Only the trucker can mark pickup";
      return b.status === "ACCEPTED" ? null : "Booking must be accepted first";
    case "deliver":
      if (!isTrucker) return "Only the trucker can mark delivery";
      return b.status === "IN_TRANSIT" ? null : "Cargo must be picked up first";
  }
}

export function availableActions(b: BookingState, actor: BookingActor): BookingAction[] {
  const all: BookingAction[] = ["accept", "decline", "start", "deliver", "cancel"];
  return all.filter((a) => checkTransition(b, a, actor) === null);
}
