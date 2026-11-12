import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";
import { PURCHASE_PROBLEM_CATEGORIES, type PurchaseProblemCategory } from "@auction/domain";
import { z } from "zod";

/** The in-workspace form for reporting a problem with one paid purchase. */
export function purchaseProblemHref(lotId: string): string {
  return `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lotId)}/report-problem`;
}

/** What a reported problem is about, in the buyer's words. */
export const PURCHASE_PROBLEM_CATEGORY_LABEL: Record<PurchaseProblemCategory, string> = {
  not_as_described: "Not as described",
  damaged: "Damaged",
  not_received: "Not received",
  invoice_or_payment: "Invoice or payment",
  other: "Something else",
};

export const PURCHASE_PROBLEM_CATEGORY_OPTIONS = PURCHASE_PROBLEM_CATEGORIES.map((value) => ({
  value,
  label: PURCHASE_PROBLEM_CATEGORY_LABEL[value],
}));

export const PURCHASE_PROBLEM_MESSAGE_MIN = 10;
export const PURCHASE_PROBLEM_MESSAGE_MAX = 2000;

/** The form's values; the messages are the ones the fields and the error summary show. */
export const purchaseProblemFormSchema = z.object({
  category: z.enum(PURCHASE_PROBLEM_CATEGORIES, {
    errorMap: () => ({ message: "Choose what the problem is about" }),
  }),
  message: z
    .string()
    .trim()
    .min(PURCHASE_PROBLEM_MESSAGE_MIN, "Tell us what happened, in at least 10 characters")
    .max(PURCHASE_PROBLEM_MESSAGE_MAX, "Keep it to 2,000 characters or fewer"),
});
export type PurchaseProblemFormValues = z.infer<typeof purchaseProblemFormSchema>;

/** The control ids the error summary links to, in page order. */
export const PURCHASE_PROBLEM_FIELD_IDS = {
  category: "purchase-problem-category",
  message: "purchase-problem-message",
} as const;

/** A reported problem, as the purchase page shows it. */
export type PurchaseProblemView = {
  reference: string;
  category: PurchaseProblemCategory;
  reportedAt: Date;
};

export type PurchaseProblemPanelVm = {
  title: string;
  reference: string;
  facts: { label: string; value: string }[];
  /** What happens next, in one sentence. */
  nextStep: string;
};

/** What the purchase shows once a problem is reported: the reference and what happens next. */
export function purchaseProblemPanel(problem: PurchaseProblemView): PurchaseProblemPanelVm {
  return {
    title: "Problem reported",
    reference: problem.reference,
    facts: [
      { label: "About", value: PURCHASE_PROBLEM_CATEGORY_LABEL[problem.category] },
      { label: "Reported", value: formatDate(problem.reportedAt, LONDON_TIME_ZONE) },
    ],
    nextStep:
      "Our client services team has your report and will reply by email within two business days. Quote the reference if you write to us.",
  };
}
