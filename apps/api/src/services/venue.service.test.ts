import type { IVenueRepository } from "@auction/persistence";
import type { Venue } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { VenueError } from "../lib/errors.js";
import { VenueService } from "./venue.service.js";

const LEGAL_ENTITY_ID = "30000000-0000-4000-9000-000000000001";

function venueRow(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "venue-1",
    legalEntityId: LEGAL_ENTITY_ID,
    name: "LAX Mayfair Saleroom",
    slug: "lax-mayfair-saleroom",
    addressLine1: "12 King Street",
    addressLine2: "St James's",
    city: "London",
    county: null,
    postcode: "SW1Y 6QU",
    country: "United Kingdom",
    mapUrl: "https://maps.example.com",
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
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("VenueService.archive", () => {
  it("blocks archive when sales reference the venue", async () => {
    const venues: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(venueRow()),
      countSalesUsing: vi.fn().mockResolvedValue(2),
      archive: vi.fn(),
    } as unknown as IVenueRepository;

    const svc = new VenueService(venues);
    const result = await svc.archive("venue-1");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(VenueError);
      expect(result.error.code).toBe("venue_in_use");
    }
    expect(venues.archive).not.toHaveBeenCalled();
  });
});

describe("VenueService.create", () => {
  it("generates a slug and publishes a domain event", async () => {
    const created = venueRow({ slug: "lax-mayfair-saleroom" });
    const venues: IVenueRepository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(created),
    } as unknown as IVenueRepository;
    const publish = vi.fn().mockResolvedValue(undefined);
    const domainEventSink = {
      publish,
      withTx: vi.fn().mockReturnValue({ publish }),
    };

    const svc = new VenueService(venues, domainEventSink as never);
    const result = await svc.create(
      {
        legalEntityId: LEGAL_ENTITY_ID,
        name: "LAX Mayfair Saleroom",
        addressLine1: "12 King Street",
        city: "London",
        postcode: "SW1Y 6QU",
        country: "United Kingdom",
      },
      { actorUserId: "admin-1" },
    );

    expect(result.isOk()).toBe(true);
    expect(venues.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "lax-mayfair-saleroom" }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "venue",
        eventType: "venue.created",
      }),
    );
  });

  it("returns venue_slug_empty when the name cannot produce a slug", async () => {
    const venues: IVenueRepository = {
      findBySlug: vi.fn(),
      create: vi.fn(),
    } as unknown as IVenueRepository;

    const svc = new VenueService(venues);
    const result = await svc.create({
      legalEntityId: LEGAL_ENTITY_ID,
      name: "!!!",
      addressLine1: "12 King Street",
      city: "London",
      postcode: "SW1Y 6QU",
      country: "United Kingdom",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("venue_slug_empty");
      expect(result.error.status).toBe(400);
    }
    expect(venues.create).not.toHaveBeenCalled();
  });

  it("maps unique slug database conflicts to venue_slug_conflict", async () => {
    const pgError = new Error(
      'duplicate key value violates unique constraint "venue_legal_entity_slug_uidx"',
    );
    (pgError as Error & { code: string }).code = "23505";
    const venues: IVenueRepository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(pgError),
    } as unknown as IVenueRepository;

    const svc = new VenueService(venues);
    const result = await svc.create({
      legalEntityId: LEGAL_ENTITY_ID,
      name: "LAX Mayfair Saleroom",
      addressLine1: "12 King Street",
      city: "London",
      postcode: "SW1Y 6QU",
      country: "United Kingdom",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("venue_slug_conflict");
      expect(result.error.status).toBe(409);
    }
  });
});

describe("VenueService.update", () => {
  it("returns not found when the venue does not exist", async () => {
    const venues: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as IVenueRepository;

    const svc = new VenueService(venues);
    const result = await svc.update("missing", { name: "Renamed" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("venue_not_found");
    }
  });

  it("blocks legal entity changes when sales reference the venue", async () => {
    const venues: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(venueRow()),
      countSalesUsing: vi.fn().mockResolvedValue(1),
      update: vi.fn(),
    } as unknown as IVenueRepository;

    const svc = new VenueService(venues);
    const result = await svc.update("venue-1", {
      legalEntityId: "40000000-0000-4000-9000-000000000002",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("venue_in_use");
    }
    expect(venues.update).not.toHaveBeenCalled();
  });
});
