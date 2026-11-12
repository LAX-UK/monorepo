import type { AdminZohoSyncHealth } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  DRIFT_LISTS,
  DRIFT_LIST_ORDER,
  driftFigures,
  failedJobsHref,
  inboundFigures,
  leftOutReason,
  listingFigures,
  outboundFigures,
  syncHealthHref,
  tokenFigures,
  tokenNotice,
} from "./zoho-sync-health.vm";

const format = (iso: string) => `@${iso}`;
const T = "2026-11-10T02:30:00.000Z";
/** Ten minutes after T: nothing is overdue yet. */
const NOW = "2026-11-10T02:40:00.000Z";
const DAYS_LATER = "2026-11-12T02:30:00.000Z";

describe("failed jobs link", () => {
  it("points into LAX Bid admin, and is absent when Bid cannot say where that is", () => {
    expect(failedJobsHref("https://bid.example/")).toBe("https://bid.example/admin/failed-jobs");
    expect(failedJobsHref(null)).toBeNull();
  });
});

describe("inbound figures", () => {
  it("shows dashes before the first run, never zeros", () => {
    expect(inboundFigures(null, format, NOW).map((f) => f.value)).toEqual(["—", "—", "—", "—"]);
  });

  it("shows time, products seen, changed and left out, and says a dry run would change", () => {
    const run = {
      mode: "dry_run",
      finishedAt: T,
      seen: 120,
      changed: 5,
      leftOut: 4,
      conflicts: 2,
    } as const;
    const figures = inboundFigures(run, format, NOW);
    expect(figures.map((f) => [f.label, f.value])).toEqual([
      ["Last run", `@${T}`],
      ["Products seen", "120"],
      ["Would change", "5"],
      ["Left out", "4"],
    ]);
    expect(figures[3]?.hint).toBe("2 need a decision");
    expect(inboundFigures({ ...run, mode: "live" }, format, NOW)[2]?.label).toBe("Changed");
  });
});

describe("tones", () => {
  const run = {
    mode: "live",
    finishedAt: T,
    seen: 1,
    changed: 0,
    leftOut: 0,
    conflicts: 0,
  } as const;
  const listing = { mode: "live", finishedAt: T, checked: 1, drift: 0, failed: 0 } as const;

  it("marks a nightly pass that is overdue as attention, and not one that ran last night", () => {
    expect(inboundFigures(run, format, NOW)[0]?.tone).toBeUndefined();
    expect(inboundFigures(run, format, DAYS_LATER)[0]).toMatchObject({ tone: "attention" });
    expect(listingFigures(listing, format, NOW)[0]?.tone).toBeUndefined();
    expect(listingFigures(listing, format, DAYS_LATER)[0]).toMatchObject({ tone: "attention" });
    expect(listingFigures({ ...listing, failed: 2 }, format, NOW)[3]?.tone).toBe("attention");
  });

  it("marks a backlog and failed writes as attention, an empty queue as nothing", () => {
    const quiet = outboundFigures(
      { depth: 0, oldestPendingAt: null, deadLettered: 0 },
      format,
      null,
      NOW,
    );
    expect(quiet.every((f) => f.tone === undefined)).toBe(true);
    const fresh = outboundFigures(
      { depth: 3, oldestPendingAt: T, deadLettered: 0 },
      format,
      null,
      NOW,
    );
    expect(fresh.every((f) => f.tone === undefined)).toBe(true);
    const backlog = outboundFigures(
      { depth: 3, oldestPendingAt: T, deadLettered: 0 },
      format,
      null,
      DAYS_LATER,
    );
    expect(backlog.slice(0, 2).map((f) => f.tone)).toEqual(["attention", "attention"]);
    const failed = outboundFigures(
      { depth: 0, oldestPendingAt: null, deadLettered: 1 },
      format,
      null,
      NOW,
    );
    expect(failed[2]?.tone).toBe("attention");
  });

  it("marks token refresh failures as attention, and critical only once it is failing", () => {
    const token = {
      status: "warning",
      refreshedAt: T,
      expiresAt: null,
      failureStreak: 1,
      lastFailureAt: T,
    } as const;
    expect(tokenFigures(token, format)[2]?.tone).toBe("attention");
    expect(tokenFigures({ ...token, status: "failing", failureStreak: 2 }, format)[2]?.tone).toBe(
      "critical",
    );
    expect(
      tokenFigures({ ...token, status: "ok", failureStreak: 0 }, format)[2]?.tone,
    ).toBeUndefined();
  });
});

describe("listing figures", () => {
  it("shows the drift found, worded for a dry run", () => {
    const run = { mode: "live", finishedAt: T, checked: 80, drift: 5, failed: 1 } as const;
    expect(listingFigures(run, format, NOW).map((f) => f.value)).toEqual([`@${T}`, "80", "5", "1"]);
    expect(listingFigures(run, format, NOW)[2]?.label).toBe("Drift corrected");
    expect(listingFigures({ ...run, mode: "dry_run" }, format, NOW)[2]?.label).toBe(
      "Drift it would correct",
    );
    expect(listingFigures(null, format, NOW)[2]?.value).toBe("—");
  });
});

describe("outbound figures", () => {
  const outbound = { depth: 7, oldestPendingAt: T, deadLettered: 2 };

  it("shows depth, the oldest waiting write and a link to the failed list", () => {
    const figures = outboundFigures(outbound, format, "https://bid.example/admin/failed-jobs", NOW);
    expect(figures.map((f) => f.value)).toEqual(["7", `@${T}`, "2"]);
    expect(figures[2]?.href).toBe("https://bid.example/admin/failed-jobs");
  });

  it("says where failed writes wait when there is no link, and has no link to draw", () => {
    const failed = outboundFigures(outbound, format, null, NOW)[2];
    expect(failed?.href).toBeUndefined();
    expect(failed?.hint).toContain("Failed jobs");
  });

  it("says nothing is waiting and nothing gave up", () => {
    const figures = outboundFigures(
      { depth: 0, oldestPendingAt: null, deadLettered: 0 },
      format,
      "x",
      NOW,
    );
    expect(figures[1]).toMatchObject({ value: "—", hint: "Nothing is waiting" });
    expect(figures[2]).toMatchObject({ value: "0", hint: "Nothing has given up" });
    expect(figures[2]?.href).toBeUndefined();
  });
});

describe("token", () => {
  const token: AdminZohoSyncHealth["token"] = {
    status: "ok",
    refreshedAt: T,
    expiresAt: null,
    failureStreak: 1,
    lastFailureAt: T,
  };

  it("shows the last good refresh, expiry and failures in a row", () => {
    expect(tokenFigures(token, format).map((f) => f.value)).toEqual([`@${T}`, "—", "1"]);
    expect(tokenFigures(token, format)[2]?.hint).toBe(`Last failed @${T}`);
  });

  it("has no notice when it is fine, a warning when it is slipping and a danger when failing", () => {
    expect(tokenNotice("ok")).toBeNull();
    expect(tokenNotice("unknown")).toBeNull();
    expect(tokenNotice("warning")?.tone).toBe("warning");
    expect(tokenNotice("failing")?.tone).toBe("danger");
    expect(tokenNotice("failing")?.description).toContain("twice in a row");
  });
});

describe("drift", () => {
  it("lists the three, each linking to its list only when it has rows", () => {
    const figures = driftFigures({
      registerWithoutProduct: 3,
      productsWithoutRegister: 0,
      statusMismatch: 1,
    });
    expect(figures.map((f) => f.id)).toEqual([...DRIFT_LIST_ORDER]);
    expect(figures.map((f) => f.value)).toEqual(["3", "0", "1"]);
    expect(figures[0]?.href).toBe("/from-zoho?tab=health&drift=register_without_product");
    expect(figures[1]?.href).toBeUndefined();
  });

  it("builds Sync health URLs that return to page one", () => {
    expect(syncHealthHref({})).toBe("/from-zoho?tab=health");
    expect(
      syncHealthHref({ tab: "health", drift: "status_mismatch", page: "3" }, { page: "4" }),
    ).toBe("/from-zoho?tab=health&page=4");
  });

  it("points each list at its own read model", () => {
    for (const id of DRIFT_LIST_ORDER) {
      expect(DRIFT_LISTS[id].apiPath).toMatch(/^artwork-register\/sync-health\//);
    }
  });

  it("explains why a Product is not in LAX, or that a live run would add it", () => {
    expect(leftOutReason(null, () => "x")).toBe("Would be added by a live run");
    expect(leftOutReason("missing_title", (reason) => `why:${reason}`)).toBe("why:missing_title");
  });
});
