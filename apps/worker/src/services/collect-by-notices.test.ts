import { createCollectionCalendar } from "@auction/domain";
import { describe, expect, it } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { DEFAULT_TERMS, lotStorage, storedLot } from "../testing/stored-lot.fixture.js";
import {
  type CollectByGroup,
  collectByEmailsFor,
  collectByGroups,
  collectByKey,
  collectByKeyPrefix,
} from "./collect-by-notices.js";

const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" };
const lot = storedLot;
const maya = { userId: "u-maya", email: "maya@example.com", firstName: "Maya" };
const NOW = new Date("2026-12-02T09:20:00Z");
const config = { webOrigin: "https://lax.bid", now: NOW };

describe("which lots are reminded today", () => {
  it("picks the lots cleared a week before their deadline, from the day it falls", () => {
    // Cleared 9 Nov: deadline 9 Dec, the early reminder from 2 Dec.
    const groups = collectByGroups(
      [lot(), lot({ lotId: "l-2", clearedAt: new Date("2026-11-10T10:00:00Z") })],
      "2026-12-02",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-12-09",
      legalEntityId: "e-1",
    });
    expect(groups[0]?.lots.map((l) => l.lotId)).toEqual(["l-1"]);
  });

  it("still reminds on a later day before the deadline, for a day the sweep missed", () => {
    expect(collectByGroups([lot()], "2026-12-06")[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-12-09",
    });
  });

  it("reminds on the day itself, and not before the week or after the deadline", () => {
    expect(collectByGroups([lot()], "2026-12-09")[0]).toMatchObject({
      kind: "day",
      collectBy: "2026-12-09",
    });
    expect(collectByGroups([lot()], "2026-12-01")).toEqual([]);
    expect(collectByGroups([lot()], "2026-12-10")).toEqual([]);
  });

  it("uses the terms the lot was sold under, and 30 days for a lot won before any terms", () => {
    const short = lot({ storage: lotStorage({ pricing: { terms: DEFAULT_TERMS } }) });
    expect(collectByGroups([short], "2026-11-16")[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-11-23",
    });
    expect(collectByGroups([lot()], "2026-12-02")[0]).toMatchObject({ kind: "lead" });
  });

  it("puts one account's lots for one place and deadline together, and keeps accounts and places apart", () => {
    const groups = collectByGroups(
      [
        lot(),
        lot({ lotId: "l-2", title: "Coastal Notation", lotNumber: 14 }),
        lot({ lotId: "l-3", legalEntityId: "e-2" }),
        lot({ lotId: "l-4", venueId: "v-2", place: { ...PLACE, name: "The Mayfair Saleroom" } }),
      ],
      "2026-12-02",
    );
    expect(groups.map((g) => [g.legalEntityId, g.venueId, g.lots.length])).toEqual([
      ["e-1", "v-1", 2],
      ["e-2", "v-1", 1],
      ["e-1", "v-2", 1],
    ]);
  });

  it("counts the London day a lot cleared, not the UTC day", () => {
    // 23:30 UTC on 8 Jun is 00:30 BST on 9 Jun: it cleared on the 9th, so the deadline is 9 Jul.
    const summer = lot({ clearedAt: new Date("2026-06-08T23:30:00Z") });
    expect(collectByGroups([summer], "2026-07-09")[0]).toMatchObject({
      kind: "day",
      collectBy: "2026-07-09",
    });
  });
});

describe("a deadline on a day the place is closed", () => {
  const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "19:00",
  }));
  const calendar = createCollectionCalendar({
    hours: weekdays,
    exceptions: [],
    rules: { closeOnSaleDays: false },
  });
  // Cleared 12 Nov: 30 days on is Saturday 12 Dec, so the deadline is Monday 14 Dec.
  const cleared = new Date("2026-11-12T10:00:00Z");

  it("is reminded on the next open day, with the same date in the email", () => {
    const stored = lot({ clearedAt: cleared, storage: lotStorage({ calendar }) });
    expect(collectByGroups([stored], "2026-12-12")[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-12-14",
    });
    const [group] = collectByGroups([stored], "2026-12-14");
    expect(group).toMatchObject({ kind: "day", collectBy: "2026-12-14" });
    const [email] = collectByEmailsFor(group as CollectByGroup, [maya], config);
    expect(email?.vars).toMatchObject({ collectByLabel: "Mon 14 Dec" });
  });

  it("is not reminded on the closed day itself as the day", () => {
    expect(
      collectByGroups(
        [lot({ clearedAt: cleared, storage: lotStorage({ calendar }) })],
        "2026-12-15",
      ),
    ).toEqual([]);
  });
});

describe("how the email says to reach the place", () => {
  const groupWith = (place: StoredLot["place"]) =>
    collectByGroups([lot({ place })], "2026-12-02")[0] as CollectByGroup;

  it("gives the venue's phone with its collections email", () => {
    const [email] = collectByEmailsFor(
      groupWith({ ...PLACE, phone: " +44 20 7946 0321 ", bookingEmail: "collections@lax.example" }),
      [maya],
      config,
    );
    expect(email?.vars).toMatchObject({
      contactEmail: "collections@lax.example",
      contactPhone: "+44 20 7946 0321",
    });
  });

  it("gives the email alone when the venue has no phone, never a placeholder", () => {
    for (const phone of [null, "  "]) {
      const [email] = collectByEmailsFor(groupWith({ ...PLACE, phone }), [maya], config);
      expect(email?.vars).toMatchObject({ contactEmail: "info@thelax.art", contactPhone: null });
      expect(JSON.stringify(email)).not.toContain("800 208");
    }
  });
});

describe("the storage reminder email", () => {
  const group = collectByGroups(
    [lot(), lot({ lotId: "l-2", title: "Coastal Notation", lotNumber: 14 })],
    "2026-12-02",
  )[0] as CollectByGroup;

  it("names the deadline, the place and the lots, links to book those lots, and has no price", () => {
    const [email, ...rest] = collectByEmailsFor(group, [maya], config);
    expect(rest).toEqual([]);
    expect(email).toMatchObject({
      template: "collection-collect-by",
      to: "maya@example.com",
      userId: "u-maya",
      category: "transactional",
    });
    expect(email?.vars).toMatchObject({
      userName: "Maya",
      when: "lead",
      collectByLabel: "Wed 9 Dec",
      placeName: "London Art Exchange",
      lots: ["Lot 12 · Lowland Storm", "Lot 14 · Coastal Notation"],
      lotIds: ["l-1", "l-2"],
      bookUrl: "https://lax.bid/purchases/collect?lots=l-1,l-2",
      storagePolicyUrl: "https://lax.bid/shipping#storage",
      quoteUrl: "https://lax.bid/purchases",
    });
    expect(JSON.stringify(email)).not.toMatch(/£|price|hammer/i);
  });

  it("keys it by the person's id, never their address, and goes once to each person", () => {
    const owner = { userId: "u-owner", email: "OWNER@northbank.example", firstName: "Olu" };
    const emails = collectByEmailsFor(
      group,
      [maya, owner, { ...maya, email: "maya@elsewhere.example" }],
      config,
    );
    expect(emails.map((e) => e.userId)).toEqual(["u-maya", "u-owner"]);
    for (const email of emails) {
      expect(email.idempotencyKey).not.toMatch(/@|example/);
      expect(email.idempotencyKey).toContain(email.userId as string);
    }
  });

  it("keys the day-of reminder, another place, another deadline and another set of lots apart", () => {
    const keys = new Set([
      collectByKey(group, "u-maya"),
      collectByKey({ ...group, kind: "day" }, "u-maya"),
      collectByKey({ ...group, venueId: "v-2" }, "u-maya"),
      collectByKey({ ...group, collectBy: "2026-12-10" }, "u-maya"),
      collectByKey({ ...group, lots: group.lots.slice(0, 1) }, "u-maya"),
    ]);
    expect(keys.size).toBe(5);
  });

  it("tells an agent who is not an owner or admin only about the lots they won, and nobody about none", () => {
    const mixed = collectByGroups(
      [lot(), lot({ lotId: "l-2", winnerId: "u-other" })],
      "2026-12-02",
    )[0] as CollectByGroup;
    const agent = {
      userId: "u-agent",
      email: "agent@example.com",
      firstName: "Alex",
      wonOnly: true,
    };
    const stranger = { userId: "u-x", email: "x@example.com", firstName: "X", wonOnly: true };
    const emails = collectByEmailsFor(mixed, [maya, agent, stranger], config);
    expect(emails.map((e) => [e.userId, e.vars.lotIds])).toEqual([
      ["u-maya", ["l-1", "l-2"]],
      ["u-agent", ["l-1"]],
    ]);
  });

  it("shares a key prefix across the lot sets of one person's reminders for a deadline", () => {
    const prefix = collectByKeyPrefix(group, "u-maya");
    expect(prefix).toBe("collection-collect-by:lead:e-1:v-1:2026-12-09:u-maya:");
    expect(collectByKey(group, "u-maya").startsWith(prefix)).toBe(true);
    expect(
      collectByKey({ ...group, lots: group.lots.slice(0, 1) }, "u-maya").startsWith(prefix),
    ).toBe(true);
  });

  it("keeps the same key for the same lots in any order, so a repeat sweep sends nothing", () => {
    const reversed = { ...group, lots: [...group.lots].reverse() };
    expect(collectByKey(reversed, "u-maya")).toBe(collectByKey(group, "u-maya"));
  });

  it("links to the first twenty lots when there are more, which is all the booking page takes", () => {
    const many = Array.from({ length: 22 }, (_, n) => lot({ lotId: `l-${n}`, lotNumber: n }));
    const [big] = collectByGroups(many, "2026-12-02");
    const [email] = collectByEmailsFor(big as never, [maya], config);
    const link = (email?.vars as { bookUrl: string }).bookUrl;
    expect(link.split("lots=")[1]?.split(",")).toHaveLength(20);
  });
});

describe("the storage emails under the terms a lot was sold under", () => {
  // Cleared Mon 9 Nov; 14 days free, so collect by Mon 23 Nov; charges from Tue 24 Nov at £3 a day.
  const charged = (over: Parameters<typeof lotStorage>[0] = {}, lotOver: Partial<StoredLot> = {}) =>
    lot({
      storage: lotStorage({ ...over, pricing: { terms: DEFAULT_TERMS, ...over.pricing } }),
      ...lotOver,
    });
  const only = (lots: StoredLot[], today: string) => {
    const groups = collectByGroups(lots, today);
    expect(groups).toHaveLength(1);
    return groups[0] as CollectByGroup;
  };
  const at = (day: string) => ({ ...config, now: new Date(`${day}T10:00:00Z`) });

  it("names the rate after the day in the week-before and on-the-day reminders", () => {
    const lead = only(
      [charged(), charged({ pricing: { large: true } }, { lotId: "l-2" })],
      "2026-11-16",
    );
    expect(lead).toMatchObject({ kind: "lead", collectBy: "2026-11-23", cycle: 0 });
    const [email] = collectByEmailsFor(lead, [maya], at("2026-11-16"));
    expect(email).toMatchObject({ template: "collection-collect-by" });
    expect(email?.vars).toMatchObject({
      lotRates: [
        "Free until Mon 23 Nov, then £3 a day, plus VAT where it applies.",
        "Free until Mon 23 Nov, then £6 a day, plus VAT where it applies.",
      ],
    });
    expect(only([charged()], "2026-11-23")).toMatchObject({ kind: "day" });
  });

  it("sends 'Storage charges have started' the day after, with the running total", () => {
    const group = only([charged()], "2026-11-24");
    expect(group).toMatchObject({ kind: "started", cycle: 0, chargingOn: true });
    const [email] = collectByEmailsFor(group, [maya], at("2026-11-24"));
    expect(email).toMatchObject({
      template: "collection-storage-charges",
      idempotencyKey: expect.stringMatching(
        /^collection-storage:started:e-1:v-1:2026-11-23:0:u-maya:[0-9a-f]{12}$/,
      ),
    });
    expect(email?.vars).toMatchObject({
      kind: "started",
      chargingOn: true,
      collectByLabel: "Mon 23 Nov",
      lotTotals: ["£3.00 so far (1 day at £3 a day), plus VAT where it applies."],
    });
  });

  it("keeps 'started' due for 14 days, then a running total every 14 days", () => {
    expect(only([charged()], "2026-12-07")).toMatchObject({ kind: "started", cycle: 0 });
    expect(only([charged()], "2026-12-08")).toMatchObject({ kind: "total", cycle: 1 });
    expect(only([charged()], "2026-12-21")).toMatchObject({ kind: "total", cycle: 1 });
    const second = only([charged()], "2026-12-22");
    expect(second).toMatchObject({ kind: "total", cycle: 2 });
    const [email] = collectByEmailsFor(second, [maya], at("2026-12-22"));
    expect(email?.vars).toMatchObject({
      kind: "total",
      lotTotals: ["£87.00 so far (29 days at £3 a day), plus VAT where it applies."],
    });
    expect(collectByKeyPrefix(second, "u-maya")).not.toBe(
      collectByKeyPrefix(only([charged()], "2026-12-08"), "u-maya"),
    );
  });

  it("while charging is off, sends one email after the day without totals, and no running totals", () => {
    const off = { chargingOn: false };
    const group = only([charged(off)], "2026-11-24");
    expect(group).toMatchObject({ kind: "started", chargingOn: false });
    const [email] = collectByEmailsFor(group, [maya], at("2026-11-24"));
    expect(email?.vars).toMatchObject({ chargingOn: false, lotTotals: [null] });
    expect(JSON.stringify(email?.vars)).not.toContain("£");
    expect(collectByGroups([charged(off)], "2026-12-08")).toEqual([]);
  });

  it("sends nothing about a waived lot, before or after the day", () => {
    for (const day of ["2026-11-16", "2026-11-23", "2026-11-24", "2026-12-08"]) {
      expect(collectByGroups([charged({ pricing: { waived: true } })], day)).toEqual([]);
    }
  });

  it("sends nothing after the day for a lot that owes nothing (no rate, or the legacy terms)", () => {
    const free = { pricing: { terms: { ...DEFAULT_TERMS, standardDailyPence: 0 } } };
    expect(collectByGroups([charged(free)], "2026-11-24")).toEqual([]);
    // A lot won before any terms: 30 days free from 9 Nov, nothing after 9 Dec.
    expect(collectByGroups([lot()], "2026-12-10")).toEqual([]);
  });

  it("moves the reminders with an extension, under a new key", () => {
    const extended = charged({ pricing: { extensionDays: 7 } });
    // The day after the old deadline is now in the week before the new one.
    expect(only([extended], "2026-11-24")).toMatchObject({ kind: "lead", collectBy: "2026-11-30" });
    expect(only([extended], "2026-11-30")).toMatchObject({ kind: "day", collectBy: "2026-11-30" });
    expect(only([extended], "2026-12-01")).toMatchObject({ kind: "started" });
  });

  it("does not count the days LAX owed a courier quote", () => {
    const quote = {
      status: "quoted",
      requestedAt: new Date("2026-11-10T10:00:00Z"),
      quotedAt: new Date("2026-11-12T10:00:00Z"),
    };
    // Three days held (10 to 12 Nov): collect by Thu 26 Nov.
    expect(only([charged({ quote })], "2026-11-26")).toMatchObject({
      kind: "day",
      collectBy: "2026-11-26",
    });
  });

  it("leaves out a lot it cannot price, and says which", () => {
    const unpriced: string[] = [];
    const groups = collectByGroups(
      [charged({ calendar: undefined }), charged({}, { lotId: "l-2" })],
      "2026-11-24",
      (stored) => unpriced.push(stored.lotId),
    );
    expect(unpriced).toEqual(["l-1"]);
    expect(groups.flatMap((g) => g.lots.map((l) => l.lotId))).toEqual(["l-2"]);
  });
});
