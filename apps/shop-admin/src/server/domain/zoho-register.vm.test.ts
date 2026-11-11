import type { AdminRegisterEvent, AdminRegisterLastCheck } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  activeZohoTab,
  auctionOfferAvailability,
  buildRegisterTimeline,
  checkFigures,
  checkFootnote,
  conflictDecisionCopy,
  failedDeliveriesNote,
  hasActiveZohoFilters,
  laxArtOfferAvailability,
  listingFailureLabel,
  listingFigures,
  missingSummary,
  pageLinks,
  pageSummary,
  parseZohoQueueQuery,
  presentConflictValue,
  presentOfferState,
  setInLaxLine,
  skippedReasonLabel,
  soldAttentionActionHref,
  zohoProductUrl,
  zohoQueueApiQuery,
  zohoQueueHref,
} from "./zoho-register.vm";

describe("the queue's URL state", () => {
  it("reads the tab, filters and page, and drops anything it does not know", () => {
    expect(
      parseZohoQueueQuery({ tab: "decisions", artist: "PH", missing: "image", page: "3" }),
    ).toEqual({ tab: "decisions", artist: "PH", missing: "image", page: "3" });
    expect(parseZohoQueueQuery({ tab: "new", missing: "price", page: "0" })).toEqual({});
    expect(parseZohoQueueQuery({ page: "1" })).toEqual({});
    expect(parseZohoQueueQuery({ tab: ["check", "new"] })).toEqual({ tab: "check" });
  });

  it("reads the All tab and its Where it is filter", () => {
    expect(parseZohoQueueQuery({ tab: "all", place: "draft_lax_art", artist: "PH" })).toEqual({
      tab: "all",
      place: "draft_lax_art",
      artist: "PH",
    });
    expect(parseZohoQueueQuery({ tab: "all", place: "draft_bid_lot" })).toEqual({ tab: "all" });
    expect(activeZohoTab({ tab: "all" })).toBe("all");
    expect(zohoQueueHref({ tab: "all", place: "sold", page: "2" }, { place: "lax_art" })).toBe(
      "/from-zoho?tab=all&place=lax_art",
    );
  });

  it("opens on New from Zoho", () => {
    expect(activeZohoTab({})).toBe("new");
    expect(activeZohoTab({ tab: "check" })).toBe("check");
  });

  it("goes back to page one when a filter changes, and keeps the tab", () => {
    expect(zohoQueueHref({ artist: "PH", page: "4" }, { missing: "size" })).toBe(
      "/from-zoho?artist=PH&missing=size",
    );
    expect(zohoQueueHref({ tab: "decisions" }, { artist: "PH" })).toBe(
      "/from-zoho?tab=decisions&artist=PH",
    );
    expect(zohoQueueHref({ artist: "PH", page: "2" }, { artist: null })).toBe("/from-zoho");
  });

  it("knows when a filter is in force", () => {
    expect(hasActiveZohoFilters({})).toBe(false);
    expect(hasActiveZohoFilters({ tab: "decisions", page: "2" })).toBe(false);
    expect(hasActiveZohoFilters({ missing: "image" })).toBe(true);
    expect(hasActiveZohoFilters({ tab: "all", place: "sold" })).toBe(true);
    expect(hasActiveZohoFilters({ tab: "all", missing: "image" })).toBe(false);
  });

  it("sends the place to the API", () => {
    expect(zohoQueueApiQuery({ tab: "all", place: "sold", artist: "PH" })).toEqual({
      artist: "PH",
      place: "sold",
    });
  });

  it("sends only what the API takes", () => {
    expect(zohoQueueApiQuery({ tab: "decisions", artist: "PH", page: "2" })).toEqual({
      artist: "PH",
      page: "2",
    });
  });

  it("links to the neighbouring pages", () => {
    expect(pageLinks({ artist: "PH" }, { page: 1, pageSize: 25, total: 60 })).toEqual({
      prevHref: null,
      nextHref: "/from-zoho?artist=PH&page=2",
    });
    expect(pageLinks({ artist: "PH", page: "2" }, { page: 2, pageSize: 25, total: 60 })).toEqual({
      prevHref: "/from-zoho?artist=PH",
      nextHref: "/from-zoho?artist=PH&page=3",
    });
    expect(pageLinks({ page: "3" }, { page: 3, pageSize: 25, total: 60 }).nextHref).toBeNull();
  });

  it("summarises a page", () => {
    expect(pageSummary({ page: 3, pageSize: 25, total: 60 })).toBe("51–60 of 60");
    expect(pageSummary({ page: 1, pageSize: 25, total: 7 })).toBe("1–7 of 7");
  });
});

describe("what is missing", () => {
  it("names each gap in plain words", () => {
    expect(missingSummary(["image", "size"])).toBe("Still missing: image, size");
    expect(missingSummary([])).toBeNull();
  });
});

describe("offer states and values", () => {
  it("reads held as not offered yet", () => {
    expect(presentOfferState("held")).toEqual({ label: "Not offered", tone: "neutral" });
    expect(presentOfferState("mystery").label).toBe("mystery");
  });

  it("shows conflict values the way staff say them", () => {
    expect(presentConflictValue("kind", "print")).toBe("Print");
    expect(presentConflictValue("offerState", "lax_art")).toBe("On lax.art");
    expect(presentConflictValue("stockCode", "LAX-ORI-PH-GAC-26-0099")).toBe(
      "LAX-ORI-PH-GAC-26-0099",
    );
    expect(presentConflictValue("stockCode", null)).toBeNull();
  });

  it("links to the Zoho Product from the shared CRM address", () => {
    const template = "https://crm.zoho.eu/crm/org20111813184/tab/{module}/{recordId}";
    expect(zohoProductUrl(template, "5001")).toBe(
      "https://crm.zoho.eu/crm/org20111813184/tab/Products/5001",
    );
    expect(zohoProductUrl(undefined, "5001")).toBeNull();
  });

  it("opens Products for a print that came in from Zoho, which is a Product", () => {
    const template = "https://crm.zoho.eu/crm/org20111813184/tab/{module}/{recordId}";
    expect(zohoProductUrl(template, "5002")).toBe(
      "https://crm.zoho.eu/crm/org20111813184/tab/Products/5002",
    );
  });

  it("opens a print group's own module, not Products", () => {
    const template = "https://crm.zoho.eu/crm/org20111813184/tab/{module}/{recordId}";
    expect(zohoProductUrl(template, "7001", "Print_Products")).toBe(
      "https://crm.zoho.eu/crm/org20111813184/tab/Print_Products/7001",
    );
    expect(zohoProductUrl(template, "7001", "Products")).toContain("/tab/Products/");
  });
});

const run: NonNullable<AdminRegisterLastCheck["run"]> = {
  mode: "dry_run",
  finishedAt: "2026-11-03T02:30:00.000Z",
  total: 859,
  outcomes: { create: 376, update: 4, conflict: 2, unchanged: 100, stale: 0, skipped: 377 },
  skippedReasons: [],
  gaps: [],
};

describe("the last check", () => {
  it("says would be added while nothing is applied, and added once it is", () => {
    expect(checkFigures(run).map((f) => [f.label, f.value])).toEqual([
      ["Products read", "859"],
      ["Would be added", "376"],
      ["Need a decision", "2"],
      ["Left out", "377"],
    ]);
    expect(checkFigures({ ...run, mode: "live" })[1]?.label).toBe("Added");
  });

  it("sums up the smaller counts and leaves out the empty ones", () => {
    expect(checkFootnote(run)).toBe("4 would be updated, 100 unchanged.");
    expect(checkFootnote({ ...run, mode: "live" })).toBe("4 updated, 100 unchanged.");
    expect(
      checkFootnote({ ...run, outcomes: { ...run.outcomes, update: 0, unchanged: 0 } }),
    ).toBeNull();
  });

  it("explains why an artwork was left out", () => {
    expect(skippedReasonLabel("missing_artist")).toBe("No artist");
    expect(skippedReasonLabel("register_refused_duplicate_zoho_product")).toBe(
      "LAX could not add it",
    );
    expect(skippedReasonLabel("something_new")).toBe("Left out for another reason");
  });
});

describe("conflictDecisionCopy", () => {
  const conflict = {
    field: "offerState" as const,
    zohoValue: "withdrawn",
    laxValue: "lax_art",
  };

  it("says what keeping LAX's value does", () => {
    expect(conflictDecisionCopy(conflict, "kept_lax")).toMatchObject({
      title: "Keep the LAX value for where it is offered?",
      confirmLabel: "Keep LAX value",
    });
    expect(conflictDecisionCopy(conflict, "kept_lax").description).toContain(
      "LAX will set Zoho back to On lax.art",
    );
  });

  it("says that accepting Zoho's value applies it, and what happens if it is taken", () => {
    const copy = conflictDecisionCopy(
      { field: "stockCode", zohoValue: "LAX-ORI-PH-GAC-26-0099", laxValue: null },
      "accepted_zoho",
    );
    expect(copy.title).toBe("Accept the Zoho value for the stock code?");
    expect(copy.description).toContain(
      "LAX changes the stock code to LAX-ORI-PH-GAC-26-0099 straight away",
    );
    expect(copy.description).not.toContain("does not");
  });
});

describe("setInLaxLine", () => {
  it("says where it is set and what LAX will send back to Zoho", () => {
    expect(setInLaxLine({ field: "offerState", laxValue: "lax_art" })).toBe(
      "Where it is offered is set in LAX. LAX will set Zoho back to On lax.art.",
    );
    expect(setInLaxLine({ field: "sourceOriginalId", laxValue: null })).toBe(
      "Made from is set in LAX. LAX will clear it in Zoho.",
    );
  });
});

describe("buildRegisterTimeline", () => {
  const event = (
    over: Partial<AdminRegisterEvent> & Pick<AdminRegisterEvent, "type">,
  ): AdminRegisterEvent => ({
    id: over.type,
    actor: "zoho",
    actorName: null,
    payload: {},
    createdAt: "2026-11-03T09:00:00.000Z",
    ...over,
  });

  it("tells a draft lot with the sale, the consignor's agreement and a take-down", () => {
    const [moved, plain, back, writeback] = buildRegisterTimeline([
      event({
        type: "move_confirmed",
        actor: "staff",
        actorName: "Lena Hart",
        payload: {
          direction: "to_auction",
          saleTitle: "Winter Modern and Contemporary",
          consignorAgreed: true,
          withdrawnFromLaxArt: true,
        },
      }),
      event({
        type: "move_confirmed",
        payload: { direction: "to_auction", consignorAgreed: true },
      }),
      event({ type: "move_confirmed", payload: { direction: "to_lax_art" } }),
      event({ type: "zoho_writeback_recorded", payload: { to: "In Auction" } }),
    ]);
    expect(moved).toMatchObject({
      title: "Draft lot created",
      actor: "Lena Hart",
      detail: "Consignor agreement confirmed · Winter Modern and Contemporary · Taken off lax.art",
    });
    expect(plain).toMatchObject({ detail: "Consignor agreement confirmed" });
    expect(back).toMatchObject({ title: "Returned to lax.art as a draft" });
    expect(writeback).toMatchObject({
      title: "Status set in Zoho",
      detail: "Zoho Status is now In Auction",
    });
  });

  it("never falls back to a bare Changed", () => {
    const [first] = buildRegisterTimeline([event({ type: "created", payload: {} })]);
    expect(first?.title).not.toBe("Changed");
  });

  it("tells each kind of event in a sentence", () => {
    const titles = buildRegisterTimeline([
      event({ type: "created" }),
      event({ type: "zoho_change_applied", payload: { fields: { medium: {}, dimensions: {} } } }),
      event({
        type: "conflict_recorded",
        payload: { field: "stockCode", zohoValue: "LAX-ORI-PH-GAC-26-0099" },
      }),
      event({
        type: "conflict_resolved",
        actor: "staff",
        payload: { field: "stockCode", resolution: "kept_lax" },
      }),
      event({
        type: "offer_moved",
        actor: "staff",
        payload: { from: { state: "held" }, to: { state: "lax_art" } },
      }),
      event({ type: "lax_art_draft_created", actor: "staff", payload: { artworkId: "a1" } }),
    ]);
    expect(titles.map((t) => t.title)).toEqual([
      "Came in from Zoho",
      "Updated from Zoho: medium, size",
      "Zoho changed the stock code; LAX kept its own until someone decides",
      "Kept the LAX value for the stock code",
      "Moved from Not offered to On lax.art",
      "lax.art draft created",
    ]);
    expect(titles[2]).toMatchObject({
      detail: "Zoho now has LAX-ORI-PH-GAC-26-0099",
      tone: "warning",
    });
    expect(titles[3]).toMatchObject({ actor: "LAX staff", tone: "success" });
  });

  it("never shows a raw field or state name it does not know", () => {
    const [item] = buildRegisterTimeline([
      event({ type: "conflict_recorded", payload: { field: "somethingNew" } }),
    ]);
    expect(item?.title).toBe("Zoho changed a field; LAX kept its own until someone decides");
  });
});

describe("laxArtOfferAvailability", () => {
  const original = { kind: "original" as const, laxArt: null, offerBlockers: [] };

  it("offers an original that is not held anywhere", () => {
    expect(laxArtOfferAvailability(original)).toEqual({ kind: "offer" });
  });

  it("draws nothing for a print", () => {
    expect(laxArtOfferAvailability({ ...original, kind: "print" })).toEqual({ kind: "hidden" });
  });

  it("opens the listing once there is one, even when the register holds the artwork there", () => {
    const laxArt = {
      artworkId: "a1",
      slug: "s",
      published: true,
      createdAt: "2026-11-04T10:00:00Z",
    };
    expect(
      laxArtOfferAvailability({
        ...original,
        laxArt,
        offerBlockers: [{ message: "This artwork is live on lax.art.", link: null }],
      }),
    ).toEqual({ kind: "open", href: "/artworks/a1" });
  });

  it("stays, disabled, with every reason in words", () => {
    expect(
      laxArtOfferAvailability({
        ...original,
        offerBlockers: [
          { message: "This artwork is in a LAX Bid sale.", link: null },
          { message: "Zoho shows this artwork as reserved.", link: null },
        ],
      }),
    ).toEqual({
      kind: "blocked",
      reason: "This artwork is in a LAX Bid sale. Zoho shows this artwork as reserved.",
    });
  });
});

describe("the LAX listing check", () => {
  const listingRun: NonNullable<AdminRegisterLastCheck["listing"]["run"]> = {
    mode: "dry_run",
    finishedAt: "2026-11-05T03:00:00.000Z",
    checked: 668,
    changed: 12,
    unchanged: 655,
    failed: 1,
    failures: [],
  };

  it("says would be corrected in a dry run and corrected once live", () => {
    expect(listingFigures(listingRun).map((f) => [f.label, f.value])).toEqual([
      ["Artworks checked", "668"],
      ["Would be corrected", "12"],
      ["Already right", "655"],
      ["Not written", "1"],
    ]);
    expect(listingFigures({ ...listingRun, mode: "live" })[1]?.label).toBe("Corrected");
  });

  it("names why a write failed, with a plain fallback", () => {
    expect(listingFailureLabel("product_not_found")).toBe("No longer in Zoho");
    expect(listingFailureLabel("SOMETHING_NEW")).toBe("Zoho did not accept it");
  });

  it("counts the writes that stopped, in the singular and the plural", () => {
    expect(failedDeliveriesNote(0)).toBeNull();
    expect(failedDeliveriesNote(1)).toBe(
      "1 update to Zoho stopped after its retries. It is waiting in Failed jobs in LAX Bid admin.",
    );
    expect(failedDeliveriesNote(3)).toContain("3 updates to Zoho stopped after their retries.");
  });
});

describe("auctionOfferAvailability", () => {
  const place = (key: string) => ({ key }) as never;
  const original = {
    kind: "original" as const,
    auctionBlockers: [],
    whereItIs: place("not_offered"),
  };

  it("offers an original that can be offered, with or without a lax.art draft", () => {
    expect(auctionOfferAvailability(original)).toEqual({ kind: "offer" });
    expect(auctionOfferAvailability({ ...original, whereItIs: place("draft_lax_art") })).toEqual({
      kind: "offer",
    });
  });

  it("draws nothing for a print", () => {
    expect(auctionOfferAvailability({ ...original, kind: "print" })).toEqual({ kind: "hidden" });
  });

  it("stays, disabled, with every reason in words", () => {
    expect(
      auctionOfferAvailability({
        ...original,
        auctionBlockers: [
          { message: "Zoho shows this artwork as reserved.", link: null },
          { message: "This artwork is in a private sale.", link: null },
        ],
      }),
    ).toEqual({
      kind: "blocked",
      reason: "Zoho shows this artwork as reserved. This artwork is in a private sale.",
    });
  });

  it("points at the draft lot once there is one, instead of offering again", () => {
    const result = auctionOfferAvailability({ ...original, whereItIs: place("draft_bid_lot") });
    expect(result).toMatchObject({ kind: "blocked" });
    expect(result.kind === "blocked" ? result.reason : "").toMatch(
      /draft lot is already in LAX Bid/,
    );
  });
});

describe("soldAttentionActionHref", () => {
  const links = {
    bidAdminUrl: "https://bid.example/admin/",
    zohoUrlTemplate: "https://crm.example/{module}/{recordId}",
  };
  const item = (
    place: "lax_art" | "bid_sale" | "bid_reoffer" | "private_sale",
    placeRefId: string | null,
  ) => ({
    place,
    placeRefId,
    zohoProductId: "z-1",
  });

  it("sends Unpublish from lax.art to the artwork in LAX Admin", () => {
    expect(soldAttentionActionHref(item("lax_art", "art-1"), "unpublish_lax_art", links)).toEqual({
      href: "/artworks/art-1",
      external: false,
    });
  });

  it("sends the lot actions to the lot in Bid admin, and leaves them out without access", () => {
    expect(soldAttentionActionHref(item("bid_sale", "lot-1"), "withdraw_lot", links)).toEqual({
      href: "https://bid.example/admin/lots/lot-1",
      external: true,
    });
    expect(
      soldAttentionActionHref(item("bid_reoffer", "lot-1"), "withdraw_offer", {
        ...links,
        bidAdminUrl: null,
      }),
    ).toBeNull();
  });

  it("has no page for a private sale's offer", () => {
    expect(
      soldAttentionActionHref(item("private_sale", "p-1"), "withdraw_offer", links),
    ).toBeNull();
  });

  it("opens the Zoho record when the CRM link is set", () => {
    expect(soldAttentionActionHref(item("lax_art", "a"), "open_in_zoho", links)).toEqual({
      href: "https://crm.example/Products/z-1",
      external: true,
    });
    expect(
      soldAttentionActionHref(item("lax_art", "a"), "open_in_zoho", {
        ...links,
        zohoUrlTemplate: null,
      }),
    ).toBeNull();
  });

  it("does not link It is not sold", () => {
    expect(soldAttentionActionHref(item("lax_art", "a"), "not_sold", links)).toBeNull();
  });
});
