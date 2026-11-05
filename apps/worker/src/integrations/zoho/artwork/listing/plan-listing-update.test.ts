import { describe, expect, it } from "vitest";
import { STALE_WINDOW_MS, planListingUpdate } from "./plan-listing-update.js";

const OBSERVED = new Date("2026-11-05T12:00:00.500Z");
const wanted = { value: "On lax.art", detail: "Published 1 Nov 2026", link: "https://lax.art/a" };
const shown = (over = {}) => ({
  value: "Not offered",
  detail: null,
  link: null,
  updatedAt: new Date("2026-11-04T09:00:00Z"),
  ...over,
});

describe("planListingUpdate", () => {
  it("sends nothing when Zoho already shows the listing, so a repeat sends once", () => {
    expect(
      planListingUpdate({ wanted, current: shown({ ...wanted }), observedAt: OBSERVED }),
    ).toEqual({ kind: "unchanged" });
  });

  it("treats an empty field and a missing one as the same", () => {
    const plain = { value: "Not offered", detail: null, link: null };
    expect(
      planListingUpdate({ wanted: plain, current: shown({ detail: "" }), observedAt: OBSERVED }),
    ).toEqual({ kind: "unchanged" });
  });

  it("sends the four listing fields, stamped with when the facts were read", () => {
    expect(planListingUpdate({ wanted, current: shown(), observedAt: OBSERVED })).toEqual({
      kind: "update",
      fields: {
        LAX_Listing: "On lax.art",
        LAX_Listing_Detail: "Published 1 Nov 2026",
        LAX_Listing_Link: "https://lax.art/a",
        LAX_Listing_Updated: "2026-11-05T12:00:00+00:00",
      },
    });
  });

  it("clears detail and link when there is nothing to say", () => {
    const plan = planListingUpdate({
      wanted: { value: "Not offered", detail: null, link: null },
      current: shown({ value: "On lax.art", detail: "x", link: "y" }),
      observedAt: OBSERVED,
    });
    expect(plan).toMatchObject({
      kind: "update",
      fields: { LAX_Listing_Detail: null, LAX_Listing_Link: null },
    });
  });

  it("never sends an older picture over a newer one", () => {
    const newer = new Date(OBSERVED.getTime() + 60_000);
    expect(
      planListingUpdate({ wanted, current: shown({ updatedAt: newer }), observedAt: OBSERVED }),
    ).toEqual({ kind: "stale" });
  });

  it("ignores a time too far ahead to be a write in flight", () => {
    const future = new Date(OBSERVED.getTime() + STALE_WINDOW_MS + 1);
    expect(
      planListingUpdate({ wanted, current: shown({ updatedAt: future }), observedAt: OBSERVED })
        .kind,
    ).toBe("update");
  });
});
