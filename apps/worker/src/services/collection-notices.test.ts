import { describe, expect, it } from "vitest";
import {
  type CollectionNoticeConfig,
  type CollectionNoticeVisit,
  collectionEmailsFor,
} from "./collection-notices.js";

const NOW = new Date("2026-11-09T11:20:00Z");
const CONFIG: CollectionNoticeConfig = {
  organizer: { email: "collections@lax.bid", name: "LAX Bid" },
  webOrigin: "https://lax.bid",
  now: NOW,
};

const maya = {
  userId: "u-maya",
  email: "maya@example.com",
  firstName: "Maya",
  name: "Maya Okafor",
};
const owner = { userId: "u-owner", email: "owner@northbank.example", firstName: "Olu" };

function visit(over: Partial<CollectionNoticeVisit> = {}): CollectionNoticeVisit {
  return {
    bookingId: "b-1",
    reference: "COL-4821",
    slotStart: new Date("2026-11-12T14:00:00Z"),
    slotEnd: new Date("2026-11-12T14:30:00Z"),
    icsSequence: 0,
    bookedVia: "client",
    collector: { kind: "self", name: "Maya Okafor", email: null },
    place: { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" },
    lots: [
      { title: "Lowland Storm", lotNumber: 12, active: true },
      { title: "Coastal Notation", lotNumber: 14, active: true },
    ],
    account: { kind: "personal", name: "Maya Okafor" },
    booker: maya,
    accountPeople: [owner],
    ...over,
  };
}

const created = {
  kind: "created",
  eventId: 7,
  noticeDeadline: new Date("2026-11-11T16:00:00Z"),
} as const;

describe("a booking made", () => {
  it("emails the person who booked, with the visit and a calendar entry that adds it", () => {
    const [email, ...rest] = collectionEmailsFor(created, visit(), CONFIG);
    expect(rest).toEqual([]);
    expect(email).toMatchObject({
      template: "collection-booked",
      to: "maya@example.com",
      userId: "u-maya",
      category: "transactional",
      idempotencyKey: "collection-created:7:maya@example.com",
    });
    const vars = email?.vars as Record<string, unknown>;
    expect(vars).toMatchObject({
      userName: "Maya",
      reference: "COL-4821",
      whenLabel: "Thu 12 Nov, 14:00–14:30 GMT",
      changeUntilLabel: "Wed 11 Nov, 16:00 GMT",
      lots: ["Lot 12 · Lowland Storm", "Lot 14 · Coastal Notation"],
      collectorIsOther: false,
      bookingUrl: "https://lax.bid/purchases",
    });
    const calendar = vars.calendar as { method: string; content: string; filename: string };
    expect(calendar.method).toBe("REQUEST");
    expect(calendar.filename).toBe("collection-COL-4821.ics");
    expect(calendar.content).toContain("METHOD:REQUEST");
    expect(calendar.content).toContain('ORGANIZER;CN="LAX Bid":mailto:collections@lax.bid');
    expect(calendar.content).toContain("mailto:maya@example.com");
    expect(calendar.content).toContain("UID:COL-4821@lax.bid");
  });

  it("still sends the email when the calendar format refuses an address, just without the entry", () => {
    const [email] = collectionEmailsFor(
      created,
      visit({ booker: { ...maya, email: "not an address" } }),
      CONFIG,
    );
    expect(email?.template).toBe("collection-booked");
    expect((email?.vars as { calendar?: unknown }).calendar).toBeNull();
  });

  it("never puts a price in anything it builds", () => {
    const text = JSON.stringify(collectionEmailsFor(created, visit(), CONFIG));
    expect(text).not.toMatch(/£|price|premium|hammer|invoice/i);
  });

  it("tells the person named to collect, with their own calendar entry and no link into the account", () => {
    const emails = collectionEmailsFor(
      created,
      visit({ collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" } }),
      CONFIG,
    );
    expect(emails.map((e) => e.template)).toEqual([
      "collection-booked",
      "collection-collector-notice",
    ]);
    const notice = emails[1];
    expect(notice).toMatchObject({
      to: "sam@example.com",
      recipientResolution: "snapshot",
      idempotencyKey: "collection-created:7:sam@example.com",
    });
    expect(notice?.userId).toBeUndefined();
    const vars = notice?.vars as Record<string, unknown>;
    expect(vars).toMatchObject({
      collectorName: "Sam Okoro",
      onBehalfOf: "Maya Okafor",
      bookedBy: null,
      lots: ["Lowland Storm", "Coastal Notation"],
    });
    expect(JSON.stringify(vars)).not.toContain("bookingUrl");
    expect((vars.calendar as { content: string }).content).toContain("mailto:sam@example.com");
    expect(emails[0]?.vars).toMatchObject({ collectorIsOther: true, collectorName: "Sam Okoro" });
  });

  it("names the organisation that authorised a collector, and the member who booked, for an organisation's booking", () => {
    const emails = collectionEmailsFor(
      created,
      visit({
        account: { kind: "organisation", name: "Northbank Ltd" },
        booker: { ...maya, name: "Jane Hart", firstName: "Jane" },
        collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
      }),
      CONFIG,
    );
    expect(emails[1]?.vars).toMatchObject({ onBehalfOf: "Northbank Ltd", bookedBy: "Jane Hart" });
  });

  it("names only the organisation when the member who booked has left", () => {
    const emails = collectionEmailsFor(
      {
        kind: "changed",
        eventId: 9,
        previousSlotStart: new Date("2026-11-10T10:00:00Z"),
        noticeDeadline: null,
      },
      visit({
        account: { kind: "organisation", name: "Northbank Ltd" },
        booker: null,
        collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
      }),
      CONFIG,
    );
    const notice = emails.find((e) => e.to === "sam@example.com");
    expect(notice?.vars).toMatchObject({ onBehalfOf: "Northbank Ltd", bookedBy: null });
  });

  it("names the person for a personal booking", () => {
    const [, notice] = collectionEmailsFor(
      created,
      visit({ collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" } }),
      CONFIG,
    );
    expect(notice?.vars).toMatchObject({ onBehalfOf: "Maya Okafor", bookedBy: null });
  });

  it("sends a collector with no address nothing, and one email only if they share the buyer's", () => {
    expect(
      collectionEmailsFor(
        created,
        visit({ collector: { kind: "third_party", name: "Sam Okoro", email: null } }),
        CONFIG,
      ),
    ).toHaveLength(1);
    expect(
      collectionEmailsFor(
        created,
        visit({
          collector: { kind: "third_party", name: "Maya Again", email: "Maya@Example.com" },
        }),
        CONFIG,
      ),
    ).toHaveLength(1);
  });

  it("goes to the account's owners and admins when the desk booked it, never to the staff member", () => {
    const emails = collectionEmailsFor(
      created,
      visit({ bookedVia: "staff", booker: { ...maya, email: "staff@lax.bid", name: "Staff" } }),
      CONFIG,
    );
    expect(emails.map((e) => e.to)).toEqual(["owner@northbank.example"]);
    expect(
      collectionEmailsFor(created, visit({ bookedVia: "staff", accountPeople: [] }), CONFIG),
    ).toEqual([]);
  });

  it("goes to the account's owners and admins when the booker has left", () => {
    expect(collectionEmailsFor(created, visit({ booker: null }), CONFIG).map((e) => e.to)).toEqual([
      "owner@northbank.example",
    ]);
  });
});

describe("a booking changed", () => {
  it("says what it moved from, and updates the same calendar entry with the next sequence", () => {
    const [email] = collectionEmailsFor(
      {
        kind: "changed",
        eventId: 9,
        previousSlotStart: new Date("2026-11-10T10:00:00Z"),
        noticeDeadline: null,
      },
      visit({ icsSequence: 1 }),
      CONFIG,
    );
    expect(email).toMatchObject({
      template: "collection-changed",
      idempotencyKey: "collection-changed:9:maya@example.com",
    });
    const vars = email?.vars as Record<string, unknown>;
    expect(vars.previousWhenLabel).toBe("Tue 10 Nov, 10:00 GMT");
    expect(vars.changeUntilLabel).toBeUndefined();
    const calendar = vars.calendar as { content: string };
    expect(calendar.content).toContain("SEQUENCE:1");
    expect(calendar.content).toContain("UID:COL-4821@lax.bid");
  });
});

describe("a booking cancelled", () => {
  const cancelled = (over: Record<string, unknown> = {}) =>
    ({ kind: "cancelled", eventId: 11, cancelledVia: "client", ...over }) as const;
  const ended = visit({
    icsSequence: 2,
    lots: [
      { title: "Lowland Storm", lotNumber: 12, active: false },
      { title: "Coastal Notation", lotNumber: 14, active: false },
    ],
  });

  it("confirms to the buyer who cancelled, with a calendar entry that removes the visit", () => {
    const [email] = collectionEmailsFor(cancelled(), ended, CONFIG);
    expect(email).toMatchObject({ template: "collection-cancelled" });
    const vars = email?.vars as Record<string, unknown>;
    expect(vars).toMatchObject({
      cancelledBy: "buyer",
      dayLabel: "Thu 12 Nov",
      lots: ["Lot 12 · Lowland Storm", "Lot 14 · Coastal Notation"],
    });
    const calendar = vars.calendar as { method: string; content: string };
    expect(calendar.method).toBe("CANCEL");
    expect(calendar.content).toContain("METHOD:CANCEL");
    expect(calendar.content).toContain("STATUS:CANCELLED");
  });

  it("gives the gallery's reason when staff cancelled because the hours or a closure changed", () => {
    const reasons = ["hours_changed", "closure_added", "opening_removed"] as const;
    const texts = reasons.map((reason) => {
      const [email] = collectionEmailsFor(
        cancelled({ cancelledVia: "staff", reason }),
        ended,
        CONFIG,
      );
      const vars = email?.vars as Record<string, unknown>;
      expect(vars.cancelledBy).toBe("gallery");
      return vars.reasonText;
    });
    expect(texts).toEqual([
      "our opening hours have changed",
      "we're closed that day",
      "we're no longer open that day",
    ]);
  });

  it("tells the account's owners when the person who booked erased their account", () => {
    const emails = collectionEmailsFor(
      cancelled({ cancelledVia: "system", reason: "account_erased" }),
      { ...ended, booker: null },
      CONFIG,
    );
    expect(emails.map((e) => [e.to, (e.vars as { cancelledBy: string }).cancelledBy])).toEqual([
      ["owner@northbank.example", "account"],
    ]);
  });

  it("says nothing when an erased person's personal account has nobody left to tell", () => {
    expect(
      collectionEmailsFor(
        cancelled({ cancelledVia: "system", reason: "account_erased" }),
        { ...ended, booker: null, accountPeople: [] },
        CONFIG,
      ),
    ).toEqual([]);
  });

  it("tells the person named to collect that they need not come", () => {
    const emails = collectionEmailsFor(
      cancelled(),
      {
        ...ended,
        collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
      },
      CONFIG,
    );
    const forCollector = emails.find((e) => e.to === "sam@example.com");
    expect(forCollector).toMatchObject({ template: "collection-cancelled" });
    expect(forCollector?.vars).toMatchObject({
      forCollector: { onBehalfOf: "Maya Okafor" },
      lots: ["Lowland Storm", "Coastal Notation"],
    });
  });
});

describe("the day-before reminder", () => {
  it("goes to the buyer, keyed by the visit and its time so a moved visit is reminded again", () => {
    const [email, ...rest] = collectionEmailsFor({ kind: "reminder" }, visit(), CONFIG);
    expect(rest).toEqual([]);
    expect(email).toMatchObject({
      template: "collection-reminder",
      idempotencyKey: "collection-reminder:b-1:2026-11-12T14:00:00.000Z:maya@example.com",
    });
    expect(email?.vars).toMatchObject({ timeLabel: "14:00 GMT" });
    expect((email?.vars as { calendar?: unknown }).calendar).toBeUndefined();
    const moved = collectionEmailsFor(
      { kind: "reminder" },
      visit({
        slotStart: new Date("2026-11-13T10:00:00Z"),
        slotEnd: new Date("2026-11-13T10:30:00Z"),
      }),
      CONFIG,
    );
    expect(moved[0]?.idempotencyKey).not.toBe(email?.idempotencyKey);
  });

  it("is not sent again to the person collecting", () => {
    const emails = collectionEmailsFor(
      { kind: "reminder" },
      visit({ collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" } }),
      CONFIG,
    );
    expect(emails.map((e) => e.to)).toEqual(["maya@example.com"]);
  });

  it("reads BST in summer", () => {
    const [email] = collectionEmailsFor(
      { kind: "reminder" },
      visit({
        slotStart: new Date("2026-07-10T09:00:00Z"),
        slotEnd: new Date("2026-07-10T09:30:00Z"),
      }),
      { ...CONFIG, now: new Date("2026-07-09T08:00:00Z") },
    );
    expect(email?.vars).toMatchObject({
      timeLabel: "10:00 BST",
      whenLabel: "Fri 10 Jul, 10:00–10:30 BST",
    });
  });
});
