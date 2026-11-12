import { describe, expect, it } from "vitest";
import { mapContact, previousEmails } from "./contact.category.js";
import { mapDataDownload, mapDeletionRequests } from "./requests.category.js";
import { mapSession } from "./sign-in-and-security.category.js";

const d = (day: number) => new Date(Date.UTC(2026, 0, day));

describe("email history", () => {
  it("lists each earlier address with the day it was replaced", () => {
    const history = previousEmails(
      [
        { eventType: "user.registered", email: "a@x.com", occurredAt: d(1) },
        { eventType: "user.profile_updated", email: "b@x.com", occurredAt: d(5) },
        { eventType: "user.profile_updated", email: "c@x.com", occurredAt: d(9) },
      ],
      "c@x.com",
    );
    expect(history).toEqual([
      { email: "a@x.com", changedAt: d(5).toISOString() },
      { email: "b@x.com", changedAt: d(9).toISOString() },
    ]);
  });

  it("ignores repeats of the same address and events without one", () => {
    expect(
      previousEmails(
        [
          { eventType: "user.registered", email: "a@x.com", occurredAt: d(1) },
          { eventType: "user.profile_updated", email: null, occurredAt: d(2) },
          { eventType: "user.profile_updated", email: "A@x.com", occurredAt: d(3) },
        ],
        "a@x.com",
      ),
    ).toEqual([]);
  });

  it("shows the phone only while one is held and the verification date only when kept", () => {
    const row = {
      id: "u",
      email: "a@x.com",
      emailVerified: true,
      phoneNumber: null,
      phoneNumberVerified: true,
    };
    const record = mapContact(row, [
      { eventType: "user.email_verified", email: "a@x.com", occurredAt: d(2) },
    ]);
    expect(record.phone).toBeNull();
    expect(record.phoneVerified).toBe(false);
    expect(record.emailVerifiedAt).toBe(d(2).toISOString());
    expect(mapContact({ ...row, emailVerified: false }, []).emailVerifiedAt).toBeNull();
  });
});

describe("requests", () => {
  const base = {
    id: "e",
    requestedAt: d(1),
    readyAt: null,
    expiresAt: null,
    deletedAt: null,
    updatedAt: d(9),
  };

  it("maps every export status to an outcome", () => {
    const outcome = (status: string, extra = {}) =>
      mapDataDownload({ ...base, status, ...extra }).outcome;
    expect(outcome("ready", { readyAt: d(2) })).toBe("completed");
    expect(outcome("expired", { expiresAt: d(8) })).toBe("expired");
    expect(outcome("deleted", { deletedAt: d(3) })).toBe("deleted_by_you");
    expect(outcome("failed")).toBe("failed");
    expect(outcome("collecting")).toBe("in_progress");
    expect(mapDataDownload({ ...base, status: "requested" }).completedAt).toBeNull();
  });

  it("pairs a deletion request with the cancellation after it", () => {
    const records = mapDeletionRequests([
      { id: 1, eventType: "user.deletion_requested", occurredAt: d(1) },
      { id: 2, eventType: "user.deletion_cancelled", occurredAt: d(3) },
      { id: 3, eventType: "user.deletion_requested", occurredAt: d(6) },
    ]).map((r) => r.record);
    expect(records.map((r) => r.outcome)).toEqual(["cancelled", "pending"]);
    expect(records[0]?.completedAt).toBe(d(3).toISOString());
    expect(records[1]?.completedAt).toBeNull();
  });
});

describe("sessions", () => {
  const row = {
    id: "s",
    userAgent: "Mozilla/5.0 (iPhone) AppleWebKit Version/17 Safari/604",
    ipAddress: "203.0.113.7",
    createdAt: d(1),
    expiresAt: d(8),
  };

  it("labels the device and keeps the address", () => {
    expect(mapSession(row, d(2))).toMatchObject({
      device: "Safari on iPhone",
      ipAddress: "203.0.113.7",
      approximateLocation: null,
      endedAt: null,
    });
  });

  it("adds the country, the products used and when the browser was last active", () => {
    expect(
      mapSession(
        {
          ...row,
          country: "GB",
          lastSeenAt: d(3),
          clientIds: ["lax-art-web", "lax-account-web", "lax-shop-admin"],
        },
        d(4),
      ),
    ).toMatchObject({
      country: "GB",
      products: ["LAX Account", "lax.art"],
      lastActiveAt: d(3).toISOString(),
    });
  });

  it("reports no country, products or last activity for a record made before they were kept", () => {
    expect(mapSession(row, d(2))).toMatchObject({
      country: null,
      products: [],
      lastActiveAt: null,
    });
  });

  it("shows an end only once the session has expired", () => {
    expect(mapSession(row, d(9)).endedAt).toBe(d(8).toISOString());
  });
});
