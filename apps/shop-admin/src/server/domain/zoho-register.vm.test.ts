import type { AdminRegisterEvent, AdminRegisterLastCheck } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  activeZohoTab,
  buildRegisterTimeline,
  checkFigures,
  checkFootnote,
  hasActiveZohoFilters,
  missingSummary,
  pageLinks,
  pageSummary,
  parseZohoQueueQuery,
  presentConflictValue,
  presentOfferState,
  skippedReasonLabel,
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
    expect(presentOfferState("held")).toEqual({ label: "Not offered yet", tone: "neutral" });
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

describe("buildRegisterTimeline", () => {
  const event = (
    over: Partial<AdminRegisterEvent> & Pick<AdminRegisterEvent, "type">,
  ): AdminRegisterEvent => ({
    id: over.type,
    actor: "zoho",
    payload: {},
    createdAt: "2026-11-03T09:00:00.000Z",
    ...over,
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
    ]);
    expect(titles.map((t) => t.title)).toEqual([
      "Came in from Zoho",
      "Updated from Zoho: medium, size",
      "Zoho changed the stock code; LAX kept its own until someone decides",
      "Kept the LAX value for the stock code",
      "Moved from Not offered yet to On lax.art",
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
