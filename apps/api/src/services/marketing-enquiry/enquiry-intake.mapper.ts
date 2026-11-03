import { type EnquiryIntent, deriveLegacyEnquiryIntent } from "@auction/domain";
import type { NewMarketingEnquiry } from "@auction/persistence/interfaces";
import type { EnquiryIntakeInput } from "@auction/validators";

/** What the sender's account adds to an enquiry they sent while signed in. */
export type EnquirerAccount = { userId: string; legalEntityId?: string | undefined };

const BUDGET_LABELS = {
  under_10000: "under £10,000",
  "10000_to_50000": "£10,000 to £50,000",
  "50000_to_250000": "£50,000 to £250,000",
  over_250000: "over £250,000",
  prefer_not_to_say: "budget not given",
} as const;

function joinSentence(parts: (string | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(", ");
}

/**
 * The text staff read first: a one-line summary of the work or the wish, then any notes the
 * sender added. The detail itself lives in typed columns; this keeps the list and the inbox legible.
 */
function privateSaleMessage(input: EnquiryIntakeInput): string {
  if (input.intent === "private_sale_sell") {
    const summary = `Selling privately: ${joinSentence([input.artist, input.title])}`;
    return input.message ? `${summary}\n\n${input.message}` : summary;
  }
  if (input.intent === "private_sale_buy") {
    const summary = `Buying privately: ${input.lookingFor} (${BUDGET_LABELS[input.budgetBand]})`;
    return input.message ? `${summary}\n\n${input.message}` : summary;
  }
  return input.message;
}

export function enquiryIntentOf(input: EnquiryIntakeInput): EnquiryIntent {
  return input.intent === "general"
    ? deriveLegacyEnquiryIntent({ topic: input.topic, message: input.message })
    : input.intent;
}

/**
 * Turns whichever payload arrived into the one enquiry shape that is stored. The department is
 * only known on the private sell path; routing and the account link are added by the caller.
 */
export function toNewEnquiry(
  input: EnquiryIntakeInput,
  account?: EnquirerAccount,
): Omit<NewMarketingEnquiry, "assignedToUserId"> {
  const intent = enquiryIntentOf(input);
  const base = {
    intent,
    name: input.name,
    email: input.email,
    phone: input.phone,
    sourcePage: input.sourcePage,
    marketingOptIn: input.marketingOptIn,
    userId: account?.userId,
    legalEntityId: account?.legalEntityId,
  };
  if (input.intent === "private_sale_sell") {
    return {
      ...base,
      topic: "selling",
      message: privateSaleMessage(input),
      departmentSlug: input.departmentSlug,
      privateSale: {
        artist: input.artist,
        title: input.title,
        medium: input.medium ?? null,
        size: input.size ?? null,
        locationTown: input.locationTown,
        locationCountry: input.locationCountry,
        priceInMindMinor: input.priceInMindMinor ?? null,
        lookingFor: null,
        budgetBand: null,
        timing: null,
        contactPreference: input.contactPreference,
      },
    };
  }
  if (input.intent === "private_sale_buy") {
    return {
      ...base,
      topic: "buying",
      message: privateSaleMessage(input),
      privateSale: {
        artist: null,
        title: null,
        medium: null,
        size: null,
        locationTown: null,
        locationCountry: null,
        priceInMindMinor: null,
        lookingFor: input.lookingFor,
        budgetBand: input.budgetBand,
        timing: input.timing,
        contactPreference: input.contactPreference,
      },
    };
  }
  return { ...base, topic: input.topic, message: input.message };
}
