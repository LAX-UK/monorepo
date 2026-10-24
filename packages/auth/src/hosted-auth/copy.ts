/**
 * Wording shared by every hosted page: product names, the one-account promise and the
 * two-step verification vocabulary. Pages import from here so a rename is one edit and the
 * sign-in screens never drift into five names for the same account.
 *
 * "Two-step verification" is the feature; an "authenticator app" is only the thing that
 * produces the code. Never write "authenticator" as a noun on its own.
 */
export const HOSTED_COPY = {
  accountName: "LAX Account",
  oneAccount: "One LAX Account for LAX Bid, LAX Shop and lax.art.",
  /** The product names inside `oneAccount`, which the note sets in each product's colour. */
  oneAccountProducts: { bid: "LAX Bid", shop: "LAX Shop", art: "lax.art" },
  learnMore: "Learn more",
  continueTo: "Continue to",
  products: {
    bid: "LAX Bid",
    shop: "LAX Shop",
    shopAdmin: "LAX Shop Admin",
    art: "lax.art",
  },
  twoStep: {
    name: "two-step verification",
    title: "Two-step verification",
    app: "authenticator app",
    codeLabel: "6-digit code",
  },
} as const;
