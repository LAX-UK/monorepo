import type {
  DealRecord,
  DealSettlementFollowUp,
} from "@/lib/data/http/admin-private-sales.schema";
import type { DealArtworkLock } from "@auction/validators";

/** What a settled deal's "artwork not marked sold" notice says, and what staff can do about it. */
export type SettlementNoticeView = {
  tone: "warning" | "danger";
  title: string;
  /** The register's own words come first when it shows the artwork somewhere else. */
  body: string;
  /** "Try again" only makes sense while the register has nothing against it. */
  canRetry: boolean;
  /** Where to go to see the artwork's other place, when the register has a link. */
  link: { label: string; href: string } | null;
};

export const SETTLEMENT_ITEM_LABEL = "The artwork's record wasn't marked sold";
export const SETTLEMENT_URGENT_LABEL = "Possible double sale";

const URGENT_NEXT_STEP =
  "It may have been sold twice. Talk to the Sales manager before anything else moves.";
const ELSEWHERE_FALLBACK =
  "The register shows this artwork somewhere else, so it can't be offered.";

const ZOHO_NOTE =
  'Until it is marked sold, Zoho shows "In a private sale" instead of "Sold privately".';

function linkOf(lock: DealArtworkLock | null): SettlementNoticeView["link"] {
  const link = lock?.link;
  return link?.href ? { label: link.label, href: link.href } : null;
}

/**
 * The notice on a settled deal whose artwork the register does not show as sold. Urgent means the
 * register shows it somewhere else: nothing here moves it, and the words say who decides.
 */
export function settlementNotice(
  deal: Pick<DealRecord, "reference">,
  followUp: DealSettlementFollowUp,
  formatDate: (iso: string) => string,
): SettlementNoticeView {
  const title = `${deal.reference} settled, but the artwork's record couldn't be marked sold. Check where it is.`;
  if (followUp.severity === "urgent") {
    return {
      tone: "danger",
      title,
      body: `${followUp.lock?.message ?? ELSEWHERE_FALLBACK} ${URGENT_NEXT_STEP}`,
      canRetry: false,
      link: linkOf(followUp.lock),
    };
  }
  return {
    tone: "warning",
    title,
    body: `The register didn't record the sale when the deal settled on ${formatDate(followUp.settledAt)}. ${ZOHO_NOTE}`,
    canRetry: followUp.canRetry,
    link: null,
  };
}

/** The line a list row shows in place of the stage's next step. */
export function settlementRowLabel(severity: "normal" | "urgent"): string {
  return severity === "urgent" ? SETTLEMENT_URGENT_LABEL : SETTLEMENT_ITEM_LABEL;
}

export const MARK_SOLD_SUCCESS = (reference: string): string =>
  `Artwork marked sold · ${reference}`;

const MARK_SOLD_ERROR_COPY: Readonly<Record<string, string>> = {
  artwork_register_busy:
    "The artwork register didn't answer. The deal is unaffected. Try again in a moment.",
  not_settled: "Only a settled deal's artwork is marked sold.",
};

/**
 * What a failed "Try again" says. The register's own words win when it shows the artwork elsewhere;
 * the busy-register line differs from the other forms' because nothing was being converted.
 */
export function markSoldErrorMessage(
  code: string | undefined,
  status: number | undefined,
  apiMessage: string | undefined,
  fallback: (code: string | undefined, status: number | undefined, message?: string) => string,
): string {
  if (code === "artwork_unavailable" && apiMessage) return apiMessage;
  return (code && MARK_SOLD_ERROR_COPY[code]) || fallback(code, status, apiMessage);
}
