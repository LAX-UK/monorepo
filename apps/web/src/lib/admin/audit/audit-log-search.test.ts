import { describe, expect, it } from "vitest";
import {
  auditLogHref,
  buildAuditFilterChips,
  hasAuditLogFilters,
  parseAuditLogSearch,
} from "./audit-log-search";

describe("parseAuditLogSearch", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseAuditLogSearch({
        view: "finance",
        q: " refund ",
        actor: "u1",
        actorLabel: "Ada",
        entity: "payment",
        action: "payment.refunded",
        from: "2026-10-01",
        to: "2026-10-24",
        offset: "100",
      }),
    ).toEqual({
      view: "finance",
      q: "refund",
      actor: "u1",
      actorLabel: "Ada",
      entity: "payment",
      action: "payment.refunded",
      from: "2026-10-01",
      to: "2026-10-24",
      offset: 100,
    });
  });

  it("ignores an unknown view, malformed days and a bad offset", () => {
    const filters = parseAuditLogSearch({ view: "all", from: "yesterday", offset: "-5" });
    expect(filters).toMatchObject({ view: null, from: "", offset: 0 });
    expect(hasAuditLogFilters(filters)).toBe(false);
  });

  it("swaps a reversed date range", () => {
    expect(parseAuditLogSearch({ from: "2026-10-24", to: "2026-10-01" })).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-24",
    });
  });
});

describe("auditLogHref", () => {
  it("keeps other filters and returns to the first page", () => {
    expect(auditLogHref({ view: "people", offset: "50" }, { q: "ada" })).toBe(
      "/admin/audit?view=people&q=ada",
    );
  });

  it("drops the actor's name with the actor", () => {
    const href = auditLogHref({ actor: "u1", actorLabel: "Ada" }, { actor: null });
    expect(href).not.toContain("actor");
  });
});

describe("buildAuditFilterChips", () => {
  it("words each filter and links to the log without it", () => {
    const current = {
      q: "x",
      actor: "u1",
      actorLabel: "Ada",
      entity: "lot",
      action: "lot.created",
      from: "2026-10-01",
      to: "2026-10-24",
    };
    const chips = buildAuditFilterChips(parseAuditLogSearch(current), current);
    expect(chips.map((c) => c.label)).toEqual([
      "Search: x",
      "By Ada",
      "Entity: Lot",
      "Action: Lot created",
      "1 Oct 2026 – 24 Oct 2026",
    ]);
    expect(chips[4]?.clearHref).not.toContain("from=");
    expect(chips[4]?.clearHref).toContain("q=x");
  });
});
