import type { ItemSubmission, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildSellerAttentionItems } from "./seller-attention";

const NOW = new Date("2026-10-23T12:00:00Z");

function submission(overrides: Partial<ItemSubmission>): ItemSubmission {
  return {
    id: "s1",
    title: "Untitled study",
    status: "draft",
    rejectionReason: null,
    updatedAt: new Date("2026-10-20T12:00:00Z"),
    ...overrides,
  } as ItemSubmission;
}

function lot(overrides: Partial<Lot>): Lot {
  return {
    id: "l1",
    title: "Harbour at dusk",
    status: "active",
    winnerId: null,
    ...overrides,
  } as Lot;
}

function build(overrides: Partial<Parameters<typeof buildSellerAttentionItems>[0]> = {}) {
  return buildSellerAttentionItems({
    submissions: [],
    lots: [],
    payoutSetupIncomplete: false,
    payoutSetupHref: "/dashboard/seller/connect",
    canOpenPayoutSetup: true,
    identityVerificationNeeded: false,
    now: NOW,
    ...overrides,
  });
}

describe("buildSellerAttentionItems", () => {
  it("is empty when nothing needs doing", () => {
    expect(build()).toEqual([]);
    expect(build({ submissions: [submission({ status: "under_review" })] })).toEqual([]);
  });

  it("links a single draft straight to it", () => {
    const [item] = build({ submissions: [submission({ id: "s7", title: "Moonlit quay" })] });
    expect(item).toMatchObject({
      title: 'Finish "Moonlit quay"',
      status: "Not submitted",
      href: "/dashboard/submissions/s7",
    });
  });

  it("folds several drafts into one row that opens the Drafts tab", () => {
    const items = build({
      submissions: [submission({ id: "a" }), submission({ id: "b" }), submission({ id: "c" })],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Finish 3 drafts",
      href: "/dashboard/seller/consignments?tab=drafts",
    });
  });

  it("asks for payout setup only when there is work waiting to be paid", () => {
    const base = { payoutSetupIncomplete: true, payoutSetupHref: "/org/connect" };
    expect(build(base)).toEqual([]);
    const withLot = build({ ...base, lots: [lot({})] });
    expect(withLot.map((i) => i.id)).toEqual(["payout-setup"]);
    expect(withLot[0]?.href).toBe("/org/connect");
    const withAccepted = build({ ...base, submissions: [submission({ status: "approved" })] });
    expect(withAccepted.map((i) => i.id)).toEqual(["payout-setup"]);
  });

  it("asks for identity verification before payout setup when it is needed", () => {
    const items = build({
      identityVerificationNeeded: true,
      payoutSetupIncomplete: true,
      lots: [lot({})],
    });
    expect(items.map((i) => i.id)).toEqual(["identity", "payout-setup"]);
    expect(items[0]?.href).toBe("/dashboard/verify-identity");
  });

  it("hides payout setup from roles that cannot open it", () => {
    expect(
      build({ payoutSetupIncomplete: true, canOpenPayoutSetup: false, lots: [lot({})] }),
    ).toEqual([]);
  });

  it("surfaces the latest recent rejection with its reason", () => {
    const items = build({
      submissions: [
        submission({
          id: "old",
          status: "rejected",
          updatedAt: new Date("2026-10-01T00:00:00Z"),
          rejectionReason: "Older reason",
        }),
        submission({
          id: "new",
          title: "Quiet pier",
          status: "rejected",
          updatedAt: new Date("2026-10-15T00:00:00Z"),
          rejectionReason: "Needs a clearer signature photo",
        }),
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: '"Quiet pier" was not accepted',
      detail: "Reason given: Needs a clearer signature photo",
      status: "Needs changes",
      href: "/dashboard/submissions/new?fromRejected=new",
    });
  });

  it("ignores a rejection older than a month", () => {
    expect(
      build({
        submissions: [
          submission({ status: "rejected", updatedAt: new Date("2026-08-01T00:00:00Z") }),
        ],
      }),
    ).toEqual([]);
  });

  it("flags unsold lots, one row however many", () => {
    const one = build({ lots: [lot({ status: "ended", winnerId: null })] });
    expect(one[0]).toMatchObject({
      title: '"Harbour at dusk" did not sell',
      status: "Decide next step",
      href: "/dashboard/seller/consignments?tab=unsold",
    });
    const many = build({
      lots: [
        lot({ id: "a", status: "ended" }),
        lot({ id: "b", status: "ended" }),
        lot({ id: "c", status: "ended", winnerId: "buyer" }),
      ],
    });
    expect(many).toHaveLength(1);
    expect(many[0]?.title).toBe("2 lots did not sell");
  });

  it("orders drafts, payout setup, rejection, then unsold lots", () => {
    const items = build({
      payoutSetupIncomplete: true,
      lots: [lot({ status: "ended" })],
      submissions: [
        submission({ id: "d", status: "draft" }),
        submission({ id: "r", status: "rejected" }),
      ],
    });
    expect(items.map((i) => i.id)).toEqual(["draft:d", "payout-setup", "rejected:r", "unsold"]);
  });
});
