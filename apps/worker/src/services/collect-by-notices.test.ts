import { describe, expect, it } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import {
  type CollectByGroup,
  collectByEmailsFor,
  collectByGroups,
  collectByKey,
  collectByKeyPrefix,
} from "./collect-by-notices.js";

const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" };
const lot = (over: Partial<StoredLot> = {}): StoredLot => ({
  lotId: "l-1",
  legalEntityId: "e-1",
  venueId: "v-1",
  winnerId: "u-agent",
  title: "Lowland Storm",
  lotNumber: 12,
  clearedAt: new Date("2026-11-09T10:00:00Z"),
  place: PLACE,
  freeStorageDays: null,
  ...over,
});
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

  it("uses the place's own free period, and 30 days when it has none set", () => {
    const short = lot({ freeStorageDays: 14 });
    expect(collectByGroups([short], "2026-11-16")[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-11-23",
    });
    expect(collectByGroups([lot({ freeStorageDays: null })], "2026-12-02")[0]).toMatchObject({
      kind: "lead",
    });
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
      collectByKey({ ...group, lots: [lot()] }, "u-maya"),
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
    expect(collectByKey({ ...group, lots: [lot()] }, "u-maya").startsWith(prefix)).toBe(true);
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
