import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type LockMessage,
  type OfferLockOutcome,
} from "@auction/artwork-register-contracts";
import type { PrivateSaleDealStage } from "@auction/types";

/** The artwork cannot go into this deal: the register shows it somewhere else, or sold. */
export class DealArtworkRefused extends Error {
  readonly code = "artwork_unavailable";
  constructor(readonly lock: LockMessage) {
    super(lock.message);
    this.name = "DealArtworkRefused";
  }
}

/** The register could not record the change, so the deal's change should not go ahead. */
export class DealRegisterUnavailable extends Error {
  readonly code = "artwork_register_unavailable";
  constructor(message: string) {
    super(message);
    this.name = "DealRegisterUnavailable";
  }
}

/** What the register did: it moved, already showed this, skipped it (shown elsewhere), or does not govern the artwork. */
export type DealRegisterStatus = OfferLockOutcome["status"];

/** What a deal asks of the artwork register. Each call is safe to repeat. */
export interface IDealRegisterLock {
  /** Holds the artwork for the deal. Throws {@link DealArtworkRefused} when it is offered elsewhere. */
  offer(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus>;
  /** Ends the deal's hold. A hold made by something else is left alone. */
  withdraw(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus>;
  /** Records the artwork as sold through this deal. `skipped` when the register shows it elsewhere. */
  markSold(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus>;
}

/** The part of a database session the lock needs: a savepoint to run each call in. */
export type RegisterSession<Tx> = {
  transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
};

/**
 * The register's one-place-at-a-time lock, seen from a private sale deal. Every call runs in its
 * own savepoint of the deal's transaction, so a database error inside the register's reads or
 * writes is undone on its own and cannot abort the payment or stage change around it.
 */
export class ArtworkRegisterDealLock<Tx = unknown> implements IDealRegisterLock {
  constructor(
    private readonly session: RegisterSession<Tx>,
    private readonly lockOver: (tx: Tx) => ArtworkOfferLock,
  ) {}

  offer(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus> {
    return this.run((lock) => lock.offer({ registerId }, ref(dealId), actor));
  }

  withdraw(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus> {
    return this.run((lock) => lock.withdraw({ registerId }, ref(dealId), actor));
  }

  markSold(registerId: string, dealId: string, actor: string): Promise<DealRegisterStatus> {
    return this.run((lock) => lock.markSold({ registerId }, ref(dealId), actor));
  }

  private async run(
    move: (lock: ArtworkOfferLock) => Promise<OfferLockOutcome>,
  ): Promise<DealRegisterStatus> {
    try {
      const outcome = await this.session.transaction((tx) => move(this.lockOver(tx)));
      return outcome.status;
    } catch (error) {
      if (error instanceof ArtworkOfferedElsewhereError) throw new DealArtworkRefused(error.lock);
      if (error instanceof ArtworkOfferMoveError) throw new DealRegisterUnavailable(error.message);
      throw error;
    }
  }
}

function ref(dealId: string) {
  return { kind: "private_sale", id: dealId } as const;
}

/** How a deal's stage change is carried to the register. Stages not listed change nothing there. */
export type DealRegisterEffect = {
  move: "withdraw" | "markSold";
  /**
   * Whether a failure to record it must stop the change. Settling follows money already paid out,
   * so the register catches up (and staff are told) rather than blocking it; ending a deal has
   * nothing to protect, so it must not leave a hold behind.
   */
  blocking: boolean;
};

export const REGISTER_EFFECT_BY_STAGE: Partial<Record<PrivateSaleDealStage, DealRegisterEffect>> = {
  // Sold is final in the register, and a deal can still be cancelled after it is paid or released.
  // Until it settles the artwork stays held for the deal, which already blocks every other place.
  settled: { move: "markSold", blocking: false },
  cancelled: { move: "withdraw", blocking: true },
};

export function staffOrSystem(actorUserId: string | null): string {
  return actorUserId ? `staff:${actorUserId}` : "system";
}
