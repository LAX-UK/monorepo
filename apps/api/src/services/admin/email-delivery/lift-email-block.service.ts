import {
  EMAIL_BLOCK_RULES,
  type EmailLiftActor,
  type EmailLiftRefusal,
  emailLiftAccessRefusal,
  emailLiftInputRefusal,
} from "@auction/domain";
import type { IEmailBlockRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type { EmailAddressReactivationProducer } from "@auction/queues";
import {
  type EmailLiftReason,
  type EmailProviderResult,
  POSTMARK_STILL_BLOCKS_MESSAGE,
} from "@auction/types";
import type { IDomainEventSink } from "../../domain-event-sink.js";

export type LiftEmailBlockRequest = {
  emailHash: string;
  /** The person the address belongs to. Left out, it is found from the latest email sent to it. */
  userId?: string | null | undefined;
  actor: EmailLiftActor & { userId: string };
  reason: EmailLiftReason;
  note?: string | undefined;
  writtenRequest?: boolean | undefined;
  /** When the block started, as the caller saw it. */
  expectedSince: Date;
};

export type LiftEmailBlockOutcome =
  | { ok: true; provider: EmailProviderResult }
  | { ok: false; error: "refused"; refusal: EmailLiftRefusal }
  | {
      ok: false;
      /** Already lifted by someone else, or replaced by a newer block. */
      error: "block_already_lifted" | "block_changed";
      lifted: { at: Date; byUserId: string | null; byName: string | null } | null;
    };

export interface ILiftEmailBlockService {
  lift(request: LiftEmailBlockRequest): Promise<LiftEmailBlockOutcome>;
}

export type LiftEmailBlockDeps = {
  blocks: IEmailBlockRepository;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  reactivation: EmailAddressReactivationProducer;
};

/**
 * Lifts the block on an address. The block rules decide who may lift which block and what they
 * must say; this service applies them, removes the block only if it is still the one the caller
 * saw, audits the lift and queues the provider's reactivation. It never touches alert topics:
 * after a complaint they stay stopped until the person turns them back on.
 */
export class LiftEmailBlockService implements ILiftEmailBlockService {
  constructor(private readonly deps: LiftEmailBlockDeps) {}

  async lift(request: LiftEmailBlockRequest): Promise<LiftEmailBlockOutcome> {
    const userId =
      request.userId !== undefined
        ? request.userId
        : await this.deps.blocks.findUserIdByHash(request.emailHash);
    const block = await this.deps.blocks.findByHash(request.emailHash);
    if (!block) return this.alreadyLifted("block_already_lifted", userId);

    const refusal =
      emailLiftAccessRefusal(block.reason, request.actor) ??
      emailLiftInputRefusal(block.reason, request);
    if (refusal) return { ok: false, error: "refused", refusal };

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const removed = await this.deps.blocks.removeIfUnchangedInTransaction(tx, {
        emailHash: request.emailHash,
        expectedSince: request.expectedSince,
      });
      if (!removed) return this.alreadyLifted("block_changed", userId);

      if (userId) {
        await this.deps.blocks.resetAddressStatusInTransaction(tx, userId);
      }
      const provider = await this.askProvider(removed.reason, userId, request.emailHash);
      await this.deps.events.withTx(tx).publish({
        aggregateType: "user",
        aggregateId: userId ?? request.emailHash,
        eventType: "email.block_lifted",
        payload: {
          ...(userId ? { userId } : {}),
          reason: request.reason,
          ...(request.note?.trim() ? { note: request.note.trim() } : {}),
          previousReason: removed.reason,
          previousSince: removed.since.toISOString(),
          provider: provider.status,
        },
        actorUserId: request.actor.userId,
      });
      return { ok: true as const, provider };
    });
  }

  private async askProvider(
    reason: keyof typeof EMAIL_BLOCK_RULES,
    userId: string | null,
    emailHash: string,
  ): Promise<EmailProviderResult> {
    const mode = EMAIL_BLOCK_RULES[reason].providerReactivation;
    if (mode === "unavailable") {
      return { status: "still_blocked", message: POSTMARK_STILL_BLOCKS_MESSAGE };
    }
    // The worker finds the address from the person, so without one there is nothing to ask for.
    if (mode === "none" || !userId) return { status: "not_needed" };
    await this.deps.reactivation.request({ userId, emailHash });
    return { status: "queued" };
  }

  private async alreadyLifted(
    error: "block_already_lifted" | "block_changed",
    userId: string | null,
  ): Promise<LiftEmailBlockOutcome> {
    const lifted = userId ? await this.deps.blocks.findLatestLift(userId) : null;
    return { ok: false, error, lifted };
  }
}
