import { formatCollectionDay, formatCollectionVisit, formatCollectionWhen } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { collectionInAppNoticesFor } from "./collection-in-app-notices.js";
import { type CollectionNoticeVisit, collectionEmailsFor } from "./collection-notices.js";

const NOW = new Date("2026-11-09T11:20:00Z");
const maya = {
  userId: "u-maya",
  email: "maya@example.com",
  firstName: "Maya",
  name: "Maya Okafor",
};
const owner = { userId: "u-owner", email: "owner@northbank.example", firstName: "Olu" };
const admin = { userId: "u-admin", email: "admin@northbank.example", firstName: "Ade" };

function visit(over: Partial<CollectionNoticeVisit> = {}): CollectionNoticeVisit {
  return {
    bookingId: "b-1",
    reference: "COL-4821",
    slotStart: new Date("2026-11-12T14:00:00Z"),
    slotEnd: new Date("2026-11-12T14:30:00Z"),
    icsSequence: 0,
    bookedVia: "client",
    collector: { kind: "third_party", name: "Sam Okoro", email: "sam@example.com" },
    place: { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" },
    lots: [{ title: "Lowland Storm", lotNumber: 12, active: true }],
    account: { id: "le-northbank", kind: "organisation", name: "Northbank Ltd" },
    booker: maya,
    accountPeople: [owner, admin],
    ...over,
  };
}

const when = formatCollectionVisit(
  new Date("2026-11-12T14:00:00Z"),
  new Date("2026-11-12T14:30:00Z"),
  NOW,
);

describe("collection inbox notices", () => {
  it("tells the person who booked, about the account it was booked for, never the named collector", () => {
    const rows = collectionInAppNoticesFor(
      { kind: "created", eventId: 7, noticeDeadline: null },
      visit(),
      NOW,
    );
    expect(rows).toEqual([
      {
        userId: "u-maya",
        legalEntityId: "le-northbank",
        type: "collection_booked",
        title: "Collection booked",
        message: `${when} at London Art Exchange. Reference COL-4821.`,
      },
    ]);
  });

  it("goes to the same people as the buyer's email: the owners and admins when the desk booked it", () => {
    const change = { kind: "created", eventId: 7, noticeDeadline: null } as const;
    const v = visit({ bookedVia: "staff" });
    const emailed = collectionEmailsFor(change, v, {
      organizer: { email: "collections@lax.bid", name: "LAX Bid" },
      webOrigin: "https://lax.bid",
      now: NOW,
    })
      .filter((email) => email.template === "collection-booked")
      .map((email) => email.userId);
    expect(collectionInAppNoticesFor(change, v, NOW).map((row) => row.userId)).toEqual(emailed);
    expect(emailed).toEqual(["u-owner", "u-admin"]);
  });

  it("says where a changed visit moved from, in the emails' date style", () => {
    const previous = new Date("2026-11-10T10:00:00Z");
    const [row] = collectionInAppNoticesFor(
      { kind: "changed", eventId: 9, previousSlotStart: previous, noticeDeadline: null },
      visit(),
      NOW,
    );
    expect(row).toMatchObject({ type: "collection_changed", title: "Collection changed" });
    expect(row?.message).toBe(
      `Now ${when} at London Art Exchange, moved from ${formatCollectionWhen(previous, NOW)}. Reference COL-4821.`,
    );
  });

  it("words a cancellation by who ended it", () => {
    const day = formatCollectionDay(new Date("2026-11-12T14:00:00Z"), NOW);
    const message = (
      cancelledVia: "client" | "staff" | "system",
      reason?: "closure_added" | "account_erased",
    ) =>
      collectionInAppNoticesFor(
        { kind: "cancelled", eventId: 3, cancelledVia, reason },
        visit({ booker: null }),
        NOW,
      )[0]?.message;
    expect(message("client")).toBe(
      `Your collection on ${day} is cancelled. Your lots stay with us until you book again. Reference COL-4821.`,
    );
    expect(message("staff", "closure_added")).toBe(
      `Your collection on ${day} is cancelled. We're closed that day. We're sorry for the change. You can book another time. Reference COL-4821.`,
    );
    expect(message("system", "account_erased")).toContain(
      "The person who booked it has left this account.",
    );
  });

  it("reminds the day before, and writes nothing for a hand-over or a missed visit", () => {
    const [reminder] = collectionInAppNoticesFor({ kind: "reminder" }, visit(), NOW);
    expect(reminder).toMatchObject({
      type: "collection_reminder",
      title: "Your collection is tomorrow",
    });
    expect(collectionInAppNoticesFor({ kind: "collected", eventId: 1 }, visit(), NOW)).toEqual([]);
    expect(collectionInAppNoticesFor({ kind: "missed", eventId: 1 }, visit(), NOW)).toEqual([]);
  });

  it("writes one notice per person when the booker is also an owner", () => {
    const rows = collectionInAppNoticesFor(
      { kind: "created", eventId: 7, noticeDeadline: null },
      visit({ bookedVia: "staff", accountPeople: [owner, owner] }),
      NOW,
    );
    expect(rows.map((row) => row.userId)).toEqual(["u-owner"]);
  });
});
