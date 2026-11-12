import type { LotOwnership } from "@auction/domain";

/** The step that moves money towards a new buyer, named for the pause guard. */
export type ReofferMoneyStep = "reoffer_send" | "reoffer_accept";

/**
 * The Zoho sold-while-live guard. It throws (a `ReofferError` with code `money_paused`) when
 * money movement is paused. HOOK POINT: `assertMoneyNotPaused` from `@auction/artwork-register-contracts`
 * is not on main yet; when it lands, the container adapter calls it here with these step names
 * and nothing else changes. Until then the default adapter allows every step.
 *
 * RELEASE GATE: the allow-all default means the Zoho sold-while-live pause is NOT enforced in
 * production. Do not announce or switch on the re-offer feature until the container passes a real
 * `moneyPause` into `createReofferServices`. The register place guard still refuses a Sold or
 * Reserved artwork, but it does not replace the pause.
 */
export interface IReofferMoneyPauseGuard {
  assertNotPaused(
    step: ReofferMoneyStep,
    context: { lotId: string; reofferId: string },
  ): Promise<void>;
}

/** Placeholder until the real guard is wired; see the RELEASE GATE note on the interface above. */
export const allowAllMoneyPauseGuard: IReofferMoneyPauseGuard = {
  async assertNotPaused() {},
};

/**
 * The gallery-sale-wins rule (IC6/Q7): the artwork may be offered or sold elsewhere while the lot
 * waits. Returns the lock's own message when the register's place is not this lot's.
 */
export interface IReofferArtworkPlaceGuard {
  check(lotId: string): Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Whether ATG sold the lot (RA19). */
export interface IReofferAtgGuard {
  soldOnAtg(lotId: string): Promise<boolean>;
}

/**
 * What the seller would receive if the lot sold to a buyer at a hammer, worked out the way
 * settlement pays it (see `sellerNetForSale`), so the seller is asked about money they will see.
 */
export interface IReofferSellerProceeds {
  proceedsFor(input: {
    lotId: string;
    sellerLegalEntityId: string;
    buyerLegalEntityId: string;
    hammerPence: number;
  }): Promise<{ salePence: number; proceedsPence: number }>;
}

export interface IReofferLotOwnership {
  of(sellerLegalEntityId: string | null): LotOwnership;
}

/**
 * Raises the new buyer's invoice once the lot is theirs. Best effort after the re-award has
 * committed: the invoice backfill raises it if this fails, so the re-award never depends on it.
 */
export interface IReofferInvoicing {
  raiseFor(lotId: string): Promise<void>;
}

/** The invoice lines a hammer would be charged at, for the lot and the account that would buy it. */
export interface IReofferPricing {
  priceFor(input: {
    lotId: string;
    buyerLegalEntityId: string;
    hammerPence: number;
  }): Promise<{ lines: readonly { kind: string; amountPence: number }[]; totalPence: number }>;
}
