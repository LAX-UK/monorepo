import type { AdminWhereItIs } from "@auction/shop-contracts";
import { formatStaffWhen } from "@auction/staff-ui";

/*
 * "Where it is" in words: the line under the place's badge, what follows it, and the one sentence
 * about what can happen next. The places and their badges are defined once in
 * `@auction/artwork-register-contracts`; this turns one into the text LAX Admin shows. Pure, so
 * the record page and the artwork page cannot say different things.
 */

export type WhereItIsLine = {
  /** Semibold, first: "Live on lax.art". */
  lead: string;
  /** Follows the lead on the same line, with its own punctuation: " since Mon 2 Nov". */
  trail?: string;
  note?: string;
};

export type WhereItIsContext = {
  /** The record is a print: prints are sold in runs on LAX Shop and take no offer. */
  isPrint?: boolean;
  /** When the lax.art draft was made, for a draft. */
  draftCreatedAt?: string | null;
  now?: Date;
};

const when = (value: string | null, now: Date | undefined) =>
  value ? formatStaffWhen(value, now) : null;

/** " · Mon 2 Nov, 15:20 GMT", or nothing when the history does not say. */
const dotWhen = (value: string | null, now: Date | undefined) => {
  const text = when(value, now);
  return text ? ` · ${text}` : "";
};

export function whereItIsLine(
  place: AdminWhereItIs,
  context: WhereItIsContext = {},
): WhereItIsLine {
  const { now } = context;
  if (context.isPrint) {
    return {
      lead: "Prints are sold in runs",
      trail: " on LAX Shop",
      note: "They are not offered on lax.art or at auction.",
    };
  }
  switch (place.key) {
    case "not_offered":
      return {
        lead: "Not offered",
        trail: " anywhere",
        note: "It can go on lax.art or into a LAX Bid sale. Only one place at a time.",
      };
    case "draft_lax_art": {
      const created = when(context.draftCreatedAt ?? null, now);
      return {
        lead: "Draft on lax.art",
        trail: created ? ` · created ${created}` : "",
        note: "Buyers can't see it yet. Write the description, check the images, then publish it from the artwork page.",
      };
    }
    case "lax_art":
      return {
        lead: "Live on lax.art",
        trail: place.since ? ` since ${when(place.since, now)}` : "",
        note: "Enquiries open. To move it to auction, use Offer at auction.",
      };
    case "draft_bid_lot":
      return {
        lead: "Draft lot in LAX Bid",
        note: "Buyers can't see it. Publishing the lot puts the artwork in the sale and holds it there.",
      };
    case "bid_sale":
      return {
        lead: "In a LAX Bid sale",
        note: "Withdraw the lot in LAX Bid to offer it anywhere else.",
      };
    case "private_sale":
      return {
        lead: "In a private sale",
        note: "Withdraw it there to offer it anywhere else.",
      };
    case "withdrawn":
      return {
        lead: "Withdrawn",
        trail: `${place.from ? ` from ${place.from}` : ""}${dotWhen(place.since, now)}`,
        note: "It can be offered again.",
      };
    case "sold":
      return {
        lead: "Sold",
        trail: `${place.from ? ` · ${place.from}` : ""}${dotWhen(place.since, now)}`,
        note: "Sold is final. Nothing can offer it again.",
      };
  }
}
