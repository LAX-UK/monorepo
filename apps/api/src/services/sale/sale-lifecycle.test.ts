import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ILotRepository, ISaleRepository } from "../interfaces/repositories.js";
import { cancelSale } from "./sale-lifecycle.js";
import { publishSaleEvent } from "./sale-mutation-context.js";
import type { SaleServiceDeps } from "./sale-types.js";

function baseDeps(overrides: Partial<SaleServiceDeps> = {}): SaleServiceDeps {
  return {
    saleRepo: {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ISaleRepository,
    lotRepo: {
      findBySaleId: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository,
    jobScheduler: { cancelLotJobs: vi.fn() } as never,
    resolvePlatformCatalogLegalEntityId: vi.fn(),
    imageCleanup: undefined,
    saleFollowReader: null,
    mediaUrlResolver: undefined,
    catalogueMediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    englishOnlyAuctions: false,
    transactionRunner: null,
    domainEventPublisher: null,
    domainEventSink: null,
    lotLifecycleRecording: null,
    legalEntityRepository: null,
    venueRepository: null,
    enforceIndividualConnectOnPublish: false,
    qrCodeService: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("cancelSale event payload", () => {
  it("uses pre-cancel sale status in from_status", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const sale = {
      id: "sale-1",
      status: "scheduled" as const,
    };
    const deps = baseDeps({
      saleRepo: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(sale)
          .mockResolvedValueOnce({ ...sale, status: "cancelled" }),
        updateStatus: vi.fn(),
      } as unknown as ISaleRepository,
      lotRepo: {
        findBySaleId: vi.fn().mockResolvedValue([]),
      } as unknown as ILotRepository,
      transactionRunner: {
        runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
      } as never,
      domainEventSink: { publish, withTx: vi.fn() } as unknown as IDomainEventSink,
    });

    const result = await cancelSale(deps, "admin-1", "staff", "sale-1", "super_admin");
    expect(result.isOk()).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "sale.cancelled",
        payload: {
          from_status: "scheduled",
          to_status: "cancelled",
          lotCount: 0,
        },
      }),
    );
  });
});

describe("publishSaleEvent via lifecycle", () => {
  it("sale.unpublished payload has from_status scheduled and to_status draft", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    await publishSaleEvent({} as SaleServiceDeps, "u1", "s1", "sale.unpublished", {
      from_status: "scheduled",
      to_status: "draft",
    });
    // Direct call to verify shape (lifecycle uses same helper)
    const deps = baseDeps({
      domainEventSink: { publish, withTx: vi.fn() } as unknown as IDomainEventSink,
    });
    await publishSaleEvent(deps, "u1", "s1", "sale.unpublished", {
      from_status: "scheduled",
      to_status: "draft",
    });
    expect(publish.mock.calls[0]?.[0]?.payload).toEqual({
      from_status: "scheduled",
      to_status: "draft",
    });
  });
});
