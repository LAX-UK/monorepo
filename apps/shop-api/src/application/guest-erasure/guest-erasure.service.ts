import {
  GUEST_ERASURE_REASON_MAX_LENGTH,
  GUEST_ERASURE_REASON_MIN_LENGTH,
  type GuestErasureBlock,
  decideGuestErasure,
  guestErasureBlockMessage,
  guestErasureConfirmed,
} from "@auction/shop-domain";
import type {
  GuestErasureCounts,
  GuestErasureSnapshot,
  GuestErasureStore,
} from "../ports/guest-erasure.store.js";

/** Whether staff can erase this guest now, and if not, the sentence that says why. */
export type GuestErasureState = {
  guestCustomerId: string;
  erasedAt: Date | null;
  allowed: boolean;
  blockedReason: GuestErasureBlock | null;
  blockedMessage: string | null;
  blockingOrderReferences: string[];
  availableFrom: Date | null;
};

export type GuestErasureOutcome =
  | ({ kind: "erased"; erasedAt: Date } & GuestErasureCounts)
  | { kind: "not_found" }
  | { kind: "blocked"; reason: GuestErasureBlock; message: string }
  | { kind: "confirmation_mismatch" }
  | { kind: "reason_invalid" };

function stateOf(guest: GuestErasureSnapshot, now: Date): GuestErasureState {
  const decision = decideGuestErasure({ ...guest, now });
  return {
    guestCustomerId: guest.guestCustomerId,
    erasedAt: guest.erasedAt,
    allowed: decision.kind === "allowed",
    blockedReason: decision.kind === "blocked" ? decision.reason : null,
    blockedMessage: guestErasureBlockMessage(decision),
    blockingOrderReferences: decision.kind === "blocked" ? decision.orderReferences : [],
    availableFrom: decision.kind === "blocked" ? (decision.until ?? null) : null,
  };
}

/**
 * Erasing a guest's personal data on request. The rules (who can be erased, what stays for the
 * accounting record) are the domain's; this service checks the request, applies them under one
 * lock and leaves the data changes to the store.
 */
export class GuestErasureService {
  constructor(
    private readonly store: GuestErasureStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async state(guestCustomerId: string): Promise<GuestErasureState | null> {
    const guest = await this.store.read(guestCustomerId);
    return guest ? stateOf(guest, this.now()) : null;
  }

  async erase(input: {
    guestCustomerId: string;
    /** The guest's email, typed by staff to confirm. */
    confirmation: string;
    reason: string;
    actorSubjectId: string;
  }): Promise<GuestErasureOutcome> {
    const reason = input.reason.trim();
    if (
      reason.length < GUEST_ERASURE_REASON_MIN_LENGTH ||
      reason.length > GUEST_ERASURE_REASON_MAX_LENGTH
    ) {
      return { kind: "reason_invalid" };
    }
    const outcome = await this.store.withLockedGuest(
      input.guestCustomerId,
      async (guest, erase): Promise<GuestErasureOutcome> => {
        const now = this.now();
        const decision = decideGuestErasure({ ...guest, now });
        if (decision.kind === "blocked") {
          return {
            kind: "blocked",
            reason: decision.reason,
            message: guestErasureBlockMessage(decision) ?? "",
          };
        }
        if (!guestErasureConfirmed({ typed: input.confirmation, email: guest.email })) {
          return { kind: "confirmation_mismatch" };
        }
        const counts = await erase({ actorSubjectId: input.actorSubjectId, reason, now });
        return { kind: "erased", erasedAt: now, ...counts };
      },
    );
    return outcome ?? { kind: "not_found" };
  }
}
