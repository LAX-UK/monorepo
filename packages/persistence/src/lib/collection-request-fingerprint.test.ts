import { describe, expect, it } from "vitest";
import { collectionRequestFingerprint } from "./collection-request-fingerprint.js";

const request = {
  legalEntityId: "entity-1",
  venueId: "venue-1",
  slotStart: new Date("2026-11-12T14:00:00Z"),
  lotIds: ["lot-b", "lot-a"],
  collector: {
    kind: "third_party" as const,
    name: "Sam Okoro",
    email: "sam@example.com",
    company: null,
    userId: null,
    authorisedByUserId: "user-1",
    authorisedAt: new Date("2026-11-09T10:00:00Z"),
    policyVersion: "2026-11",
  },
  bookedVia: "client" as const,
  bookedByUserId: "user-1",
  overCapacityReason: null,
};

describe("collectionRequestFingerprint", () => {
  it("is the same for the same request", () => {
    expect(collectionRequestFingerprint(request)).toBe(
      collectionRequestFingerprint({ ...request }),
    );
    expect(collectionRequestFingerprint(request)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores the order of the lots and a lot named twice", () => {
    expect(collectionRequestFingerprint({ ...request, lotIds: ["lot-a", "lot-b", "lot-a"] })).toBe(
      collectionRequestFingerprint(request),
    );
  });

  it("ignores what the server fills in", () => {
    const later = {
      ...request,
      collector: {
        ...request.collector,
        authorisedAt: new Date("2026-11-09T10:00:05Z"),
        policyVersion: "2026-12",
      },
    };
    expect(collectionRequestFingerprint(later)).toBe(collectionRequestFingerprint(request));
  });

  it.each([
    ["the time", { slotStart: new Date("2026-11-12T14:30:00Z") }],
    ["a lot", { lotIds: ["lot-a", "lot-c"] }],
    ["fewer lots", { lotIds: ["lot-a"] }],
    ["the account", { legalEntityId: "entity-2" }],
    ["the place", { venueId: "venue-2" }],
    ["who made it", { bookedByUserId: "user-2" }],
    ["how it was made", { bookedVia: "staff" as const }],
    ["the override", { overCapacityReason: "Phoned in" }],
    ["the collector's name", { collector: { ...request.collector, name: "Sam Okoro Jr" } }],
    ["the collector's email", { collector: { ...request.collector, email: null } }],
    ["the collector's company", { collector: { ...request.collector, company: "Okoro" } }],
    ["the kind of collector", { collector: { ...request.collector, kind: "member" as const } }],
  ])("changes with %s", (_name, change) => {
    expect(collectionRequestFingerprint({ ...request, ...change })).not.toBe(
      collectionRequestFingerprint(request),
    );
  });

  it("does not run two fields together", () => {
    const a = collectionRequestFingerprint({
      ...request,
      collector: { ...request.collector, name: "ab", email: "c" },
    });
    const b = collectionRequestFingerprint({
      ...request,
      collector: { ...request.collector, name: "a", email: "bc" },
    });
    expect(a).not.toBe(b);
  });
});
