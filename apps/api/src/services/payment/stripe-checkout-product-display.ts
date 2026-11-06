import type { InvoiceLine, Lot } from "@auction/types";
import type { PaymentCheckoutContext } from "../interfaces/checkout-rail.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type {
  CreateCheckoutSessionInput,
  StripeCheckoutLineItem,
} from "../stripe/stripe-checkout-session.types.js";
import { InvoiceLinesError, assertWithinStripeLineLimit } from "./invoice-stripe-lines.js";

const STRIPE_PRODUCT_NAME_MAX = 250;
const STRIPE_DESCRIPTOR_SUFFIX_MAX = 22;

export function truncateForStripe(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function formatLotReference(lotNumber: number | null, lotId: string): string {
  return lotNumber != null ? String(lotNumber) : lotId;
}

export function formatStripeSettlementDescription(input: {
  lotTitle: string;
  lotNumber: number | null;
  lotId: string;
  medium?: string | null;
}): string {
  const lotRef = formatLotReference(input.lotNumber, input.lotId);
  const base = `Lot ${lotRef} · LAX auction settlement`;
  const medium = input.medium?.trim();
  if (!medium) return base;
  return truncateForStripe(`${base} · ${medium}`, STRIPE_PRODUCT_NAME_MAX);
}

export function buildStripePaymentIntentDescription(input: {
  lotTitle: string;
  lotNumber: number | null;
  lotId: string;
}): string {
  const lotRef = formatLotReference(input.lotNumber, input.lotId);
  return truncateForStripe(
    `Auction settlement — ${input.lotTitle.trim() || "Untitled lot"} (lot ${lotRef})`,
    1000,
  );
}

export function buildStatementDescriptorSuffix(lotNumber: number | null, lotTitle: string): string {
  if (lotNumber != null) {
    return truncateForStripe(`LOT ${lotNumber}`, STRIPE_DESCRIPTOR_SUFFIX_MAX);
  }
  return truncateForStripe(lotTitle.trim() || "AUCTION", STRIPE_DESCRIPTOR_SUFFIX_MAX);
}

function withOptionalImages(
  item: Omit<StripeCheckoutLineItem, "images">,
  images?: string[],
): StripeCheckoutLineItem {
  return images?.length ? { ...item, images } : item;
}

/** The name Stripe shows for one invoice line: "Lot 12 · Hammer price". */
export function stripeLineName(
  lot: { lotNumber: number | null; lotId: string },
  line: Pick<InvoiceLine, "label">,
): string {
  return truncateForStripe(
    `Lot ${formatLotReference(lot.lotNumber, lot.lotId)} · ${line.label}`,
    STRIPE_PRODUCT_NAME_MAX,
  );
}

/**
 * One Stripe line per stored invoice line, at exactly the stored pence. The lines must add up to
 * `amountCents`, the amount charged; nothing is recalculated from the lot or sale as they are now.
 */
export function buildStripeCheckoutLineItems(input: {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  medium: string | null;
  amountCents: number;
  invoiceLines: readonly InvoiceLine[];
  imageUrl?: string | null;
}): StripeCheckoutLineItem[] {
  const sum = input.invoiceLines.reduce((total, line) => total + line.amountPence, 0);
  if (input.invoiceLines.length === 0 || sum !== input.amountCents) {
    throw new InvoiceLinesError(
      "invoice_mismatch",
      `Invoice lines add up to ${sum} pence but ${input.amountCents} pence is being charged`,
    );
  }
  assertWithinStripeLineLimit(input.invoiceLines.length);
  const description = formatStripeSettlementDescription({
    lotTitle: input.lotTitle,
    lotNumber: input.lotNumber,
    lotId: input.lotId,
    medium: input.medium,
  });
  const image = input.imageUrl?.trim();
  const images = image?.startsWith("https://") ? [image] : undefined;
  const baseMetadata = { lotId: input.lotId, paymentId: input.paymentId };

  return input.invoiceLines.map((line, index) =>
    withOptionalImages(
      {
        name: stripeLineName({ lotNumber: input.lotNumber, lotId: input.lotId }, line),
        description,
        unitAmountCents: line.amountPence,
        metadata: { ...baseMetadata, lineKind: line.kind },
      },
      index === 0 ? images : undefined,
    ),
  );
}

export function buildStripeCheckoutCustomText(): {
  submit: { message: string };
  after_submit: { message: string };
} {
  return {
    submit: {
      message: "You'll return to LAX to track fulfilment and shipping.",
    },
    after_submit: {
      message: "Questions about your purchase? Contact our settlements team.",
    },
  };
}

export function buildCreateCheckoutSessionInput(
  ctx: PaymentCheckoutContext,
  opts: {
    successUrl: string;
    cancelUrl: string;
    idempotencyKey?: string;
    imageUrl?: string | null;
  },
): CreateCheckoutSessionInput {
  const lot = ctx.lot;
  const lineItemInput: Parameters<typeof buildStripeCheckoutLineItems>[0] = {
    paymentId: ctx.paymentId,
    lotId: lot.id,
    lotTitle: lot.title,
    lotNumber: lot.lotNumber,
    medium: lot.medium,
    amountCents: ctx.amountPence,
    invoiceLines: ctx.invoiceLines,
  };
  if (opts.imageUrl !== undefined) {
    lineItemInput.imageUrl = opts.imageUrl;
  }

  const input: CreateCheckoutSessionInput = {
    paymentId: ctx.paymentId,
    lotId: lot.id,
    amountCents: ctx.amountPence,
    currency: "gbp",
    buyerEmail: ctx.buyerEmail,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    lineItems: buildStripeCheckoutLineItems(lineItemInput),
    paymentIntentDescription: buildStripePaymentIntentDescription({
      lotTitle: lot.title,
      lotNumber: lot.lotNumber,
      lotId: lot.id,
    }),
    statementDescriptorSuffix: buildStatementDescriptorSuffix(lot.lotNumber, lot.title),
  };
  if (opts.idempotencyKey !== undefined) {
    input.idempotencyKey = opts.idempotencyKey;
  }
  return input;
}

export async function resolveCheckoutLotHeroImage(
  lot: Pick<Lot, "images">,
  mediaUrlResolver?: MediaUrlResolver,
): Promise<string | null> {
  const raw = lot.images[0];
  if (!raw?.trim() || !mediaUrlResolver) return null;
  return mediaUrlResolver.resolve(raw);
}
