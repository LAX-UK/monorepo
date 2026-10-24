import type {
  AdminOriginalSaleList,
  AdminStockHoldList,
  AdminThirdPartySaleList,
} from "@auction/shop-contracts";
import { defineStatusMap, formatGbp } from "@auction/staff-ui";

/*
 * Stock holds, third-party sales, their fees and original sales: how each reads in its list, which
 * actions a record offers in its state, and the checks on the forms that create them. Pure, so the
 * rules are tested without rendering. Amounts are whole pence; staff type and read pounds.
 */

export type HoldRow = AdminStockHoldList["items"][number];
export type ThirdPartySaleRow = AdminThirdPartySaleList["items"][number];
export type SaleFeeRow = NonNullable<ThirdPartySaleRow["fees"]>[number];
export type OriginalSaleRow = AdminOriginalSaleList["items"][number];

/** The most one sale can be worth: what the database can store, about £20 million. */
export const SALE_AMOUNT_MAX_PENCE = 2_000_000_000;

export type Availability =
  | { kind: "hidden" }
  | { kind: "available" }
  | { kind: "blocked"; reason: string };

// Statuses ---------------------------------------------------------------------------------

export const presentHoldStatus = defineStatusMap({
  active: { label: "Active", tone: "success" },
  released: { label: "Released", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  converted: { label: "Sold", tone: "info" },
});

export const presentThirdPartySaleStatus = defineStatusMap({
  draft: { label: "Draft", tone: "neutral" },
  recorded: { label: "Recorded", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
});

export const presentFeeStatus = defineStatusMap({
  pending: { label: "Awaiting approval", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
});

export const presentOriginalSaleStatus = defineStatusMap({
  reserved: { label: "Reserved", tone: "info" },
  deposit_due: { label: "Deposit due", tone: "warning" },
  invoiced: { label: "Invoiced", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  assigned: { label: "Assigned", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
});

// Actions ----------------------------------------------------------------------------------

/** Release is offered on an active hold to staff who can hold; ended holds have nothing to do. */
export function releaseHoldAvailability(
  hold: Pick<HoldRow, "status">,
  options: { canRelease: boolean },
): Availability {
  if (!options.canRelease) return { kind: "hidden" };
  return hold.status === "active" ? { kind: "available" } : { kind: "hidden" };
}

/** Approve is offered on a fee still waiting, to staff who approve fees. */
export function approveFeeAvailability(
  fee: Pick<SaleFeeRow, "status">,
  options: { canApprove: boolean },
): Availability {
  if (!options.canApprove) return { kind: "hidden" };
  return fee.status === "pending" ? { kind: "available" } : { kind: "hidden" };
}

/**
 * An invoice goes to a reservation that has none yet. One already issued says so rather than
 * disappearing, because staff look for it there; sales that are paid, assigned or cancelled have
 * no invoice step left.
 */
export function issueInvoiceAvailability(
  sale: Pick<OriginalSaleRow, "status">,
  options: { canInvoice: boolean },
): Availability {
  if (!options.canInvoice) return { kind: "hidden" };
  switch (sale.status) {
    case "reserved":
    case "deposit_due":
      return { kind: "available" };
    case "invoiced":
      return { kind: "blocked", reason: "An invoice has already been issued" };
    default:
      return { kind: "hidden" };
  }
}

/** The fee shown on a sale's row: its amount and label, or null when there is none. */
export function pendingFeeOf(sale: Pick<ThirdPartySaleRow, "fees">): SaleFeeRow | null {
  return sale.fees?.find((fee) => fee.status === "pending") ?? null;
}

export function feeSummary(sale: Pick<ThirdPartySaleRow, "fees">): string | null {
  const fees = sale.fees ?? [];
  if (fees.length === 0) return null;
  const total = fees.reduce((sum, fee) => sum + fee.amountPence, 0);
  return formatGbp(total);
}

// Form checks ------------------------------------------------------------------------------

type Picked = { id: string } | null;

export type AmountCheck = { ok: true; pence: number } | { ok: false; message: string };

/** A sale amount in pence, already parsed from pounds by the money field. */
export function checkSaleAmount(pence: number | null, typed: boolean, noun: string): AmountCheck {
  if (pence === null) {
    return {
      ok: false,
      message: typed
        ? "Enter an amount in pounds, like 1200 or 1200.50."
        : `Enter the ${noun} in pounds.`,
    };
  }
  if (pence < 1) return { ok: false, message: "Enter an amount of at least £0.01." };
  if (pence > SALE_AMOUNT_MAX_PENCE) {
    return { ok: false, message: `Enter an amount up to ${formatGbp(SALE_AMOUNT_MAX_PENCE)}.` };
  }
  return { ok: true, pence };
}

export type OriginalSaleErrors = Partial<
  Record<"artwork" | "buyer" | "price" | "reservationExpiresAt", string>
>;

export type OriginalSaleCheck =
  | {
      ok: true;
      body: {
        artworkId: string;
        buyerPartyId: string;
        salePricePence: number;
        reservationExpiresAt?: string;
      };
    }
  | { ok: false; errors: OriginalSaleErrors };

export function checkOriginalSale(input: {
  artwork: Picked;
  buyer: Picked;
  pricePence: number | null;
  priceTyped: boolean;
  /** ISO instant, or null when empty. */
  reservationExpiresAt: string | null;
  now: Date;
}): OriginalSaleCheck {
  const errors: OriginalSaleErrors = {};
  if (!input.artwork) errors.artwork = "Choose the artwork being sold.";
  if (!input.buyer) errors.buyer = "Choose the buyer.";
  const price = checkSaleAmount(input.pricePence, input.priceTyped, "sale price");
  if (!price.ok) errors.price = price.message;
  if (input.reservationExpiresAt && new Date(input.reservationExpiresAt) <= input.now) {
    errors.reservationExpiresAt = "The reservation must end in the future.";
  }
  if (Object.keys(errors).length > 0 || !input.artwork || !input.buyer || !price.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      artworkId: input.artwork.id,
      buyerPartyId: input.buyer.id,
      salePricePence: price.pence,
      ...(input.reservationExpiresAt ? { reservationExpiresAt: input.reservationExpiresAt } : {}),
    },
  };
}

export type ThirdPartySaleErrors = Partial<
  Record<"edition" | "seller" | "buyer" | "gross", string>
>;

export type ThirdPartySaleCheck =
  | {
      ok: true;
      body: { editionId: string; sellerPartyId: string; buyerPartyId: string; grossPence: number };
    }
  | { ok: false; errors: ThirdPartySaleErrors };

export function checkThirdPartySale(input: {
  edition: Picked;
  seller: Picked;
  buyer: Picked;
  grossPence: number | null;
  grossTyped: boolean;
}): ThirdPartySaleCheck {
  const errors: ThirdPartySaleErrors = {};
  if (!input.edition) errors.edition = "Choose the edition that was sold.";
  if (!input.seller) errors.seller = "Choose the seller.";
  if (!input.buyer) errors.buyer = "Choose the buyer.";
  if (input.seller && input.buyer && input.seller.id === input.buyer.id) {
    errors.buyer = "The buyer and the seller must be different people.";
  }
  const gross = checkSaleAmount(input.grossPence, input.grossTyped, "amount the buyer paid");
  if (!gross.ok) errors.gross = gross.message;
  if (
    Object.keys(errors).length > 0 ||
    !input.edition ||
    !input.seller ||
    !input.buyer ||
    !gross.ok
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      editionId: input.edition.id,
      sellerPartyId: input.seller.id,
      buyerPartyId: input.buyer.id,
      grossPence: gross.pence,
    },
  };
}

export const HOLD_NOTE_MAX_LENGTH = 1000;

export type HoldErrors = Partial<Record<"edition" | "client" | "expiresAt" | "note", string>>;

export type HoldCheck =
  | {
      ok: true;
      body: { editionId: string; clientPartyId: string; expiresAt: string; note?: string };
    }
  | { ok: false; errors: HoldErrors };

export function checkStockHold(input: {
  edition: Picked;
  client: Picked;
  /** ISO instant, or null when empty. */
  expiresAt: string | null;
  note: string;
  now: Date;
}): HoldCheck {
  const errors: HoldErrors = {};
  if (!input.edition) errors.edition = "Choose the edition to hold.";
  if (!input.client) errors.client = "Choose the client the edition is held for.";
  if (!input.expiresAt) {
    errors.expiresAt = "Enter when the hold ends.";
  } else if (new Date(input.expiresAt) <= input.now) {
    errors.expiresAt = "The hold must end in the future.";
  }
  const note = input.note.trim();
  if (note.length > HOLD_NOTE_MAX_LENGTH) {
    errors.note = `Use ${HOLD_NOTE_MAX_LENGTH} characters or fewer.`;
  }
  if (Object.keys(errors).length > 0 || !input.edition || !input.client || !input.expiresAt) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      editionId: input.edition.id,
      clientPartyId: input.client.id,
      expiresAt: input.expiresAt,
      ...(note ? { note } : {}),
    },
  };
}

export const INVOICE_BUYER_NAME_MAX_LENGTH = 200;

export type InvoiceErrors = Partial<Record<"buyerEmail" | "buyerName", string>>;

export type InvoiceCheck =
  | { ok: true; body: { buyerEmail: string; buyerName?: string } }
  | { ok: false; errors: InvoiceErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkInvoiceDetails(input: {
  buyerEmail: string;
  buyerName: string;
}): InvoiceCheck {
  const errors: InvoiceErrors = {};
  const email = input.buyerEmail.trim();
  const name = input.buyerName.trim();
  if (!email) errors.buyerEmail = "Enter the email address the invoice is sent to.";
  else if (!EMAIL.test(email)) errors.buyerEmail = "Enter a valid email address.";
  if (name.length > INVOICE_BUYER_NAME_MAX_LENGTH) {
    errors.buyerName = `Use ${INVOICE_BUYER_NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, body: { buyerEmail: email, ...(name ? { buyerName: name } : {}) } };
}
