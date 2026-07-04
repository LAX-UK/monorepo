import type { IVenueRepository } from "@auction/persistence/interfaces";
import type { Venue } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { applyVenueSnapshot, venueLocationSnapshot } from "./venue-snapshot.js";

const venue: Venue = {
  id: "venue-1",
  legalEntityId: "le-1",
  name: "Gallery",
  slug: null,
  status: "active",
  addressLine1: "1 High St",
  addressLine2: null,
  city: "London",
  county: null,
  postcode: "SW1A 1AA",
  country: "GB",
  mapUrl: null,
  latitude: null,
  longitude: null,
  openingHours: null,
  contactPhone: null,
  contactEmail: null,
  website: null,
  photos: [],
  capacity: null,
  accessNotes: null,
  parkingNotes: null,
  directionsNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("venueLocationSnapshot", () => {
  it("maps venue fields to sale location snapshot", () => {
    const snap = venueLocationSnapshot(venue);
    expect(snap.venueId).toBe("venue-1");
    expect(snap.locationName).toBe("Gallery");
    expect(snap.locationAddressLine1).toBe("1 High St");
    expect(snap.locationCity).toBe("London");
  });
});

describe("applyVenueSnapshot", () => {
  it("returns input unchanged when no venueId", async () => {
    const result = await applyVenueSnapshot(
      null,
      { title: "Sale" },
      {
        saleLegalEntityId: "le-1",
        snapshotAddress: true,
      },
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual({ title: "Sale" });
  });

  it("returns venue_not_found when venue missing", async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as IVenueRepository;
    const result = await applyVenueSnapshot(
      repo,
      { venueId: "missing" },
      {
        saleLegalEntityId: "le-1",
        snapshotAddress: true,
      },
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("venue_not_found");
  });

  it("returns venue_org_mismatch when entity differs", async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(venue),
    } as unknown as IVenueRepository;
    const result = await applyVenueSnapshot(
      repo,
      { venueId: "venue-1" },
      {
        saleLegalEntityId: "other-le",
        snapshotAddress: false,
      },
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("venue_org_mismatch");
  });

  it("merges location snapshot when snapshotAddress is true", async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(venue),
    } as unknown as IVenueRepository;
    const result = await applyVenueSnapshot(
      repo,
      { venueId: "venue-1" },
      {
        saleLegalEntityId: "le-1",
        snapshotAddress: true,
      },
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.locationName).toBe("Gallery");
      expect(result.value.venueId).toBe("venue-1");
    }
  });
});
