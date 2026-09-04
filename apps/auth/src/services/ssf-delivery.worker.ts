import { createHash, randomUUID } from "node:crypto";
import { IDENTITY_EVENT_TYPES, SSF_EVENT_TYPES } from "@auction/identity-contracts";
import type { SsfEventMapper } from "./ssf-event.mapper.js";
import type {
  DomainEventForSsf,
  SsfDeliveryRepository,
  SsfHttpDispatcher,
  SsfSigner,
  SsfSourceEventReader,
  SsfStreamRecord,
  SsfStreamRepository,
  SsfUnsignedSignal,
} from "./ssf.ports.js";

const ORDERED_SSF_JTI_VERSION = "lax-identity-outbox-v1";

function ssfSubjectKey(subjectId: string): string {
  return createHash("sha256").update(subjectId).digest("base64url");
}

/** Carries the durable Identity outbox order in the signed, replay-protected JTI. */
export function createOrderedSsfJti(subjectId: string, sourceEventId: number): string {
  if (!Number.isSafeInteger(sourceEventId) || sourceEventId < 1) {
    throw new Error("invalid_ssf_source_event_id");
  }
  return `${ORDERED_SSF_JTI_VERSION}.${ssfSubjectKey(subjectId)}.${sourceEventId}.${randomUUID()}`;
}

export function ssfStaleClaimBefore(now: Date, timeoutMs: number): Date {
  return new Date(now.getTime() - timeoutMs * 2);
}

export function nextSsfDeliveryAttempt(
  delivered: boolean,
  currentAttemptCount: number,
  maxAttempts: number,
  now: Date,
) {
  const attemptCount = currentAttemptCount + 1;
  if (delivered) return { status: "delivered" as const, attemptCount, nextAttemptAt: now };
  if (attemptCount >= maxAttempts) {
    return { status: "failed" as const, attemptCount, nextAttemptAt: now };
  }
  const backoffMs = Math.min(60 * 60_000, 1_000 * 2 ** Math.min(attemptCount - 1, 12));
  return {
    status: "pending" as const,
    attemptCount,
    nextAttemptAt: new Date(now.getTime() + backoffMs),
  };
}

export class SsfDeliveryWorker {
  constructor(
    private readonly streams: SsfStreamRepository,
    private readonly sourceEvents: SsfSourceEventReader,
    private readonly deliveries: SsfDeliveryRepository,
    private readonly mapper: SsfEventMapper,
    private readonly signer: SsfSigner,
    private readonly dispatcher: SsfHttpDispatcher,
    private readonly issuer: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async enqueueFromDomainEvents(limit = 100): Promise<number> {
    let enqueued = 0;
    for (const stream of await this.streams.enabledStreams()) {
      const domainTypes = domainEventTypesFor(stream.eventsDelivered);
      if (domainTypes.length === 0) continue;
      const events = await this.sourceEvents.readUnmapped(
        stream.id,
        stream.lastMappedEventId,
        domainTypes,
        limit,
      );
      for (const event of events) {
        const mapped = this.mapper.map(event);
        if (!mapped || !stream.eventsDelivered.includes(mapped.eventType)) continue;
        if (await this.enqueueSigned(stream, event, mapped)) enqueued += 1;
      }
      const last = events.at(-1);
      if (last) await this.streams.advanceCheckpoint(stream.id, last.id, this.now());
    }
    return enqueued;
  }

  async deliverDue(
    options: {
      batchSize?: number;
      timeoutMs?: number;
      maxAttempts?: number;
      onOutcome?: (outcome: "delivered" | "retry_scheduled" | "failed", id: string) => void;
    } = {},
  ): Promise<number> {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const maxAttempts = options.maxAttempts ?? 8;
    const now = this.now();
    const claimed = await this.deliveries.claimDue({
      now,
      staleBefore: ssfStaleClaimBefore(now, timeoutMs),
      batchSize: options.batchSize ?? 8,
    });
    await Promise.all(
      claimed.map(async (delivery) => {
        let statusCode: number | null = null;
        let errorMessage: string | null = null;
        try {
          statusCode = (
            await this.dispatcher.dispatch(delivery.endpoint, delivery.setToken, timeoutMs)
          ).status;
        } catch (error) {
          errorMessage = error instanceof Error ? error.message.slice(0, 1000) : null;
        }
        const delivered = statusCode !== null && statusCode >= 200 && statusCode < 300;
        const finalizedAt = this.now();
        const attempt = nextSsfDeliveryAttempt(
          delivered,
          delivery.attemptCount,
          maxAttempts,
          finalizedAt,
        );
        await this.deliveries.finalize({
          id: delivery.id,
          ...attempt,
          deliveredAt: delivered ? finalizedAt : null,
          statusCode,
          errorMessage,
          finalizedAt,
        });
        options.onOutcome?.(
          attempt.status === "pending" ? "retry_scheduled" : attempt.status,
          delivery.id,
        );
      }),
    );
    return claimed.length;
  }

  private async enqueueSigned(
    stream: SsfStreamRecord,
    source: DomainEventForSsf,
    signal: SsfUnsignedSignal,
  ): Promise<boolean> {
    const now = this.now();
    const jti = createOrderedSsfJti(signal.subjectId, source.id);
    const signed = await this.signer.sign({
      issuer: this.issuer,
      audience: stream.audience,
      subjectId: signal.subjectId,
      eventType: signal.eventType,
      event: signal.event,
      txn: source.correlationId,
      jti,
      issuedAt: Math.floor(now.getTime() / 1_000),
    });
    const inserted = await this.deliveries.enqueue({
      id: randomUUID(),
      streamId: stream.id,
      sourceEventId: source.id,
      eventType: signal.eventType,
      jti,
      txn: source.correlationId,
      signingKid: signed.signingKid,
      setToken: signed.token,
      now,
    });
    if (inserted && stream.signingKid !== signed.signingKid) {
      await this.deliveries.recordSigningKid(stream.id, signed.signingKid, now);
    }
    return inserted;
  }
}

function domainEventTypesFor(eventTypes: readonly string[]): string[] {
  const pairs = [
    [SSF_EVENT_TYPES.SESSION_REVOKED, IDENTITY_EVENT_TYPES.SESSION_REVOKED],
    [SSF_EVENT_TYPES.CREDENTIAL_CHANGE, IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED],
    [SSF_EVENT_TYPES.ACCOUNT_DISABLED, IDENTITY_EVENT_TYPES.IDENTITY_DISABLED],
    [SSF_EVENT_TYPES.ACCOUNT_ENABLED, IDENTITY_EVENT_TYPES.IDENTITY_ENABLED],
    [SSF_EVENT_TYPES.ACCOUNT_PURGED, IDENTITY_EVENT_TYPES.IDENTITY_DELETED],
    [SSF_EVENT_TYPES.LAX_IDENTITY_MERGED, IDENTITY_EVENT_TYPES.IDENTITY_MERGED],
  ] as const;
  return pairs.filter(([ssf]) => eventTypes.includes(ssf)).map(([, domain]) => domain);
}
