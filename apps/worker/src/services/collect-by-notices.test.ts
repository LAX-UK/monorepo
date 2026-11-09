import { describe, expect, it } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { collectByEmailsFor, collectByGroups } from "./collect-by-notices.js";

const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" };
const lot = (over: Partial<StoredLot> = {}): StoredLot => ({
  lotId: "l-1",
  legalEntityId: "e-1",
  title: "Lowland Storm",
  lotNumber: 12,
  clearedAt: new Date("2026-11-09T10:00:00Z"),
  place: PLACE,
  freeStorageDays: null,
  ...over,
});
const maya = { userId: "u-maya", email: "maya@example.com", firstName: "Maya" };
const NOW = new Date("2026-12-02T09:20:00Z");

describe("which lots are reminded today", () => {
  it("picks the lots cleared on the day today's early reminder is for", () => {
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

  it("reminds on the day itself, and on no other day", () => {
    expect(collectByGroups([lot()], "2026-12-09")[0]).toMatchObject({
      kind: "day",
      collectBy: "2026-12-09",
    });
    expect(collectByGroups([lot()], "2026-12-03")).toEqual([]);
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

  it("puts one account's lots for one deadline together, and keeps accounts apart", () => {
    const groups = collectByGroups(
      [
        lot(),
        lot({ lotId: "l-2", title: "Coastal Notation", lotNumber: 14 }),
        lot({ lotId: "l-3", legalEntityId: "e-2" }),
      ],
      "2026-12-02",
    );
    expect(groups.map((g) => [g.legalEntityId, g.lots.length])).toEqual([
      ["e-1", 2],
      ["e-2", 1],
    ]);
  });

  it("counts the London day a lot cleared, not the UTC day", () => {
    // 23:30 UTC on 8 Jun is 00:30 BST on 9 Jun: it cleared on the 9th.
    const summer = lot({ clearedAt: new Date("2026-06-08T23:30:00Z") });
    expect(collectByGroups([summer], "2026-07-02")[0]).toMatchObject({
      kind: "lead",
      collectBy: "2026-07-09",
    });
  });
});

describe("the storage reminder email", () => {
  const [group] = collectByGroups(
    [lot(), lot({ lotId: "l-2", title: "Coastal Notation", lotNumber: 14 })],
    "2026-12-02",
  );

  it("names the deadline, the place and the lots, with no price", () => {
    const [email, ...rest] = collectByEmailsFor(group as never, [maya], {
      webOrigin: "https://lax.bid",
      now: NOW,
    });
    expect(rest).toEqual([]);
    expect(email).toMatchObject({
      template: "collection-collect-by",
      to: "maya@example.com",
      userId: "u-maya",
      category: "transactional",
      idempotencyKey: "collection-collect-by:lead:e-1:2026-12-09:maya@example.com",
    });
    expect(email?.vars).toMatchObject({
      userName: "Maya",
      when: "lead",
      collectByLabel: "Wed 9 Dec",
      placeName: "London Art Exchange",
      lots: ["Lot 12 · Lowland Storm", "Lot 14 · Coastal Notation"],
      bookUrl: "https://lax.bid/purchases",
    });
    expect(JSON.stringify(email)).not.toMatch(/£|price|hammer/i);
  });

  it("goes once to each address, and keys the day-of reminder apart from the early one", () => {
    const owner = { userId: "u-owner", email: "OWNER@northbank.example", firstName: "Olu" };
    const emails = collectByEmailsFor(
      group as never,
      [maya, owner, { ...maya, userId: "u-maya-2" }],
      {
        webOrigin: "https://lax.bid",
        now: NOW,
      },
    );
    expect(emails.map((e) => e.to)).toEqual(["maya@example.com", "OWNER@northbank.example"]);
    const [dayGroup] = collectByGroups([lot()], "2026-12-09");
    const [day] = collectByEmailsFor(dayGroup as never, [maya], {
      webOrigin: "https://lax.bid",
      now: NOW,
    });
    expect(day?.idempotencyKey).toBe("collection-collect-by:day:e-1:2026-12-09:maya@example.com");
  });
});
