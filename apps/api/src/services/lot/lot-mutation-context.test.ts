import { describe, expect, it, vi } from "vitest";
import type {
  IBidRepository,
  ILotRepository,
  ISaleRepository,
} from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import { publishSingleLotDeps, recordLifecycle, txLot } from "./lot-mutation-context.js";
import type { LotServiceDeps } from "./lot-types.js";

function baseDeps(overrides: Partial<LotServiceDeps> = {}): LotServiceDeps {
  return {
    lotRepo: {} as ILotRepository,
    saleRepo: null,
    bids: {} as IBidRepository,
    watchlist: {} as never,
    jobScheduler: null,
    lotNotifications: null,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: null,
    enforceIndividualConnectOnPublish: false,
    db: null,
    domainEventPublisher: null,
    catalogueMediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    englishOnlyAuctions: false,
    lotLifecycleRecording: null,
    qrCodeService: null,
    telephoneBidBookingService: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("txLot", () => {
  it("throws when repoFactory is missing", () => {
    expect(() => txLot(baseDeps(), {} as never)).toThrow("lot_service_repo_factory_required");
  });

  it("uses forConnection not forTransaction", () => {
    const lotRepo = {} as ILotRepository;
    const forConnection = vi.fn().mockReturnValue({ lot: lotRepo });
    const forTransaction = vi.fn();
    const deps = baseDeps({
      repoFactory: { forConnection, forTransaction } as unknown as IRepositoryFactory,
    });
    const tx = {} as never;
    expect(txLot(deps, tx)).toBe(lotRepo);
    expect(forConnection).toHaveBeenCalledWith(tx);
    expect(forTransaction).not.toHaveBeenCalled();
  });
});

describe("recordLifecycle", () => {
  it("no-ops when db or lotLifecycleRecording missing", async () => {
    const fn = vi.fn();
    await recordLifecycle(baseDeps(), fn);
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
    await recordLifecycle(deps, fn);
    expect(db.transaction).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});

describe("publishSingleLotDeps", () => {
  it("wires db ?? null and recordLotLifecycle closure", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (cb: (tx: never) => Promise<void>) => cb({} as never)),
    };
    const deps = baseDeps({
      db: db as never,
      lotLifecycleRecording: {} as LotLifecycleRecording,
      saleRepo: {} as ISaleRepository,
    });
    const lotDeps = publishSingleLotDeps(deps);
    expect(lotDeps.db).toBe(deps.db);
    await lotDeps.recordLotLifecycle(fn);
    expect(fn).toHaveBeenCalled();
  });
});
