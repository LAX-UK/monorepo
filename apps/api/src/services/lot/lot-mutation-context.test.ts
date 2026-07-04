import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type {
  IBidRepository,
  ILotRepository,
  ISaleRepository,
} from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
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
    adminReviewTaskRepository: null,
    transactionRunner: null,
    domainEventSink: null,
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
  it("no-ops when transactionRunner or lotLifecycleRecording missing", async () => {
    const fn = vi.fn();
    await recordLifecycle(baseDeps(), fn);
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
    await recordLifecycle(deps, fn);
    expect(transactionRunner.runInTransaction).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});

describe("publishSingleLotDeps", () => {
  it("wires transactionRunner and recordLotLifecycle closure", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const transactionRunner: ITransactionRunner = {
      runInTransaction: vi.fn(async (cb) => cb({} as never)),
    };
    const deps = baseDeps({
      transactionRunner,
      lotLifecycleRecording: {} as LotLifecycleRecording,
      saleRepo: {} as ISaleRepository,
    });
    const lotDeps = publishSingleLotDeps(deps);
    expect(lotDeps.transactionRunner).toBe(deps.transactionRunner);
    await lotDeps.recordLotLifecycle?.(fn);
    expect(fn).toHaveBeenCalled();
  });
});
