import { describe, expect, it } from "vitest";
import { collectorGetsOwnEmail, resolveCollector } from "./collection-collector.js";
import { COLLECTION_ID_TYPES, handOverRefusal } from "./collection-handover.js";
import { DEFAULT_COLLECT_BY_POLICY, collectBy } from "./collection-storage.js";

describe("resolveCollector", () => {
  it("accepts the buyer collecting for themselves, by the name on their ID", () => {
    expect(resolveCollector({ kind: "self", name: "Charlotte Hayes" })).toEqual({
      ok: true,
      collector: {
        kind: "self",
        name: "Charlotte Hayes",
        email: null,
        company: null,
        authorised: false,
      },
    });
  });

  it("accepts a named member of the organisation without an authorisation", () => {
    const result = resolveCollector({ kind: "member", name: "Sam Okoro" });
    expect(result).toMatchObject({ ok: true, collector: { kind: "member", authorised: false } });
  });

  it("accepts a third party the account holder has authorised, and keeps their details", () => {
    expect(
      resolveCollector({
        kind: "third_party",
        name: "  Sam   Okoro ",
        email: " sam@example.com ",
        company: " Okoro Shipping ",
        authorised: true,
      }),
    ).toEqual({
      ok: true,
      collector: {
        kind: "third_party",
        name: "Sam Okoro",
        email: "sam@example.com",
        company: "Okoro Shipping",
        authorised: true,
      },
    });
  });

  it("does not take an email or company as given when they are blank", () => {
    expect(
      resolveCollector({
        kind: "third_party",
        name: "Sam Okoro",
        email: "  ",
        company: "",
        authorised: true,
      }),
    ).toMatchObject({ ok: true, collector: { email: null, company: null } });
  });

  it("requires the name on the photo ID", () => {
    for (const name of ["", "   ", "S"]) {
      expect(resolveCollector({ kind: "self", name })).toEqual({
        ok: false,
        issues: [{ field: "name", code: "name_required" }],
      });
    }
    expect(resolveCollector({ kind: "self", name: "x".repeat(121) })).toMatchObject({ ok: false });
  });

  it("requires the authorisation for a third party", () => {
    expect(resolveCollector({ kind: "third_party", name: "Sam Okoro" })).toEqual({
      ok: false,
      issues: [{ field: "authorisation", code: "authorisation_required" }],
    });
    expect(
      resolveCollector({ kind: "third_party", name: "Sam Okoro", authorised: false }),
    ).toMatchObject({ ok: false });
  });

  it("rejects an email that does not look like one", () => {
    for (const email of ["sam", "sam@", "sam@example", "sam @example.com"]) {
      expect(
        resolveCollector({ kind: "third_party", name: "Sam Okoro", email, authorised: true }),
      ).toEqual({ ok: false, issues: [{ field: "email", code: "email_invalid" }] });
    }
  });

  it("reports every problem at once, in field order", () => {
    expect(resolveCollector({ kind: "third_party", name: "", email: "nope" })).toEqual({
      ok: false,
      issues: [
        { field: "name", code: "name_required" },
        { field: "email", code: "email_invalid" },
        { field: "authorisation", code: "authorisation_required" },
      ],
    });
  });

  it("drops a company for anyone but a third party", () => {
    expect(
      resolveCollector({ kind: "member", name: "Sam Okoro", company: "Okoro Shipping" }),
    ).toMatchObject({ collector: { company: null } });
  });
});

describe("collectorGetsOwnEmail", () => {
  it("is for a third party who gave an email", () => {
    expect(collectorGetsOwnEmail({ kind: "third_party", email: "sam@example.com" })).toBe(true);
    expect(collectorGetsOwnEmail({ kind: "third_party", email: null })).toBe(false);
    expect(collectorGetsOwnEmail({ kind: "self", email: "me@example.com" })).toBe(false);
    expect(collectorGetsOwnEmail({ kind: "member", email: "m@example.com" })).toBe(false);
  });
});

describe("handOverRefusal", () => {
  const lot = (lotId: string, released: boolean) => ({ lotId, released });

  it("allows released lots once the photo ID is checked", () => {
    expect(handOverRefusal({ lots: [lot("a", true), lot("b", true)], idChecked: true })).toBeNull();
  });

  it("waits for every ticked lot to be released", () => {
    expect(handOverRefusal({ lots: [lot("a", true), lot("b", false)], idChecked: true })).toBe(
      "not_released",
    );
  });

  it("needs the photo ID checked", () => {
    expect(handOverRefusal({ lots: [lot("a", true)], idChecked: false })).toBe("id_not_checked");
  });

  it("needs a lot", () => {
    expect(handOverRefusal({ lots: [], idChecked: true })).toBe("no_lots");
  });

  it("names a missing release before the ID check", () => {
    expect(handOverRefusal({ lots: [lot("a", false)], idChecked: false })).toBe("not_released");
  });

  it("records only the kind of ID, never a number", () => {
    expect(COLLECTION_ID_TYPES).toEqual([
      "passport",
      "driving_licence",
      "national_identity_card",
      "other_photo_id",
    ]);
  });
});

describe("collectBy", () => {
  it("is 30 days after payment cleared, with reminders 7 days before and on the day", () => {
    expect(DEFAULT_COLLECT_BY_POLICY).toEqual({ freeStorageDays: 30, reminderLeadDays: 7 });
    expect(collectBy(new Date("2026-11-08T11:20:00Z"))).toEqual({
      date: "2026-12-08",
      reminderDates: ["2026-12-01", "2026-12-08"],
    });
  });

  it("counts the London day payment cleared on, not the UTC day", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July.
    expect(collectBy(new Date("2026-06-30T23:30:00Z")).date).toBe("2026-07-31");
    expect(collectBy(new Date("2026-12-30T23:30:00Z")).date).toBe("2027-01-29");
  });

  it("follows a configured free period", () => {
    expect(
      collectBy(new Date("2026-11-08T11:20:00Z"), { freeStorageDays: 14, reminderLeadDays: 3 }),
    ).toEqual({ date: "2026-11-22", reminderDates: ["2026-11-19", "2026-11-22"] });
  });

  it("crosses a clock change without drifting a day", () => {
    expect(collectBy(new Date("2026-10-20T12:00:00Z")).date).toBe("2026-11-19");
    expect(collectBy(new Date("2026-03-10T12:00:00Z")).date).toBe("2026-04-09");
  });
});
