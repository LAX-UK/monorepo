import type { ITransactionRunner } from "@auction/persistence";
import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
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

describe("txRepos", () => {
  it("throws when repoFactory is missing", () => {
    expect(() => txRepos(baseDeps(), {} as never)).toThrow("sale_service_repo_factory_required");
  });
});

describe("recordLotLifecycle", () => {
  it("no-ops when transactionRunner or lotLifecycleRecording missing", async () => {
    const fn = vi.fn();
    await recordLotLifecycle(baseDeps(), fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("runs fn inside transaction when configured", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const transactionRunner: ITransactionRunner = {
      runInTransaction: vi.fn(async (cb) => cb({} as never)),
    };
    const deps = baseDeps({
      transactionRunner,
      lotLifecycleRecording: {} as LotLifecycleRecording,
    });
    await recordLotLifecycle(deps, fn);
    expect(transactionRunner.runInTransaction).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});

describe("publishSaleEvent", () => {
  it("no-ops when domainEventSink missing", async () => {
    const publish = vi.fn();
    await publishSaleEvent(
      baseDeps({ domainEventSink: null }),
      "admin-1",
      "sale-1",
      "sale.created",
      { from_status: null },
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes sale aggregate event with exact payload", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventSink: { publish, withTx: vi.fn() } as unknown as IDomainEventSink,
    });
    await publishSaleEvent(deps, "admin-1", "sale-1", "sale.published", {
      from_status: "draft",
      to_status: "scheduled",
      lotCount: 3,
      deliveryMode: "online",
    });
    expect(publish).toHaveBeenCalledWith({
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
    const transactionRunner: ITransactionRunner = {
      runInTransaction: vi.fn(async (cb) => cb({} as never)),
    };
    const deps = baseDeps({
      transactionRunner,
      lotLifecycleRecording: {} as LotLifecycleRecording,
      repoFactory: {
        forTransaction: vi.fn(),
      } as unknown as IRepositoryFactory,
    });
    const lotDeps = buildDeps(deps);
    expect(lotDeps.transactionRunner).toBe(deps.transactionRunner);
    await lotDeps.recordLotLifecycle?.(fn);
    expect(fn).toHaveBeenCalled();
  });
});
