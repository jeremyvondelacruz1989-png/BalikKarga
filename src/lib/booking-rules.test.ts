import { describe, expect, it } from "vitest";
import { availableActions, checkTransition } from "./booking-rules";

const shipper = { userId: "s1", role: "SHIPPER" };
const trucker = { userId: "t1", role: "TRUCKER" };
const base = { shipperId: "s1", truckerId: "t1" };

describe("booking rules", () => {
  it("only the counterparty can accept a request", () => {
    const b = { ...base, status: "PENDING", initiatedBy: "SHIPPER" };
    expect(checkTransition(b, "accept", trucker)).toBeNull();
    expect(checkTransition(b, "accept", shipper)).not.toBeNull();
    expect(availableActions(b, shipper)).toEqual(["cancel"]);
    expect(availableActions(b, trucker)).toEqual(["accept", "decline"]);
  });

  it("only the trucker moves cargo through pickup and delivery", () => {
    const accepted = { ...base, status: "ACCEPTED", initiatedBy: "TRUCKER" };
    expect(checkTransition(accepted, "start", shipper)).not.toBeNull();
    expect(checkTransition(accepted, "start", trucker)).toBeNull();
    expect(checkTransition(accepted, "deliver", trucker)).not.toBeNull();
    const moving = { ...accepted, status: "IN_TRANSIT" };
    expect(checkTransition(moving, "deliver", trucker)).toBeNull();
    expect(checkTransition(moving, "cancel", shipper)).not.toBeNull();
  });

  it("rejects outsiders", () => {
    const b = { ...base, status: "PENDING", initiatedBy: "SHIPPER" };
    expect(checkTransition(b, "accept", { userId: "x", role: "TRUCKER" })).toMatch(/not part/);
  });
});
