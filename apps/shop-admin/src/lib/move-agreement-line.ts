import { PLACE_LABELS, placesSentence } from "@/server/domain/consignor-agreement.vm";
import type { AdminMoveAgreement } from "@auction/shop-contracts";
import { formatStaffDate, formatStaffMoney } from "@auction/staff-ui";

/*
 * The one line a move dialog shows about the work's consignor agreement (ZI-5, decision pack
 * 17 November 2026, section 1, option B). shop-api decides the state and whether the move may go
 * ahead; this only words it. When this person may not read the consignor's agreements, the line
 * names neither the consignor nor the terms.
 */

export type MoveAgreementLine = {
  tone: "info" | "warning" | "danger";
  text: string;
  /**
   * "Add agreement" or "Set consignor", when this person can act on it: both need
   * `consignor_agreement.manage`, which shop-api reports as `canAddAgreement`.
   */
  link: { label: string; href: string } | null;
};

/**
 * "Below the lowest price agreed (£2,000).": whole pounds without pence, as the design reads,
 * and "£2,000.50" when the agreement sets pence.
 */
export function lowestPriceWarning(pence: number): string {
  const amount = formatStaffMoney(pence);
  return `Below the lowest price agreed (${pence % 100 === 0 ? amount.replace(/\.00$/, "") : amount}).`;
}

/**
 * The line for the agreement, or null when there is nothing to say (LAX owns the work).
 * `registerId` is the work's From Zoho record, where its consignor is set.
 */
export function moveAgreementLine(
  view: AdminMoveAgreement,
  registerId: string | null,
): MoveAgreementLine | null {
  const place = PLACE_LABELS[view.place];
  const blocked = view.outcome === "blocked";
  const { agreement, consignor } = view;
  const setConsignor =
    view.canAddAgreement && registerId !== null
      ? { label: "Set consignor", href: `/from-zoho/${registerId}#consignor` }
      : null;

  switch (view.state) {
    case "lax_owns":
      return null;
    case "no_consignor":
      if (view.outcome === "checkbox_fallback") {
        return {
          tone: "warning",
          text: `No consignor is set for this work. Until ${formatStaffDate(view.checkboxFallbackUntil)}, confirm the consignor's agreement below.`,
          link: setConsignor,
        };
      }
      return {
        tone: blocked ? "danger" : "warning",
        text: blocked ? "Set who consigned this work first." : "No consignor is set for this work.",
        link: setConsignor,
      };
    case "in_force": {
      if (!agreement || !consignor) {
        return {
          tone: "info",
          text: `Covered by the consignor's agreement for ${place}.`,
          link: null,
        };
      }
      const until = agreement.endsOn
        ? `until ${formatStaffDate(agreement.endsOn)}`
        : "with no end date";
      // "signed" reads the day the agreement starts: an agreement records no separate signing day.
      return {
        tone: "info",
        text: `Covered by agreement with ${consignor.displayName}, signed ${formatStaffDate(agreement.startsOn)}, ${placesSentence(agreement.places)}, ${until}.`,
        link: null,
      };
    }
    default: {
      const who = consignor ? consignor.displayName : "this work's consignor";
      return {
        tone: blocked ? "danger" : "warning",
        text: `No agreement covers ${place} for ${who}.`,
        link:
          view.canAddAgreement && consignor
            ? { label: "Add agreement", href: `/clients/${consignor.partyId}#agreements` }
            : null,
      };
    }
  }
}
