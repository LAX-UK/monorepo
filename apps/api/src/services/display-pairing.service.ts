import type { IDisplayPairingRepository } from "@auction/persistence";
import type { ISaleRepository } from "@auction/persistence";
import type { SaleroomDisplayDeviceRow, SaleroomDisplayPairPollResult } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import type { Redis } from "ioredis";
import { type Result, err, ok } from "neverthrow";
import type { DisplayTokenIssuer } from "../lib/display-token.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type {
  DisplayServiceError,
  IDisplayPairingService,
} from "./interfaces/display-pairing-service.js";

const PAIRING_EXPIRY_SEC = 900;
const POLL_INTERVAL_SEC = 5;
const ONLINE_THRESHOLD_MS = 90_000;
const DISPLAY_TOKEN_REDIS_TTL_SEC = 86_400;
const TERMINAL_ROW_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const displayTokenRedisKey = (deviceCodeHash: string) => `display:token:${deviceCodeHash}`;

export type DisplayPairingServiceOptions = {
  pairingRepo: IDisplayPairingRepository;
  saleRepo: ISaleRepository;
  tokenIssuer: DisplayTokenIssuer;
  redis: Redis;
  domainEventSink: IDomainEventSink;
};

export class DisplayPairingService implements IDisplayPairingService {
  private readonly pairingRepo: IDisplayPairingRepository;
  private readonly saleRepo: ISaleRepository;
  private readonly tokenIssuer: DisplayTokenIssuer;
  private readonly redis: Redis;
  private readonly domainEventSink: IDomainEventSink;

  constructor(opts: DisplayPairingServiceOptions) {
    this.pairingRepo = opts.pairingRepo;
    this.saleRepo = opts.saleRepo;
    this.tokenIssuer = opts.tokenIssuer;
    this.redis = opts.redis;
    this.domainEventSink = opts.domainEventSink;
  }

  async startPairing() {
    const device = this.tokenIssuer.issueDeviceCode();
    const userCode = this.tokenIssuer.issueUserCode();
    const expiresAt = new Date(Date.now() + PAIRING_EXPIRY_SEC * 1000);
    await this.pairingRepo.insertPending({
      deviceCodeHash: device.tokenHash,
      userCode,
      expiresAt,
    });
    return {
      deviceCode: device.plainToken,
      userCode,
      expiresIn: PAIRING_EXPIRY_SEC,
      interval: POLL_INTERVAL_SEC,
    };
  }

  async pollPairing(deviceCode: string): Promise<SaleroomDisplayPairPollResult> {
    const hash = this.tokenIssuer.hash(deviceCode);
    const row = await this.pairingRepo.findByDeviceCodeHash(hash);
    if (!row) {
      return { status: "expired" };
    }
    if (row.status === "expired" || row.status === "revoked") {
      return { status: "expired" };
    }
    if (row.expiresAt.getTime() <= Date.now() && row.status === "pending") {
      await this.pairingRepo.markExpired(row.id);
      return { status: "expired" };
    }
    if (row.status === "paired" && row.saleId) {
      const plainToken = await this.redis.get(displayTokenRedisKey(hash));
      if (plainToken) {
        return {
          status: "authorized",
          displayToken: plainToken,
          saleId: row.saleId,
        };
      }
      return { status: "expired" };
    }
    if (row.status === "pending") {
      return { status: "authorization_pending" };
    }
    return { status: "authorization_pending" };
  }

  async approvePairing(input: {
    userCode: string;
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ pairingId: string }, DisplayServiceError>> {
    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) return err({ message: "Sale not found", status: 404 });
    if (!isSaleroomDeliveryMode(sale.deliveryMode)) {
      return err({
        message: "Display pairing is only available for onsite and hybrid sales",
        status: 400,
        code: "invalid_delivery_mode",
      });
    }

    const pending = await this.pairingRepo.findPendingByUserCode(input.userCode);
    if (!pending) {
      return err({
        message: "Pairing code not found or already used",
        status: 404,
        code: "pairing_not_found",
      });
    }
    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.pairingRepo.markExpired(pending.id);
      return err({ message: "Pairing code expired", status: 400, code: "pairing_expired" });
    }

    const displayToken = this.tokenIssuer.issueDisplayToken();
    const approved = await this.pairingRepo.approve({
      pairingId: pending.id,
      saleId: input.saleId,
      displayTokenHash: displayToken.tokenHash,
      approvedByUserId: input.actorUserId,
      pairedAt: new Date(),
    });
    if (!approved) {
      return err({ message: "Could not approve pairing", status: 409, code: "pairing_conflict" });
    }

    await this.redis.set(
      displayTokenRedisKey(pending.deviceCodeHash),
      displayToken.plainToken,
      "EX",
      DISPLAY_TOKEN_REDIS_TTL_SEC,
    );

    await this.domainEventSink.publish({
      aggregateType: "sale",
      aggregateId: input.saleId,
      eventType: "saleroom.display.paired",
      payload: { pairingId: approved.id, userCode: pending.userCode },
      actorUserId: input.actorUserId,
    });

    return ok({ pairingId: approved.id });
  }

  async revokePairing(input: {
    pairingId: string;
    saleId: string;
    actorUserId: string;
  }): Promise<Result<void, DisplayServiceError>> {
    const devices = await this.pairingRepo.listForSale(input.saleId);
    const target = devices.find((d) => d.id === input.pairingId);
    if (!target) {
      return err({ message: "Display device not found", status: 404 });
    }
    if (target.deviceCodeHash) {
      await this.redis.del(displayTokenRedisKey(target.deviceCodeHash));
    }
    await this.pairingRepo.revoke(input.pairingId);

    await this.domainEventSink.publish({
      aggregateType: "sale",
      aggregateId: input.saleId,
      eventType: "saleroom.display.revoked",
      payload: { pairingId: input.pairingId, userCode: target.userCode },
      actorUserId: input.actorUserId,
    });

    return ok(undefined);
  }

  async heartbeat(displayToken: string): Promise<Result<{ ok: true }, DisplayServiceError>> {
    const row = await this.pairingRepo.findByDisplayTokenHash(this.tokenIssuer.hash(displayToken));
    if (!row) {
      return err({ message: "Invalid display token", status: 401, code: "invalid_token" });
    }
    await this.pairingRepo.touchLastSeen(row.id, new Date());
    return ok({ ok: true });
  }

  async listDevices(saleId: string): Promise<SaleroomDisplayDeviceRow[]> {
    const rows = await this.pairingRepo.listForSale(saleId);
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      saleId: row.saleId ?? saleId,
      status: row.status,
      userCode: row.userCode,
      pairedAt: row.pairedAt?.toISOString() ?? null,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      isOnline:
        row.status === "paired" &&
        row.lastSeenAt != null &&
        now - row.lastSeenAt.getTime() <= ONLINE_THRESHOLD_MS,
    }));
  }

  async verifyDisplayTokenForSale(
    displayToken: string,
    saleId: string,
  ): Promise<Result<{ pairingId: string }, DisplayServiceError>> {
    const row = await this.pairingRepo.findByDisplayTokenHash(this.tokenIssuer.hash(displayToken));
    if (!row || row.saleId !== saleId) {
      return err({ message: "Invalid display token", status: 401, code: "invalid_token" });
    }
    return ok({ pairingId: row.id });
  }

  async cleanupStalePairings(): Promise<{ expiredPending: number; purged: number }> {
    const now = new Date();
    const expiredPending = await this.pairingRepo.markExpiredStalePending(now);
    const purgeBefore = new Date(now.getTime() - TERMINAL_ROW_RETENTION_MS);
    const purged = await this.pairingRepo.purgeTerminalRows(purgeBefore);
    return { expiredPending, purged };
  }
}
