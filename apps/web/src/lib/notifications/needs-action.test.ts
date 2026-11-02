import { visibleNeedsYouCounts } from "@/lib/workspace/needs-you-counts";
import type { NeedsYouResponse } from "@/lib/workspace/needs-you-read";
import { buildOrganisationHome, visibleNeedsYouTasks } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { needsActionRows, searchNeedsAction } from "./needs-action";

const ctx = {
  organisationName: "Northbank Gallery",
  now: new Date("2026-11-02T10:00:00Z"),
  actor: { role: "owner" as const },
};
const response: NeedsYouResponse = {
  kinds: ["outbid", "pay"],
  tasks: [
    {
      kind: "outbid",
      lots: [{ id: "l1", title: "Abstract in Cobalt", endsAt: new Date("2026-11-04T12:00:00Z") }],
      link: { page: "lot", id: "l1" },
    },
    {
      kind: "pay",
      purchases: [{ id: "p1", title: "Estuary at Dusk" }],
      link: { page: "purchase", id: "p1" },
    },
  ],
  counts: { bids: 1, purchases: 1 },
  truncated: false,
};

describe("needsActionRows", () => {
  it("builds the rows Home builds, in the reader's order, naming the work by its title", () => {
    const { rows, failed } = needsActionRows(response, ctx);
    expect(failed).toBe(false);
    expect(rows.map((row) => row.title)).toEqual([
      "Outbid on “Abstract in Cobalt”",
      "Pay for “Estuary at Dusk”",
    ]);
    expect(rows[1]?.action).toEqual({ label: "Pay", href: "/purchases/checkout/p1" });
  });

  it("says the reader failed rather than that nothing needs the person", () => {
    expect(needsActionRows(null, ctx)).toEqual({ rows: [], failed: true });
  });
});

describe("searchNeedsAction", () => {
  const { rows } = needsActionRows(response, ctx);

  it("keeps every row for an empty search", () => {
    expect(searchNeedsAction(rows, "  ")).toHaveLength(2);
  });

  it("keeps rows whose title or detail holds every word", () => {
    expect(searchNeedsAction(rows, "estuary").map((row) => row.key)).toEqual(["pay"]);
    expect(searchNeedsAction(rows, "cobalt bid")).toHaveLength(1);
    expect(searchNeedsAction(rows, "hockney")).toHaveLength(0);
  });
});

describe("Needs action, Home and the menu during setup", () => {
  const setup: NeedsYouResponse = {
    ...response,
    kinds: ["outbid", "pay", "documents", "payouts"],
    tasks: [
      ...response.tasks,
      { kind: "documents", link: { page: "organisation", view: "documents" } },
      { kind: "payouts", link: { page: "organisation", view: "payouts" } },
    ],
    counts: { bids: 1, purchases: 1, organisation: 2 },
  };

  it("shows the owner the same tasks in Home, the menu and Notifications", () => {
    const owner = { role: "owner" as const };
    const tasks = visibleNeedsYouTasks(setup.tasks, owner);
    const home = buildOrganisationHome(
      {
        actor: owner,
        organisation: { status: "approved", payoutsReady: false },
        unsoldLots: [],
        teamInvited: true,
      },
      [],
      null,
      { kinds: setup.kinds, tasks: setup.tasks },
    );
    const notifications = needsActionRows(setup, { ...ctx, actor: owner }).rows;
    const menu = visibleNeedsYouCounts(setup, owner);
    const total = Object.values(menu).reduce((sum, n) => sum + n, 0);

    expect(home.tasks?.map((task) => task.kind)).toEqual(["outbid", "pay"]);
    expect(notifications.map((row) => row.key)).toEqual(["outbid", "pay"]);
    expect(tasks).toHaveLength(2);
    expect(total).toBe(notifications.length);
  });

  it("keeps the setup tasks for a role that has no first steps", () => {
    const finance = { role: "finance" as const };
    expect(needsActionRows(setup, { ...ctx, actor: finance }).rows).toHaveLength(4);
    expect(visibleNeedsYouTasks(setup.tasks, finance)).toHaveLength(4);
  });
});
