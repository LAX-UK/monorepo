import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type LockMessage,
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

/** What a deal asks of the artwork register. Each call is safe to repeat. */
export interface IDealRegisterLock {
  /** Holds the artwork for the deal. Throws {@link DealArtworkRefused} when it is offered elsewhere. */
  offer(registerId: string, dealId: string, actor: string): Promise<void>;
  /** Ends the deal's hold. A hold made by something else is left alone. */
  withdraw(registerId: string, dealId: string, actor: string): Promise<void>;
  /** Records the artwork as sold through this deal. */
  markSold(registerId: string, dealId: string, actor: string): Promise<void>;
}

/** The register's one-place-at-a-time lock, seen from a private sale deal. */
export class ArtworkRegisterDealLock implements IDealRegisterLock {
  constructor(private readonly lock: ArtworkOfferLock) {}

  offer(registerId: string, dealId: string, actor: string): Promise<void> {
    return this.run(() => this.lock.offer({ registerId }, ref(dealId), actor));
  }

  withdraw(registerId: string, dealId: string, actor: string): Promise<void> {
    return this.run(() => this.lock.withdraw({ registerId }, ref(dealId), actor));
  }

  markSold(registerId: string, dealId: string, actor: string): Promise<void> {
    return this.run(() => this.lock.markSold({ registerId }, ref(dealId), actor));
  }

  private async run(move: () => Promise<unknown>): Promise<void> {
    try {
      await move();
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
   * Whether a failure to record it must stop the change. A payment is money already taken, so the
   * register follows it rather than blocking it; ending a deal has nothing to protect.
   */
  blocking: boolean;
};

export const REGISTER_EFFECT_BY_STAGE: Partial<Record<PrivateSaleDealStage, DealRegisterEffect>> = {
  paid: { move: "markSold", blocking: false },
  cancelled: { move: "withdraw", blocking: true },
};

export function staffOrSystem(actorUserId: string | null): string {
  return actorUserId ? `staff:${actorUserId}` : "system";
}
