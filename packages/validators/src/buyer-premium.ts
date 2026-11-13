import {
  type BuyerPremiumSaleTerms,
  STANDARD_BUYER_PREMIUM,
  STANDARD_BUYER_PREMIUM_BANDS,
  isBuyerPremiumRate,
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  premiumMinorFor,
  premiumSlicesMinor,
  rateToTenThousandths,
  resolveBuyerPremiumSchedule,
  saleBuyerPremiumSchedule,
  sortedPremiumBands,
} from "@auction/domain";
import type {
  BuyerPremiumPolicy,
  BuyerPremiumSchedule,
  BuyerPremiumSlice,
  BuyerPremiumSource,
  BuyerPremiumTier,
} from "@auction/types";
import { z } from "zod";

/*
 * The buyer's premium as policies and input schemas. The maths and the rule for which premium a
 * lot charges live in `@auction/domain` (`buyer-premium-maths.ts`); this module wraps them.
 */
export {
  type BuyerPremiumSaleTerms,
  STANDARD_BUYER_PREMIUM,
  STANDARD_BUYER_PREMIUM_BANDS,
  isBuyerPremiumRate,
  rateToTenThousandths,
  saleBuyerPremiumSchedule,
};

/** A copy of the standard bands to store on a sale (rows are written, never shared). */
export function standardBuyerPremiumBands(): BuyerPremiumTier[] {
  return STANDARD_BUYER_PREMIUM_BANDS.map((band) => ({ ...band }));
}

const RATE_PATTERN = /^\d(\.\d{1,4})?$/u;
const RATE_SCALE = 10_000n;

const tierSchema = z.object({
  hammerThresholdMinor: z.number().int().nonnegative().finite(),
  rate: z
    .string()
    .regex(RATE_PATTERN, "Rate must be a decimal between 0 and 1 with up to 4 d.p.")
    .refine((s) => rateToTenThousandths(s) !== null, "Rate must be between 0 and 1"),
});

/**
 * Zod schema for `BuyerPremiumTier` rows on `sale.buyer_premium_tiers`.
 *
 * Validation:
 * - non-empty array
 * - thresholds non-negative integers (minor units)
 * - rates are decimal strings between 0 and 1 with up to 4 d.p.
 * - first band MUST start at threshold 0 (covers all hammer values)
 * - thresholds strictly ascending and unique
 */
export const buyerPremiumTiersSchema = z
  .array(tierSchema)
  .min(1, "Buyer premium tiers must have at least one entry")
  .max(16, "Buyer premium tiers capped at 16 entries")
  .superRefine((tiers, ctx) => {
    if (tiers[0]?.hammerThresholdMinor !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "First tier must start at hammerThresholdMinor 0",
        path: [0, "hammerThresholdMinor"],
      });
    }
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const cur = tiers[i];
      if (!prev || !cur) continue;
      if (cur.hammerThresholdMinor <= prev.hammerThresholdMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tiers must be strictly ascending by hammerThresholdMinor",
          path: [i, "hammerThresholdMinor"],
        });
      }
    }
  });

export type BuyerPremiumTiers = z.infer<typeof buyerPremiumTiersSchema>;

/** A pence amount as a non-negative bigint; anything else is 0. */
function safeMinor(minor: number): bigint {
  return Number.isSafeInteger(minor) && minor > 0 ? BigInt(minor) : 0n;
}

/**
 * `hammerMinor` × `rate`, rounded half up to the penny with integer maths (no floats).
 * A rate that is not a valid premium rate charges nothing.
 */
export function roundPremiumMinor(hammerMinor: number, rate: string): number {
  return Number(premiumMinorFor({ kind: "flat", rate }, safeMinor(hammerMinor)));
}

/**
 * Convert a decimal-major string ("123.45") to integer minor units (12345), from the digits
 * (no floats). Negative / non-numeric inputs give 0 (defensive — invariant guarded at write time).
 */
export function majorToMinor(major: string): number {
  const trimmed = (major ?? "").trim();
  if (!/^\d+(\.\d+)?$/u.test(trimmed)) return 0;
  return Number(parseMoneyToMinorUnits(trimmed));
}

export function minorToMajor(minor: number): string {
  if (!Number.isFinite(minor) || minor < 0) return "0.00";
  return minorUnitsToMoneyString(BigInt(Math.round(minor)));
}

/** A rate written to 4 d.p. ("0.15" → "0.1500"), so ids and comparisons are stable. */
function canonicalRate(rate: string): string {
  const units = rateToTenThousandths(rate);
  if (units === null) return rate;
  const whole = units / RATE_SCALE;
  return `${whole}.${(units % RATE_SCALE).toString().padStart(4, "0")}`;
}

/** A schedule's slices of `hammerMinor`, as the policies report them. */
function slicesOf(schedule: BuyerPremiumSchedule, hammerMinor: number): BuyerPremiumSlice[] {
  return premiumSlicesMinor(schedule, safeMinor(hammerMinor)).map((slice) => ({
    rate: slice.rate,
    baseMinor: Number(slice.baseMinor),
  }));
}

/** Shared behaviour of the two policies: both charge their schedule through the domain maths. */
abstract class ScheduleBuyerPremiumPolicy implements BuyerPremiumPolicy {
  abstract readonly id: string;
  abstract readonly schedule: BuyerPremiumSchedule;

  computePremiumMinor(hammerMinor: number): number {
    return Number(premiumMinorFor(this.schedule, safeMinor(hammerMinor)));
  }

  breakdown(hammerMinor: number): BuyerPremiumSlice[] {
    return slicesOf(this.schedule, hammerMinor);
  }

  abstract rateFor(hammerMinor: number): string;

  computePremiumMajor(hammerMajor: string): string {
    return minorToMajor(this.computePremiumMinor(majorToMinor(hammerMajor)));
  }
}

/** One rate on the whole hammer: a sale's flat rate, or a lot's own premium. */
export class FlatRateBuyerPremiumPolicy extends ScheduleBuyerPremiumPolicy {
  readonly id: string;
  readonly schedule: BuyerPremiumSchedule;

  constructor(private readonly rate: string) {
    super();
    this.id = `flat:${rate}`;
    this.schedule = { kind: "flat", rate };
  }

  rateFor(): string {
    return this.rate;
  }
}

/**
 * Bands charged slice by slice: each band's rate applies only to the part of the hammer between
 * its threshold and the next band's. With the standard bands a £600,000 hammer pays
 * 15% of £500,000 + 10% of £100,000 = £85,000, and the premium never drops at a band edge.
 *
 * The slices are added exactly (in ten-thousandths of a penny) and the total is rounded once,
 * half up, so the premium is the same however the hammer is split.
 */
export class BandedBuyerPremiumPolicy extends ScheduleBuyerPremiumPolicy {
  readonly id: string;
  readonly schedule: BuyerPremiumSchedule;
  private readonly bands: readonly BuyerPremiumTier[];

  constructor(bands: readonly BuyerPremiumTier[]) {
    super();
    if (bands.length === 0) {
      throw new Error("BandedBuyerPremiumPolicy: bands must be non-empty");
    }
    const sorted = sortedPremiumBands(bands);
    if (sorted[0]?.hammerThresholdMinor !== 0) {
      throw new Error("BandedBuyerPremiumPolicy: the first band must start at 0");
    }
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i]?.hammerThresholdMinor ?? 0) <= (sorted[i - 1]?.hammerThresholdMinor ?? 0)) {
        throw new Error("BandedBuyerPremiumPolicy: band thresholds must be strictly ascending");
      }
    }
    this.bands = sorted;
    this.schedule = { kind: "bands", bands: sorted };
    this.id = `bands:[${sorted.map((b) => `${b.hammerThresholdMinor}:${canonicalRate(b.rate)}`).join(",")}]`;
  }

  rateFor(hammerMinor: number): string {
    const slices = this.breakdown(hammerMinor);
    return (slices[slices.length - 1] ?? this.bands[0])?.rate ?? "0";
  }
}

/** The policy that charges `schedule`. */
export function buildBuyerPremiumPolicy(schedule: BuyerPremiumSchedule): BuyerPremiumPolicy {
  return schedule.kind === "bands" && schedule.bands.length > 0
    ? new BandedBuyerPremiumPolicy(schedule.bands)
    : new FlatRateBuyerPremiumPolicy(schedule.kind === "flat" ? schedule.rate : "0");
}

/**
 * Pricing context: the lot's own premium (`lot.buyer_premium_rate`, `null` unless staff set
 * one) and its sale's terms (`null` for a lot outside a sale).
 */
export type BuyerPremiumContext = {
  lotRate: string | null | undefined;
  sale: BuyerPremiumSaleTerms | null | undefined;
};

export type ResolvedBuyerPremium = {
  source: BuyerPremiumSource;
  schedule: BuyerPremiumSchedule;
  policy: BuyerPremiumPolicy;
};

/**
 * Which premium a lot charges (`resolveBuyerPremiumSchedule`: the lot's own, else the sale's
 * bands, else the sale's flat rate, else the published standard), with the policy that charges it.
 */
export function resolveBuyerPremium(ctx: BuyerPremiumContext): ResolvedBuyerPremium {
  const { source, schedule } = resolveBuyerPremiumSchedule(ctx);
  return { source, schedule, policy: buildBuyerPremiumPolicy(schedule) };
}

/** Whether two schedules charge the same on every hammer. */
export function sameBuyerPremiumSchedule(
  a: BuyerPremiumSchedule,
  b: BuyerPremiumSchedule,
): boolean {
  return buildBuyerPremiumPolicy(a).id === buildBuyerPremiumPolicy(b).id || flatEqualsBands(a, b);
}

/** A flat rate and a single band from 0 at the same rate charge the same. */
function flatEqualsBands(a: BuyerPremiumSchedule, b: BuyerPremiumSchedule): boolean {
  const one = (s: BuyerPremiumSchedule) =>
    s.kind === "flat" ? s.rate : s.bands.length === 1 ? (s.bands[0]?.rate ?? null) : null;
  const ra = one(a);
  const rb = one(b);
  return ra !== null && rb !== null && rateToTenThousandths(ra) === rateToTenThousandths(rb);
}

/**
 * Whether a lot's own premium charges something other than its sale's. Lots without their own
 * premium use the sale's and never differ.
 */
export function lotPremiumDiffersFromSale(
  lotRate: string | null | undefined,
  sale: BuyerPremiumSaleTerms,
): boolean {
  if (!isBuyerPremiumRate(lotRate)) return false;
  return !sameBuyerPremiumSchedule(
    { kind: "flat", rate: lotRate },
    saleBuyerPremiumSchedule(sale).schedule,
  );
}

/**
 * Whether a policy id names a banded (or, on invoices raised before banding, tiered) premium.
 * Ids look like `flat:0.2500`, `bands:[…]` or the older `tiered:[…]`.
 */
export function isBandedPremiumPolicyId(policyId: string | null | undefined): boolean {
  return Boolean(policyId && (policyId.startsWith("bands:") || policyId.startsWith("tiered:")));
}

/**
 * The premium a new sale is created with. Staff who chose bands or a flat rate keep their choice;
 * a sale created with neither gets the standard bands, so no new sale starts on a stray rate.
 */
export function newSaleBuyerPremium(input: {
  buyerPremiumRate?: string | undefined;
  buyerPremiumTiers?: readonly BuyerPremiumTier[] | null | undefined;
}): { buyerPremiumRate?: string; buyerPremiumTiers: BuyerPremiumTier[] | null } {
  if (input.buyerPremiumTiers !== undefined) {
    return {
      ...(input.buyerPremiumRate !== undefined ? { buyerPremiumRate: input.buyerPremiumRate } : {}),
      buyerPremiumTiers: input.buyerPremiumTiers ? [...input.buyerPremiumTiers] : null,
    };
  }
  if (input.buyerPremiumRate !== undefined) {
    return { buyerPremiumRate: input.buyerPremiumRate, buyerPremiumTiers: null };
  }
  return { buyerPremiumTiers: standardBuyerPremiumBands() };
}
