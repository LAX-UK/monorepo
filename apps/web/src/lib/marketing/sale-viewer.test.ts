import type { SaleRegistrationMineRow } from "@/lib/data/http/sales.types";
import { describe, expect, it } from "vitest";
import { SIGNED_OUT_SALE_VIEWER, buildSaleViewerVM } from "./sale-viewer";

type Status = SaleRegistrationMineRow["status"];

const registration = (status: Status): SaleRegistrationMineRow => ({
  id: `reg-${status}`,
  saleId: "sale-1",
  userId: "user-1",
  buyerLegalEntityId: "le-1",
  status,
  requestedAt: "2026-11-10T09:00:00.000Z",
  bidLimit: null,
  rejectionReason: null,
  paddleNumber: null,
  checkedInAt: null,
});

const build = (statuses: Status[]) =>
  buildSaleViewerVM({
    session: null,
    isFollowing: false,
    watchedLotIds: [],
    actingMemberships: null,
    mySaleRegs: statuses.map(registration),
    kycSummary: null,
    kycUnavailable: false,
    orgModuleEnabled: false,
    telephoneBooking: null,
  });

// The hero and the phone bar both read this one flag; neither works it out for itself.
describe("SaleViewerVM.hasApprovedRegistration", () => {
  it.each<[string, Status[], boolean]>([
    ["no registration", [], false],
    ["a pending registration", ["pending"], false],
    ["a rejected and a withdrawn registration", ["rejected", "withdrawn"], false],
    ["an approved registration", ["approved"], true],
    ["one approved among others", ["pending", "approved"], true],
  ])("is decided once: %s", (_name, statuses, expected) => {
    expect(build(statuses).hasApprovedRegistration).toBe(expected);
  });

  it("is false for the signed-out page", () => {
    expect(SIGNED_OUT_SALE_VIEWER.hasApprovedRegistration).toBe(false);
  });
});
