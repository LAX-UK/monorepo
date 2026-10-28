import type { AcceptSubmissionBody, ProposeConsignmentTermsBody } from "@auction/validators";
import { z } from "zod";

/**
 * Accepting a submission is also the specialist's proposal to the seller: an estimate (low to
 * high), an optional reserve and the seller's commission. Money is held as pounds strings
 * ("1200.00", "" when empty) and the commission as a rate ("0.15") by the staff kit fields.
 */
export const acceptProposalFormSchema = z
  .object({
    reviewNotes: z.string().max(5000),
    estimateLow: z.string(),
    estimateHigh: z.string(),
    reservePrice: z.string(),
    commissionRate: z.string(),
  })
  .superRefine((values, ctx) => {
    const low = values.estimateLow ? Number(values.estimateLow) : null;
    const high = values.estimateHigh ? Number(values.estimateHigh) : null;
    if ((low === null) !== (high === null)) {
      ctx.addIssue({
        code: "custom",
        path: [low === null ? "estimateLow" : "estimateHigh"],
        message: "Give both the low and the high estimate",
      });
    } else if (low !== null && high !== null && high < low) {
      ctx.addIssue({
        code: "custom",
        path: ["estimateHigh"],
        message: "The high estimate must be at least the low estimate",
      });
    }
    if (values.commissionRate) {
      const rate = Number(values.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
        ctx.addIssue({
          code: "custom",
          path: ["commissionRate"],
          message: "Enter a commission between 0% and 99.99%",
        });
      }
    }
  });

export type AcceptProposalFormValues = z.infer<typeof acceptProposalFormSchema>;

export const EMPTY_ACCEPT_PROPOSAL: AcceptProposalFormValues = {
  reviewNotes: "",
  estimateLow: "",
  estimateHigh: "",
  reservePrice: "",
  commissionRate: "",
};

/** "0.125" as the API's percentage "12.5". */
function rateToPercent(rate: string): string {
  return String(Number((Number(rate) * 100).toFixed(2)));
}

/** The form's values as the accept request: empty figures are left out. */
export function acceptProposalBody(values: AcceptProposalFormValues): AcceptSubmissionBody {
  const body: AcceptSubmissionBody = {};
  const notes = values.reviewNotes.trim();
  if (notes) body.reviewNotes = notes;
  if (values.estimateLow) body.estimateLow = values.estimateLow;
  if (values.estimateHigh) body.estimateHigh = values.estimateHigh;
  if (values.reservePrice) body.reservePrice = values.reservePrice;
  if (values.commissionRate) body.commissionPercent = rateToPercent(values.commissionRate);
  return body;
}

/** Completing a proposal: the estimate and commission are what the seller is asked to accept. */
export const termsFormSchema = z
  .object({
    estimateLow: z.string().min(1, "Enter the low estimate"),
    estimateHigh: z.string().min(1, "Enter the high estimate"),
    reservePrice: z.string(),
    commissionRate: z.string().min(1, "Enter the seller's commission"),
  })
  .superRefine((values, ctx) => {
    if (values.estimateLow && values.estimateHigh) {
      if (Number(values.estimateHigh) < Number(values.estimateLow)) {
        ctx.addIssue({
          code: "custom",
          path: ["estimateHigh"],
          message: "The high estimate must be at least the low estimate",
        });
      }
    }
    if (values.commissionRate) {
      const rate = Number(values.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
        ctx.addIssue({
          code: "custom",
          path: ["commissionRate"],
          message: "Enter a commission between 0% and 99.99%",
        });
      }
    }
  });

export type TermsFormValues = z.infer<typeof termsFormSchema>;

export const EMPTY_TERMS: TermsFormValues = {
  estimateLow: "",
  estimateHigh: "",
  reservePrice: "",
  commissionRate: "",
};

/** The completed terms as the request staff send. */
export function proposeTermsBody(values: TermsFormValues): ProposeConsignmentTermsBody {
  return {
    estimateLow: values.estimateLow,
    estimateHigh: values.estimateHigh,
    ...(values.reservePrice ? { reservePrice: values.reservePrice } : {}),
    commissionPercent: rateToPercent(values.commissionRate),
  };
}
