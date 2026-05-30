import type { Lot } from "@auction/types";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { PaymentCheckoutContext } from "../interfaces/checkout-rail.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type {
  CreateCheckoutSessionInput,
  StripeCheckoutLineItem,
} from "../stripe/stripe-checkout-session.types.js";

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

function premiumPercentLabel(
  checkoutPricing: NonNullable<PaymentCheckoutContext["lot"]["checkoutPricing"]>,
): string {
  if (checkoutPricing.kind === "tiered") return "Tiered";
  const hammer = Number.parseFloat(checkoutPricing.hammerMajor);
  const premium = Number.parseFloat(checkoutPricing.premiumMajor);
  if (!Number.isFinite(hammer) || hammer <= 0 || !Number.isFinite(premium)) return "";
  const pct = Math.min(100, Math.max(0, Math.round((premium / hammer) * 100)));
  return `${pct}%`;
}

function withOptionalImages(
  item: Omit<StripeCheckoutLineItem, "images">,
  images?: string[],
): StripeCheckoutLineItem {
  return images?.length ? { ...item, images } : item;
}

export function buildStripeCheckoutLineItems(input: {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  medium: string | null;
  amountCents: number;
  checkoutPricing?: PaymentCheckoutContext["lot"]["checkoutPricing"];
  imageUrl?: string | null;
}): StripeCheckoutLineItem[] {
  const title = truncateForStripe(input.lotTitle.trim() || "Untitled lot", STRIPE_PRODUCT_NAME_MAX);
  const description = formatStripeSettlementDescription({
    lotTitle: input.lotTitle,
    lotNumber: input.lotNumber,
    lotId: input.lotId,
    medium: input.medium,
  });
  const image = input.imageUrl?.trim();
  const images = image?.startsWith("https://") ? [image] : undefined;
  const baseMetadata = { lotId: input.lotId, paymentId: input.paymentId };

  const pricing = input.checkoutPricing;
  if (pricing) {
    const hammerCents = gbpAmountToPence(pricing.hammerMajor);
    const premiumCents = gbpAmountToPence(pricing.premiumMajor);
    if (hammerCents + premiumCents === input.amountCents && hammerCents > 0 && premiumCents >= 0) {
      const label = premiumPercentLabel(pricing);
      const premiumName = label ? `Buyer's premium (${label})` : "Buyer's premium";
      return [
        withOptionalImages(
          {
            name: truncateForStripe(`Hammer price — ${title}`, STRIPE_PRODUCT_NAME_MAX),
            description,
            unitAmountCents: hammerCents,
            metadata: baseMetadata,
          },
          images,
        ),
        {
          name: truncateForStripe(premiumName, STRIPE_PRODUCT_NAME_MAX),
          description,
          unitAmountCents: premiumCents,
          metadata: baseMetadata,
        },
      ];
    }
  }

  return [
    withOptionalImages(
      {
        name: title,
        description,
        unitAmountCents: input.amountCents,
        metadata: baseMetadata,
      },
      images,
    ),
  ];
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
    checkoutPricing: lot.checkoutPricing,
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
