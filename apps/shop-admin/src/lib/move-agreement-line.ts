import { placesSentence } from "@/server/domain/consignor-agreement.vm";
import { LONDON_TIME_ZONE, formatDate, resolveWallClock } from "@auction/datetime";
import type { AdminMoveAgreement } from "@auction/shop-contracts";
import { formatStaffMoney } from "@auction/staff-ui";

/*
 * The one line a move dialog shows about the work's consignor agreement (ZI-5, decision pack
 * 17 November 2026, section 1, option B). shop-api decides the state and whether the move may go
 * ahead; this only words it. When this person may not read the consignor's agreements, the line
 * names neither the consignor nor the terms.
 */

export type MoveAgreementLine = {
  tone: "info" | "warning" | "danger";
  text: string;
  /** "Add agreement" or "Set consignor", when this person can act on it. */
  link: { label: string; href: string } | null;
};

const PLACE_NAMES: Record<AdminMoveAgreement["place"], string> = {
  lax_bid: "LAX Bid",
  lax_art: "lax.art",
};

/** "3 Mar 2026": a London calendar day. */
export function agreementDayText(day: string): string {
  const date = resolveWallClock(day, "12:00", LONDON_TIME_ZONE);
  return date ? formatDate(date, LONDON_TIME_ZONE) : day;
}

/** "£2,000.00", the lowest price agreed. */
export function lowestPriceWarning(pence: number): string {
  return `Below the lowest price agreed (${formatStaffMoney(pence)}).`;
}

/**
 * The line for the agreement, or null when there is nothing to say (LAX owns the work).
 * `registerId` is the work's From Zoho record, where its consignor is set.
 */
export function moveAgreementLine(
  view: AdminMoveAgreement,
  registerId: string | null,
): MoveAgreementLine | null {
  const place = PLACE_NAMES[view.place];
  const blocked = view.outcome === "blocked";
  const { agreement, consignor } = view;
  const setConsignor =
    registerId !== null
      ? { label: "Set consignor", href: `/from-zoho/${registerId}#consignor` }
      : null;

  switch (view.state) {
    case "lax_owns":
      return null;
    case "no_consignor":
      if (view.outcome === "checkbox_fallback") {
        return {
          tone: "warning",
          text: `No consignor is set for this work. Until ${agreementDayText(view.checkboxFallbackUntil)}, confirm the consignor's agreement below.`,
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
        ? `until ${agreementDayText(agreement.endsOn)}`
        : "with no end date";
      return {
        tone: "info",
        text: `Covered by agreement with ${consignor.displayName}, signed ${agreementDayText(agreement.startsOn)}, ${placesSentence(agreement.places)}, ${until}.`,
        link: null,
      };
    }
    default: {
      const who = consignor ? consignor.displayName : "this work's consignor";
      const why = agreement ? reasonOf(view.state, agreement) : null;
      return {
        tone: blocked ? "danger" : "warning",
        text: `No agreement covers ${place} for ${who}${why ? `: ${why}` : ""}.`,
        link:
          view.canAddAgreement && consignor
            ? { label: "Add agreement", href: `/clients/${consignor.partyId}#agreements` }
            : null,
      };
    }
  }
}

function reasonOf(
  state: AdminMoveAgreement["state"],
  agreement: NonNullable<AdminMoveAgreement["agreement"]>,
): string | null {
  if (state === "not_started")
    return `the next one starts on ${agreementDayText(agreement.startsOn)}`;
  if (state === "expired" && agreement.endsOn)
    return `the last one ended on ${agreementDayText(agreement.endsOn)}`;
  if (state === "retired" && agreement.retiredOn)
    return `the last one was retired on ${agreementDayText(agreement.retiredOn)}`;
  return null;
}
