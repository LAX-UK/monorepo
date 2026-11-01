const DEFAULT_WHITE_LABEL_URL = "https://auctions.lax.bid";

/** Where bidding on ATG-run sales takes place. Configurable per environment. */
export function atgWhiteLabelUrl(): URL {
  const configured = process.env.ATG_WHITE_LABEL_BASE_URL?.trim();
  try {
    return new URL(configured || DEFAULT_WHITE_LABEL_URL);
  } catch {
    return new URL(DEFAULT_WHITE_LABEL_URL);
  }
}

/** Visitor-facing line for a lot that is live on the ATG-run site: "Live · bid on auctions.lax.bid". */
export function atgLiveBidLabel(): string {
  return `Live · bid on ${atgWhiteLabelUrl().host}`;
}

/** Visitor-facing line for an ATG-run lot whose result is not yet known. */
export const ATG_RESULT_PENDING_LABEL = "Result to follow";
