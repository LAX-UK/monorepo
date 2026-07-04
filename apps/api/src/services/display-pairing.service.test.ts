import type { IDisplayPairingRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import type { DisplayTokenIssuer } from "../lib/display-token.js";
import { DisplayPairingService } from "./display-pairing.service.js";

function createService(deps: {
  pairingRepo: Partial<IDisplayPairingRepository>;
  redisGet?: (key: string) => Promise<string | null>;
  sale?: { id: string; deliveryMode: string; status: string } | null;
}) {
  const tokenIssuer = {
    issueDeviceCode: () => ({ plainToken: "device-plain", tokenHash: "device-hash" }),
    issueDisplayToken: () => ({ plainToken: "display-plain", tokenHash: "display-hash" }),
    issueUserCode: () => "ABCD1234",
    hash: (t: string) => `hash:${t}`,
  } satisfies DisplayTokenIssuer;

  const pairingRepo = {
    insertPending: vi.fn(),
    findByDeviceCodeHash: vi.fn(),
    findPendingByUserCode: vi.fn(),
    findByDisplayTokenHash: vi.fn(),
    approve: vi.fn(),
    revoke: vi.fn(),
    markExpired: vi.fn(),
    touchLastSeen: vi.fn(),
    listForSale: vi.fn(),
    markExpiredStalePending: vi.fn(),
    purgeTerminalRows: vi.fn(),
    ...deps.pairingRepo,
  } satisfies IDisplayPairingRepository;

  const domainEventSink = {
    publish: vi.fn().mockResolvedValue(undefined),
    withTx: vi.fn(),
  };

  const service = new DisplayPairingService({
    pairingRepo,
    saleRepo: {
      findById: vi.fn().mockResolvedValue(deps.sale ?? null),
    } as never,
    tokenIssuer,
    redis: {
      get: vi.fn(deps.redisGet ?? (async () => null)),
      set: vi.fn(),
      del: vi.fn(),
    } as never,
    domainEventSink: domainEventSink as never,
  });

  return { service, pairingRepo, domainEventSink, tokenIssuer };
}

describe("DisplayPairingService.pollPairing", () => {
  it("returns expired when paired but redis token is missing", async () => {
    const { service } = createService({
      pairingRepo: {
        findByDeviceCodeHash: vi.fn().mockResolvedValue({
          id: "p1",
          status: "paired",
          saleId: "sale-1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      redisGet: async () => null,
    });

    const result = await service.pollPairing("device-code");
    expect(result).toEqual({ status: "expired" });
  });

  it("returns authorized when paired and redis token exists", async () => {
    const { service } = createService({
      pairingRepo: {
        findByDeviceCodeHash: vi.fn().mockResolvedValue({
          id: "p1",
          status: "paired",
          saleId: "sale-1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      redisGet: async () => "display-plain",
    });

    const result = await service.pollPairing("device-code");
    expect(result).toEqual({
      status: "authorized",
      displayToken: "display-plain",
      saleId: "sale-1",
    });
  });
});

describe("DisplayPairingService.approvePairing", () => {
  it("records a domain event with actorUserId", async () => {
    const approve = vi.fn().mockResolvedValue({ id: "pair-1" });
    const { service, domainEventSink } = createService({
      sale: { id: "sale-1", deliveryMode: "hybrid", status: "active" },
      pairingRepo: {
        findPendingByUserCode: vi.fn().mockResolvedValue({
          id: "pending-1",
          deviceCodeHash: "device-hash",
          userCode: "ABCD1234",
          expiresAt: new Date(Date.now() + 60_000),
        }),
        approve,
      },
    });

    const result = await service.approvePairing({
      userCode: "ABCD1234",
      saleId: "sale-1",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(domainEventSink.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "saleroom.display.paired",
        actorUserId: "staff-1",
        aggregateId: "sale-1",
      }),
    );
  });
});

describe("DisplayPairingService.cleanupStalePairings", () => {
  it("marks expired pending rows and purges terminal rows", async () => {
    const { service, pairingRepo } = createService({
      pairingRepo: {
        markExpiredStalePending: vi.fn().mockResolvedValue(3),
        purgeTerminalRows: vi.fn().mockResolvedValue(10),
      },
    });

    const result = await service.cleanupStalePairings();
    expect(result).toEqual({ expiredPending: 3, purged: 10 });
    expect(pairingRepo.markExpiredStalePending).toHaveBeenCalledOnce();
    expect(pairingRepo.purgeTerminalRows).toHaveBeenCalledOnce();
  });
});
