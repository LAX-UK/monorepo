import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { IOnsiteEventRepository } from "@auction/persistence/interfaces";
import type { OnsiteEvent, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { OnsiteEventSaleLinkService } from "./onsite-event-sale-link.service.js";

function mockSaleRepo(row: Pick<Sale, "id" | "title" | "deliveryMode"> | null): ISaleRepository {
  return {
    findById: vi.fn().mockResolvedValue(
      row
        ? ({
            ...row,
            description: null,
            coverImages: [],
            categoryId: null,
            allowOnlineBidsBeforeGoLive: false,
            streamUrl: null,
            locationName: null,
            locationAddress: null,
            locationMapUrl: null,
            locationAddressLine1: null,
            locationAddressLine2: null,
            locationCity: null,
            locationCounty: null,
            locationPostcode: null,
            locationCountry: null,
            status: "scheduled",
            startTime: new Date(),
            endTime: new Date(),
            previewStartTime: null,
            buyerPremiumRate: "0",
            buyerPremiumTiers: null,
            terms: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } satisfies Sale)
        : null,
    ),
    findByIds: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    countMatching: vi.fn(),
    findWithStatuses: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    countCreatedAtByDay: vi.fn(),
  };
}

function mockEventRepo(overrides: Partial<IOnsiteEventRepository> = {}): IOnsiteEventRepository {
  return {
    findBySlug: vi.fn().mockResolvedValue(null),
    findBySaleId: vi.fn().mockResolvedValue(null),
    listAdminItems: vi.fn().mockResolvedValue([]),
    listPublicUpcoming: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateCheckInDryRun: vi.fn(),
    ...overrides,
  };
}

const linkedEvent = (slug: string): OnsiteEvent => ({
  slug,
  title: "LAX 001: The First Hammer",
  startsAt: null,
  rsvpCloseAt: null,
  segmentOptions: [],
  opsEmail: null,
  micrositeUrl: null,
  venue: null,
  dressCode: null,
  arrivalNote: null,
  status: "published",
  checkInDryRun: false,
  saleId: "sale-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("OnsiteEventSaleLinkService", () => {
  describe("resolveLinkedSaleTitle", () => {
    it("returns null when saleId is null", async () => {
      const service = new OnsiteEventSaleLinkService(mockEventRepo(), mockSaleRepo(null));
      await expect(service.resolveLinkedSaleTitle(null)).resolves.toBeNull();
    });

    it("returns null when no sale repo is configured", async () => {
      const service = new OnsiteEventSaleLinkService(mockEventRepo(), null);
      await expect(service.resolveLinkedSaleTitle("sale-1")).resolves.toBeNull();
    });
  });

  describe("validateLinkedSale", () => {
    it("passes through null saleId (unlinking)", async () => {
      const service = new OnsiteEventSaleLinkService(mockEventRepo(), mockSaleRepo(null));
      await expect(service.validateLinkedSale(null)).resolves.toBeNull();
    });

    it("errors when sale repo is unavailable", async () => {
      const service = new OnsiteEventSaleLinkService(mockEventRepo(), null);
      const result = await service.validateLinkedSale("sale-1");
      expect(result?.code).toBe("sale_validation_unavailable");
    });

    it("rejects a missing sale", async () => {
      const service = new OnsiteEventSaleLinkService(mockEventRepo(), mockSaleRepo(null));
      const result = await service.validateLinkedSale("sale-missing");
      expect(result?.code).toBe("sale_not_found");
    });

    it("rejects a sale that is not onsite/hybrid", async () => {
      const service = new OnsiteEventSaleLinkService(
        mockEventRepo(),
        mockSaleRepo({ id: "sale-1", title: "Online sale", deliveryMode: "online" }),
      );
      const result = await service.validateLinkedSale("sale-1");
      expect(result?.code).toBe("sale_not_saleroom");
    });

    it("rejects a sale already linked to a different event", async () => {
      const service = new OnsiteEventSaleLinkService(
        mockEventRepo({ findBySaleId: vi.fn().mockResolvedValue(linkedEvent("lax001")) }),
        mockSaleRepo({ id: "sale-1", title: "Onsite sale", deliveryMode: "onsite" }),
      );
      const result = await service.validateLinkedSale("sale-1", "lax002");
      expect(result?.code).toBe("sale_already_linked");
    });

    it("allows an event to keep its own linked sale", async () => {
      const service = new OnsiteEventSaleLinkService(
        mockEventRepo({ findBySaleId: vi.fn().mockResolvedValue(linkedEvent("lax001")) }),
        mockSaleRepo({ id: "sale-1", title: "Onsite sale", deliveryMode: "onsite" }),
      );
      const result = await service.validateLinkedSale("sale-1", "lax001");
      expect(result).toBeNull();
    });

    it("allows a valid, unlinked onsite/hybrid sale", async () => {
      const service = new OnsiteEventSaleLinkService(
        mockEventRepo(),
        mockSaleRepo({ id: "sale-1", title: "Hybrid sale", deliveryMode: "hybrid" }),
      );
      const result = await service.validateLinkedSale("sale-1");
      expect(result).toBeNull();
    });
  });
});
