import { describe, expect, it, vi } from "vitest";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILotRepository, ISaleRepository } from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import { publishSaleEvent, recordLotLifecycle, txRepos } from "./sale-mutation-context.js";
import type { SaleServiceDeps } from "./sale-types.js";

function baseDeps(overrides: Partial<SaleServiceDeps> = {}): SaleServiceDeps {
  return {
    saleRepo: {} as ISaleRepository,
    lotRepo: {} as ILotRepository,
    jobScheduler: null,
    resolvePlatformCatalogLegalEntityId: vi.fn(),
    imageCleanup: undefined,
    saleFollowReader: null,
    mediaUrlResolver: undefined,
    catalogueMediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    englishOnlyAuctions: false,
    db: undefined,
    domainEventPublisher: null,
    lotLifecycleRecording: null,
    legalEntityRepository: null,
    venueRepository: null,
    enforceIndividualConnectOnPublish: false,
    qrCodeService: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("txRepos", () => {
  it("throws when repoFactory is missing", () => {
    expect(() => txRepos(baseDeps(), {} as never)).toThrow("sale_service_repo_factory_required");
  });
});

describe("recordLotLifecycle", () => {
  it("no-ops when db or lotLifecycleRecording missing", async () => {
    const fn = vi.fn();
    await recordLotLifecycle(baseDeps(), fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("runs fn inside transaction when configured", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (cb: (tx: never) => Promise<void>) => cb({} as never)),
    };
    const deps = baseDeps({
      db: db as never,
      lotLifecycleRecording: {} as LotLifecycleRecording,
    });
    await recordLotLifecycle(deps, fn);
    expect(db.transaction).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});

describe("publishSaleEvent", () => {
  it("no-ops when db or domainEventPublisher missing", async () => {
    const publish = vi.fn();
    await publishSaleEvent(
      baseDeps({ domainEventPublisher: { publish } as unknown as DomainEventPublisher }),
      "admin-1",
      "sale-1",
      "sale.created",
      { from_status: null },
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes sale aggregate event with exact payload", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const db = {} as never;
    const deps = baseDeps({
      db: db as never,
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
    });
    await publishSaleEvent(deps, "admin-1", "sale-1", "sale.published", {
      from_status: "draft",
      to_status: "scheduled",
      lotCount: 3,
      deliveryMode: "online",
    });
    expect(publish).toHaveBeenCalledWith(db, {
      aggregateType: "sale",
      aggregateId: "sale-1",
      eventType: "sale.published",
      payload: {
        from_status: "draft",
        to_status: "scheduled",
        lotCount: 3,
        deliveryMode: "online",
      },
      actorUserId: "admin-1",
    });
  });
});

describe("publishSingleLotDeps", () => {
  it("wires recordLotLifecycle closure", async () => {
    const { publishSingleLotDeps: buildDeps } = await import("./sale-mutation-context.js");
    const fn = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (cb: (tx: never) => Promise<void>) => cb({} as never)),
    };
    const deps = baseDeps({
      db: db as never,
      lotLifecycleRecording: {} as LotLifecycleRecording,
      repoFactory: {
        forTransaction: vi.fn(),
      } as unknown as IRepositoryFactory,
    });
    const lotDeps = buildDeps(deps);
    expect(lotDeps.db).toBe(deps.db);
    await lotDeps.recordLotLifecycle(fn);
    expect(fn).toHaveBeenCalled();
  });
});
