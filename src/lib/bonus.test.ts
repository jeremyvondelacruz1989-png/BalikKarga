import { describe, expect, it } from "vitest";
import { missingBonusDocs } from "./bonus";

const ok = (docType: string, truckId: string | null = null) => ({ docType, status: "APPROVED", truckId });

describe("welcome bonus requirements", () => {
  it("needs ID, license and one truck's OR/CR + franchise", () => {
    expect(missingBonusDocs([], [])).toHaveLength(3);
    const all = [ok("GOV_ID"), ok("DRIVERS_LICENSE"), ok("OR_CR", "t1"), ok("LTFRB_CPC", "t1")];
    expect(missingBonusDocs(all, ["t1", "t2"])).toEqual([]);
  });

  it("ignores pending or rejected documents", () => {
    const docs = [ok("GOV_ID"), { docType: "DRIVERS_LICENSE", status: "PENDING", truckId: null }, ok("OR_CR", "t1"), ok("LTFRB_CPC", "t1")];
    expect(missingBonusDocs(docs, ["t1"])).toEqual(["Driver's license"]);
  });

  it("requires both truck documents for the same truck", () => {
    const docs = [ok("GOV_ID"), ok("DRIVERS_LICENSE"), ok("OR_CR", "t1"), ok("LTFRB_CPC", "t2")];
    expect(missingBonusDocs(docs, ["t1", "t2"])).toHaveLength(1);
  });
});
