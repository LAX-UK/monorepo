import { sellerProceeds } from "@auction/domain";
import { formatStaffDate, formatStaffMoney } from "@auction/staff-ui";

/**
 * When seller payouts began to follow each signed agreement: the release that settled sales from
 * their seller-terms snapshot. The notice shows for 30 days from here at most.
 */
export const SELLER_RULE_GO_LIVE = "2026-11-13T00:00:00.000Z";

/** How long the notice can be shown, from go-live, and how long a dismissal lasts. */
export const FINANCE_NOTICE_MAX_DAYS = 30;
const DAY_MS = 86_400_000;

/** A short, stable tag of a user id, so each person on a shared browser dismisses their own. */
function tag(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** The cookie that remembers one person has read the notice. */
export function financeNoticeCookieName(userId: string): string {
  return `lax_staff_notice_seller_rule_${tag(userId)}`;
}

/** The cookie a "Got it" writes: kept until the notice would have ended anyway. */
export function financeNoticeDismissCookie(userId: string, now: Date = new Date()): string {
  const ends = new Date(SELLER_RULE_GO_LIVE).getTime() + FINANCE_NOTICE_MAX_DAYS * DAY_MS;
  const maxAge = Math.max(
    0,
    Math.min(FINANCE_NOTICE_MAX_DAYS * 86_400, Math.ceil((ends - now.getTime()) / 1000)),
  );
  return `${financeNoticeCookieName(userId)}=1; Max-Age=${maxAge}; Path=/admin; SameSite=Lax`;
}

/** Whether this person should see the notice now. */
export function showFinanceNotice(input: { dismissed: boolean; now?: Date }): boolean {
  if (input.dismissed) return false;
  const now = (input.now ?? new Date()).getTime();
  const start = new Date(SELLER_RULE_GO_LIVE).getTime();
  return now >= start && now < start + FINANCE_NOTICE_MAX_DAYS * DAY_MS;
}

export type FinanceNoticeContent = {
  title: string;
  since: string;
  sections: { heading: string; body: string }[];
  readRule: string;
  dismiss: string;
};

/** The notice's words. The example is priced by the one calculator, not typed in. */
export function financeNoticeContent(now: Date = new Date()): FinanceNoticeContent {
  const example = sellerProceeds({
    hammerPence: 620_000,
    party: { kind: "agreement", commissionBps: 1200 },
    vat: "standard",
  });
  const figures =
    example.basis === "agreement"
      ? `commission ${formatStaffMoney(example.commissionPence)}, VAT on commission ${formatStaffMoney(example.vatPence)}, and the seller receives ${formatStaffMoney(example.netPence)}`
      : "";
  return {
    title: "Seller payouts now follow each signed agreement.",
    since: `Since ${formatStaffDate(SELLER_RULE_GO_LIVE, now)}. Payouts already paid haven't changed.`,
    sections: [
      {
        heading: "What changed",
        body: "Commission is charged on the hammer price at the rate in the seller's signed consignment agreement, with VAT added on the commission. The buyer's premium is kept by LAX and isn't part of the seller's proceeds.",
      },
      {
        heading: "What you'll see",
        body: "Each sale shows the hammer, the commission, the VAT on it and what the seller receives. A sale without a usable agreement is held with its reason, and the rest of the payout goes ahead.",
      },
      {
        heading: "For example",
        body: `A lot sells for ${formatStaffMoney(620_000)} under an agreement at 12%: ${figures}.`,
      },
    ],
    readRule: "Read the rule",
    dismiss: "Got it",
  };
}

/** The rule in full, shown when someone asks to read it. */
export const SELLER_RULE_TEXT = [
  "The seller's commission is the rate in their signed consignment agreement, charged on the hammer price only.",
  "VAT is charged on the commission at the standard rate while the company is VAT-registered.",
  "The seller receives the hammer less the commission and the VAT on it. Figures are fixed when the buyer's invoice is raised and are never recalculated on screen.",
  "A sale is held, not guessed, when there is no signed agreement, the seller hasn't accepted it, it has no commission, it is for another seller, the VAT setting is missing, or the deductions are more than the hammer.",
] as const;
