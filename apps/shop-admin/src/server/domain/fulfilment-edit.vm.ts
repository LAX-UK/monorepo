import {
  FULFILMENT_CARRIER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_PATTERN,
} from "@auction/shop-contracts";
import { type ShopFulfilmentStatus, validatePossessionTimestamp } from "@auction/shop-domain";

/*
 * Moving a fulfilment on, from the order page. Which statuses are offered comes from the domain's
 * transition table (see `fulfilmentNextOptions`); this file decides how a move is sent (an
 * ordinary update, or recording that the customer took possession) and checks what the person
 * entered before anything is sent.
 */

/** Moves that record the customer taking possession of the work, with the moment it happened. */
export const POSSESSION_STATUSES: readonly ShopFulfilmentStatus[] = [
  "delivered",
  "collected",
  "in_storage",
];

/** Statuses that go in the post, so a carrier and tracking number can be recorded. */
export const DISPATCH_STATUSES: readonly ShopFulfilmentStatus[] = ["in_transit"];

export type FulfilmentMoveKind = "update" | "possession";

/**
 * How a move is sent. Possession is recorded once, with its moment; after that the same statuses
 * are ordinary updates.
 */
export function fulfilmentMoveKind(
  to: ShopFulfilmentStatus,
  state: { possessionRecorded: boolean },
): FulfilmentMoveKind {
  return POSSESSION_STATUSES.includes(to) && !state.possessionRecorded ? "possession" : "update";
}

const MOVE_LABELS: Record<ShopFulfilmentStatus, string> = {
  pending_production: "Return to production queue",
  in_production: "Start production",
  awaiting_dispatch: "Mark ready to dispatch",
  in_transit: "Mark in transit",
  ready_for_collection: "Mark ready for collection",
  collected: "Mark collected",
  in_storage: "Move to storage",
  delivered: "Mark delivered",
  cancelled: "Cancel fulfilment",
};

/** The submit button names the chosen move; before one is chosen it reads "Move on". */
export function fulfilmentMoveLabel(to: ShopFulfilmentStatus | null): string {
  return to ? MOVE_LABELS[to] : "Move on";
}

/** The minute the form opened, as an instant: the default moment of possession. */
export function possessionDefault(now: Date): string {
  const minute = new Date(now);
  minute.setUTCSeconds(0, 0);
  return minute.toISOString();
}

export function movesNeedTracking(to: ShopFulfilmentStatus): boolean {
  return DISPATCH_STATUSES.includes(to);
}

export type FulfilmentEditPermission =
  | { kind: "hidden" }
  | { kind: "final" }
  | { kind: "editable" };

/**
 * Whether the section offers Edit. Staff who cannot change fulfilment see the facts only; a
 * fulfilment that has reached an end state has nothing left to change.
 */
export function fulfilmentEditPermission(input: {
  canEdit: boolean;
  nextStatusCount: number;
}): FulfilmentEditPermission {
  if (!input.canEdit) return { kind: "hidden" };
  return input.nextStatusCount === 0 ? { kind: "final" } : { kind: "editable" };
}

export type FulfilmentEditErrors = Partial<
  Record<"status" | "carrier" | "tracking" | "possessionAt", string>
>;

export type FulfilmentEditInput = {
  status: ShopFulfilmentStatus | null;
  carrier: string;
  tracking: string;
  /** The moment the customer took possession, as an ISO instant; null when empty or invalid. */
  possessionAt: string | null;
  possessionRecorded: boolean;
  /** When the order was paid; possession cannot be before it. */
  paidAt: string | null;
  now: Date;
};

export type FulfilmentEditRequest =
  | {
      kind: "update";
      status: ShopFulfilmentStatus;
      carrier?: string;
      trackingNumber?: string;
    }
  | { kind: "possession"; status: ShopFulfilmentStatus; possessionAt: string };

export type FulfilmentEditCheck =
  | { ok: true; request: FulfilmentEditRequest }
  | { ok: false; errors: FulfilmentEditErrors };

const TRACKING_PATTERN = new RegExp(FULFILMENT_TRACKING_NUMBER_PATTERN);

/** Checks a move before it is sent: the status, the dispatch details, or the possession moment. */
export function checkFulfilmentEdit(input: FulfilmentEditInput): FulfilmentEditCheck {
  const errors: FulfilmentEditErrors = {};
  if (!input.status) return { ok: false, errors: { status: "Choose the next status." } };
  const status = input.status;
  const kind = fulfilmentMoveKind(status, { possessionRecorded: input.possessionRecorded });

  if (kind === "possession") {
    if (!input.possessionAt) {
      errors.possessionAt = "Enter the date and time the customer took possession.";
    } else if (input.paidAt) {
      const bounds = validatePossessionTimestamp({
        paidAt: new Date(input.paidAt),
        possessionAt: new Date(input.possessionAt),
        now: input.now,
      });
      if (!bounds.ok) {
        errors.possessionAt =
          bounds.reason === "in_future"
            ? "Possession cannot be in the future."
            : "Possession cannot be before the order was paid.";
      }
    }
    if (Object.keys(errors).length > 0 || !input.possessionAt) return { ok: false, errors };
    return { ok: true, request: { kind, status, possessionAt: input.possessionAt } };
  }

  const carrier = input.carrier.trim();
  const tracking = input.tracking.trim();
  if (movesNeedTracking(status)) {
    if (carrier.length > FULFILMENT_CARRIER_MAX_LENGTH) {
      errors.carrier = `Use ${FULFILMENT_CARRIER_MAX_LENGTH} characters or fewer.`;
    }
    if (tracking.length > FULFILMENT_TRACKING_NUMBER_MAX_LENGTH) {
      errors.tracking = `Use ${FULFILMENT_TRACKING_NUMBER_MAX_LENGTH} characters or fewer.`;
    } else if (tracking && !TRACKING_PATTERN.test(tracking)) {
      errors.tracking = "Use letters, numbers, spaces and hyphens only.";
    }
    if (tracking && !carrier && !errors.carrier) {
      errors.carrier = "Add the carrier this tracking number belongs to.";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    request: {
      kind,
      status,
      ...(movesNeedTracking(status) && carrier ? { carrier } : {}),
      ...(movesNeedTracking(status) && tracking ? { trackingNumber: tracking } : {}),
    },
  };
}
