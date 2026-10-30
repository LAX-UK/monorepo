import { describe, expect, it } from "vitest";
import type { ActivityEntryView } from "../data/http/organisation-team.types";
import {
  activityExportHref,
  activityFiltersSearch,
  activityHrefForPerson,
  activityQueryFor,
  parseActivityFilters,
} from "./activity-filters";
import { activityDays, activityLine } from "./activity-lines";

const ORG = "Northbank Gallery";

function entry(kind: string, detail: ActivityEntryView["detail"] = {}): ActivityEntryView {
  return {
    id: 1,
    kind,
    group: "members",
    occurredAt: "2026-10-30T10:42:00Z",
    actorUserId: "u-daniel",
    subjectUserId: "u-priya",
    detail,
    actorName: "Daniel Reyes",
    subjectName: "Priya Shah",
  };
}

describe("activityLine", () => {
  it("reads each change as one sentence with the people named", () => {
    expect(
      activityLine(entry("role_changed", { from_role: "viewer", to_role: "finance" }), ORG)
        .sentence,
    ).toBe("Daniel Reyes changed Priya Shah from Viewer to Finance");
    expect(
      activityLine(entry("member_invited", { email: "sam@x.com", role: "viewer" }), ORG).sentence,
    ).toBe("Daniel Reyes invited sam@x.com as Viewer");
    expect(
      activityLine(
        entry("authorisation_granted", { sale_id: "s1", bid_limit: "10000", total_limit: "25000" }),
        ORG,
      ).sentence,
    ).toBe("Daniel Reyes authorised Priya Shah to bid in one sale, up to £10,000 a lot, £25,000 in total");
  });

  it("says the organisation limit change, set and removal", () => {
    const changed = entry("bidding_limit_changed", { previous_limit: "200000", limit: "250000" });
    expect(activityLine(changed, ORG).sentence).toBe(
      "Daniel Reyes changed Northbank Gallery's bidding limit from £200,000 to £250,000",
    );
    expect(activityLine(entry("bidding_limit_changed", { limit: null }), ORG).sentence).toBe(
      "Daniel Reyes removed Northbank Gallery's bidding limit",
    );
  });

  it("notes that a bank change was emailed to everyone running the organisation", () => {
    const line = activityLine(
      entry("bank_details_changed", { bank_name: "Barclays", bank_last4: "0042" }),
      ORG,
    );
    expect(line.sentence).toBe("Daniel Reyes changed the payout account to Barclays ending 0042");
    expect(line.note).toBe("Every owner and admin was emailed");
  });

  it("never shows a raw code for a kind it doesn't know", () => {
    expect(activityLine(entry("something_new"), ORG).sentence).toBe("Daniel Reyes made a change");
  });
});

describe("activityDays", () => {
  it("groups by London day: Today, Yesterday, then dates", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    const lines = [
      "2026-10-30T09:00:00Z",
      "2026-10-29T16:20:00Z",
      "2026-10-28T14:55:00Z",
      "2025-12-03T10:00:00Z",
    ].map((occurredAt, id) => ({ ...activityLine(entry("invoice_details_changed"), ORG), id, occurredAt }));
    expect(activityDays(lines, now).map((d) => d.label)).toEqual([
      "Today",
      "Yesterday",
      "28 Oct",
      "3 Dec 2025",
    ]);
  });
});

describe("activity filters", () => {
  it("reads the address and drops what it doesn't know", () => {
    expect(parseActivityFilters({ person: "u1", group: "money", period: "30d" })).toEqual({
      person: "u1",
      group: "money",
      period: "30d",
    });
    expect(parseActivityFilters({ group: "nope", period: "5y" })).toEqual({
      person: null,
      group: null,
      period: "12m",
    });
  });

  it("writes only what differs from the default view", () => {
    expect(activityFiltersSearch({ person: null, group: null, period: "12m" })).toBe("");
    expect(activityHrefForPerson("u-tom")).toBe("/team/activity?person=u-tom");
  });

  it("asks the API for the period's start and exports the same view", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(activityQueryFor({ person: null, group: "money", period: "30d" }, now)).toEqual({
      group: ["money"],
      from: "2026-09-30T12:00:00.000Z",
    });
    expect(activityExportHref({ person: "u1", group: null, period: "12m" }, now)).toBe(
      "/team/activity/export?person=u1",
    );
  });
});
