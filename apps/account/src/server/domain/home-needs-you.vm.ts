import { formatMinorUnits } from "@/lib/format-money";
import type { AttentionKind, AttentionRowVm } from "./portfolio-attention.vm";

/** Lines shown on Home before the rest collapse into "N more". */
export const NEEDS_YOU_LIMIT = 3;

export type NeedsYouActionVm = {
  /** Full label, for desktop and for assistive technology. */
  label: string;
  /** The shorter label shown on a phone. */
  shortLabel: string;
  /** Whether the button stays visible on a phone, where the whole row is the tap target. */
  onPhone: boolean;
  /** The one teal primary of the card; every other action is an outline button. */
  primary: boolean;
};

export type NeedsYouLineVm = {
  key: string;
  title: string;
  meta: string;
  href: string;
  external: boolean;
  action: NeedsYouActionVm | null;
};

export type NeedsYouVm = { lines: NeedsYouLineVm[]; moreCount: number };

/** Payments come first: they are the one thing a person can lose money or standing over. */
const PAYMENT_KINDS: ReadonlySet<AttentionKind> = new Set(["pay", "held", "confirming"]);

const owedAmount = (row: AttentionRowVm): string | null =>
  row.owed ? formatMinorUnits(row.owed.amount, row.owed.currency) : null;

const META_SUFFIX: Record<AttentionKind, (row: AttentionRowVm) => string | null> = {
  pay: owedAmount,
  held: (row) => [owedAmount(row), "waiting on identity checks"].filter(Boolean).join(" · "),
  confirming: () => "payment being confirmed",
  track: () => "awaiting shipment",
  payout: () => "payout pending",
  invoice: () => "invoice not available yet",
};

function titleOf(row: AttentionRowVm): string {
  return row.kind === "held" ? `Pay for ${row.workTitle}` : row.text;
}

function metaOf(row: AttentionRowVm): string {
  const suffix = META_SUFFIX[row.kind](row);
  return suffix ? `${row.productLabel} · ${suffix}` : row.productLabel;
}

type ActionTemplate = Omit<NeedsYouActionVm, "primary">;

const ACTIONS: Partial<Record<AttentionKind, (row: AttentionRowVm) => ActionTemplate>> = {
  pay: (row) => ({ label: `Pay in ${row.productLabel}`, shortLabel: "Pay", onPhone: true }),
  held: (row) => ({
    label: `Verify in ${row.productLabel}`,
    shortLabel: "Verify",
    onPhone: true,
  }),
  track: () => ({ label: "Track", shortLabel: "Track", onPhone: false }),
};

/**
 * The Home "Needs you" card, from the same rows the Portfolio list reads: payments first, in
 * the order the products gave them, then everything else. The first line that asks for a
 * payment carries the card's one primary button.
 */
export function buildNeedsYou(
  rows: readonly AttentionRowVm[],
  limit: number = NEEDS_YOU_LIMIT,
): NeedsYouVm {
  const ordered = [
    ...rows.filter((row) => PAYMENT_KINDS.has(row.kind)),
    ...rows.filter((row) => !PAYMENT_KINDS.has(row.kind)),
  ];
  const firstPayment = ordered.findIndex((row) => row.kind === "pay" || row.kind === "held");
  const lines = ordered.slice(0, limit).map((row, index): NeedsYouLineVm => {
    const template = ACTIONS[row.kind]?.(row);
    return {
      key: row.key,
      title: titleOf(row),
      meta: metaOf(row),
      href: row.href,
      external: row.external,
      action: template ? { ...template, primary: index === firstPayment } : null,
    };
  });
  return { lines, moreCount: Math.max(0, ordered.length - limit) };
}
