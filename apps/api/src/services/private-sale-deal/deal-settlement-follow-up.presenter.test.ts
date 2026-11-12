import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { makeDeal } from "./deal-fixtures.test-util.js";
import { DealSettlementFollowUpPresenter } from "./deal-settlement-follow-up.presenter.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

const ART = "00000000-0000-4000-8000-000000000001";
const SETTLED = new Date("2026-11-30T16:00:00Z");
const viewer = (manage: boolean): DealStaffViewer => ({
  userId: "u",
  abilities: { manage, finance: false, release: false },
  checks: false,
  scope: { kind: "all" },
});

function presenterFor(offer: ArtworkRegisterEntry["offer"], kind = "original") {
  return new DealSettlementFollowUpPresenter({
    register: { findById: async () => ({ id: ART, kind, offer }) as ArtworkRegisterEntry },
    lockLinks: {
      attach: async (items) =>
        items.map(({ lock }) => ({
          ...lock,
          link: lock.link ? { ...lock.link, href: "/x" } : null,
        })),
    },
  });
}
const deal = makeDeal({ id: "deal-1", stage: "settled", artworkRegisterId: ART });

describe("DealSettlementFollowUpPresenter", () => {
  it("is nothing once the register shows the artwork sold through the deal", async () => {
    const p = presenterFor({ state: "sold", ref: { kind: "private_sale", id: "deal-1" } });
    expect(await p.present(viewer(true), deal, SETTLED)).toBeNull();
  });

  it("is normal, with a retry for those who run deals, while it is only held", async () => {
    const p = presenterFor({ state: "private_sale", ref: { kind: "private_sale", id: "deal-1" } });
    expect(await p.present(viewer(true), deal, SETTLED)).toEqual({
      severity: "normal",
      settledAt: SETTLED,
      lock: null,
      canRetry: true,
    });
    expect((await p.present(viewer(false), deal, SETTLED))?.canRetry).toBe(false);
  });

  it("is urgent and carries the register's reason when the artwork is shown elsewhere", async () => {
    const p = presenterFor({ state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } });
    const result = await p.present(viewer(true), deal, SETTLED);
    expect(result?.severity).toBe("urgent");
    expect(result?.canRetry).toBe(false);
    expect(result?.lock).toMatchObject({ reason: "in_bid_sale", link: { href: "/x" } });
  });

  it("does not apply to a deal that has not settled or has no artwork", async () => {
    const p = presenterFor({ state: "held", ref: null });
    expect(await p.present(viewer(true), { ...deal, stage: "paid" }, SETTLED)).toBeNull();
    expect(await p.present(viewer(true), { ...deal, artworkRegisterId: null }, SETTLED)).toBeNull();
  });
});
