import { describe, expect, it } from "vitest";
import {
  HOME_SECTION_ORDER,
  HOME_STATE_WINDOWS,
  type HomeSaleFacts,
  type HomeViewer,
  homeStates,
  pruneEmptyHomeSections,
  resolveHomeState,
  resolveHomeViewerSwaps,
} from "./home-state.js";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

function sale(id: string, status: HomeSaleFacts["status"], start: Date, end: Date): HomeSaleFacts {
  return { id, status, startTime: start, endTime: end };
}
const live = (id: string, closesIn: number) => sale(id, "active", at(-DAY), at(closesIn));
const scheduled = (id: string, opensIn: number) =>
  sale(id, "scheduled", at(opensIn), at(opensIn + 2 * DAY));
const ended = (id: string, endedAgo: number) =>
  sale(id, "ended", at(-endedAgo - 2 * DAY), at(-endedAgo));

const resolve = (
  sales: HomeSaleFacts[],
  extra: Partial<Parameters<typeof resolveHomeState>[0]> = {},
) => resolveHomeState({ sales, now: NOW, ...extra });

describe("window table", () => {
  it("holds the approved windows", () => {
    expect(HOME_STATE_WINDOWS).toEqual({
      justEndedHours: 72,
      upcomingDays: 60,
      recentResultsDays: 90,
      resultsBandDays: 365,
    });
  });

  it("lists sections for every state", () => {
    for (const state of homeStates) expect(HOME_SECTION_ORDER[state].length).toBeGreaterThan(0);
  });
});

describe("live", () => {
  it("leads with the soonest close", () => {
    const r = resolve([live("late", 5 * DAY), live("soon", DAY), scheduled("next", 3 * DAY)]);
    expect(r.state).toBe("live");
    expect(r.leadSaleId).toBe("soon");
    expect(r.sections).toEqual(HOME_SECTION_ORDER.live);
  });

  it("lets a staff pin win over a sooner close", () => {
    const r = resolve([live("late", 5 * DAY), live("soon", DAY)], { pinnedSaleIds: ["late"] });
    expect(r.leadSaleId).toBe("late");
  });

  it("ignores a pin on a sale that is not live", () => {
    const r = resolve([live("soon", DAY), scheduled("next", DAY)], { pinnedSaleIds: ["next"] });
    expect(r.leadSaleId).toBe("soon");
  });

  it("beats a sale that just ended", () => {
    expect(resolve([live("a", DAY), ended("b", HOUR)]).state).toBe("live");
  });

  it("breaks a tie on close time by id", () => {
    expect(resolve([live("b", DAY), live("a", DAY)]).leadSaleId).toBe("a");
  });
});

describe("just ended (72h)", () => {
  it("applies at exactly 72 hours", () => {
    const r = resolve([ended("a", 72 * HOUR)]);
    expect(r.state).toBe("justEnded");
    expect(r.leadSaleId).toBe("a");
    expect(r.sections).toEqual(HOME_SECTION_ORDER.justEnded);
  });

  it("falls to recent results one millisecond later", () => {
    expect(resolve([ended("a", 72 * HOUR + 1)]).state).toBe("recentResults");
  });

  it("beats an upcoming sale", () => {
    expect(resolve([ended("a", HOUR), scheduled("b", DAY)]).state).toBe("justEnded");
  });

  it("keeps the upcoming sale in the coming-up list", () => {
    expect(resolve([ended("a", HOUR), scheduled("b", DAY)]).comingUpSaleIds).toEqual(["b"]);
  });

  it("treats an end time slightly in the future as just ended", () => {
    expect(resolve([sale("a", "ended", at(-DAY), at(HOUR))]).state).toBe("justEnded");
  });
});

describe("upcoming (60d)", () => {
  it("applies when a sale opens at exactly 60 days", () => {
    const r = resolve([scheduled("a", 60 * DAY)]);
    expect(r.state).toBe("upcoming");
    expect(r.leadSaleId).toBe("a");
    expect(r.sections).toEqual(HOME_SECTION_ORDER.upcoming);
  });

  it("does not apply one millisecond past 60 days", () => {
    const r = resolve([scheduled("a", 60 * DAY + 1)]);
    expect(r.state).toBe("betweenSeasons");
    expect(r.comingUpSaleIds).toEqual(["a"]);
  });

  it("leads with the soonest opening", () => {
    const r = resolve([scheduled("far", 40 * DAY), scheduled("near", 9 * DAY)]);
    expect(r.leadSaleId).toBe("near");
    expect(r.comingUpSaleIds).toEqual(["near", "far"]);
  });

  it("beats recent results", () => {
    expect(resolve([ended("a", 10 * DAY), scheduled("b", 5 * DAY)]).state).toBe("upcoming");
  });

  it("ignores drafts and cancelled sales", () => {
    const r = resolve([
      sale("d", "draft", at(DAY), at(2 * DAY)),
      sale("c", "cancelled", at(DAY), at(2 * DAY)),
    ]);
    expect(r.state).toBe("betweenSeasons");
    expect(r.leadSaleId).toBeNull();
  });
});

describe("recent results (90d)", () => {
  it("applies at exactly 90 days", () => {
    const r = resolve([ended("a", 90 * DAY)]);
    expect(r.state).toBe("recentResults");
    expect(r.sections).toEqual(HOME_SECTION_ORDER.recentResults);
  });

  it("falls to between seasons one millisecond later, keeping the sale as lead", () => {
    const r = resolve([ended("a", 90 * DAY + 1)]);
    expect(r.state).toBe("betweenSeasons");
    expect(r.leadSaleId).toBe("a");
  });

  it("leads with the most recently ended sale", () => {
    expect(resolve([ended("old", 80 * DAY), ended("new", 20 * DAY)]).leadSaleId).toBe("new");
  });

  it("applies when the next sale is beyond 60 days", () => {
    expect(resolve([ended("a", 10 * DAY), scheduled("b", 70 * DAY)]).state).toBe("recentResults");
  });
});

describe("between seasons", () => {
  it("has no lead with no sales", () => {
    const r = resolve([]);
    expect(r.state).toBe("betweenSeasons");
    expect(r.leadSaleId).toBeNull();
    expect(r.sections).toEqual(HOME_SECTION_ORDER.betweenSeasons);
  });

  it("includes sales ended within 12 months in the results band", () => {
    const r = resolve([ended("a", 365 * DAY), ended("b", 365 * DAY + 1), ended("c", 100 * DAY)]);
    expect(r.resultsBandSaleIds).toEqual(["c", "a"]);
  });

  it("has no lead when every sale is older than the band", () => {
    expect(resolve([ended("a", 400 * DAY)]).leadSaleId).toBeNull();
  });
});

describe("custom windows", () => {
  it("uses the windows it is given", () => {
    const windows = { ...HOME_STATE_WINDOWS, justEndedHours: 1 };
    expect(resolve([ended("a", 2 * HOUR)], { windows }).state).toBe("recentResults");
  });
});

describe("viewer swaps", () => {
  const signedIn = (
    approval: "approved" | "pending" | "declined",
    alertsOn = false,
    followedArtistsInLeadSale = 0,
  ): HomeViewer => ({ signedIn: true, approval, alertsOn, followedArtistsInLeadSale });

  it("shows a visitor the register prompt and the sign-up form", () => {
    expect(resolveHomeViewerSwaps({ signedIn: false })).toEqual({
      register: "register",
      alerts: "signUp",
      followedArtistsLine: 0,
    });
    expect(resolveHomeViewerSwaps(undefined).register).toBe("register");
  });

  it("asks a pending bidder to complete approval", () => {
    expect(resolveHomeViewerSwaps(signedIn("pending")).register).toBe("completeApproval");
  });

  it.each(["approved", "declined"] as const)("shows nothing to register for when %s", (a) => {
    expect(resolveHomeViewerSwaps(signedIn(a)).register).toBe("none");
  });

  it("offers one-tap alerts, then confirms them", () => {
    expect(resolveHomeViewerSwaps(signedIn("approved", false)).alerts).toBe("getAlerts");
    expect(resolveHomeViewerSwaps(signedIn("approved", true)).alerts).toBe("alertsOn");
  });

  it("carries the followed-artist count and never goes negative", () => {
    expect(resolveHomeViewerSwaps(signedIn("approved", false, 2)).followedArtistsLine).toBe(2);
    expect(resolveHomeViewerSwaps(signedIn("approved", false, -1)).followedArtistsLine).toBe(0);
  });

  it("is returned by the resolver", () => {
    expect(resolve([], { viewer: signedIn("pending", true, 1) }).viewerSwaps).toEqual({
      register: "completeApproval",
      alerts: "alertsOn",
      followedArtistsLine: 1,
    });
  });
});

describe("pruneEmptyHomeSections", () => {
  it("drops empty sections and keeps the order", () => {
    expect(
      pruneEmptyHomeSections(HOME_SECTION_ORDER.live, (s) => s !== "comingUp" && s !== "alerts"),
    ).toEqual(["inThisSale", "recentResults", "departments", "selling"]);
  });
});
