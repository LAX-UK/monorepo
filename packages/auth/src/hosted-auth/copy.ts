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
  /** The one-account promise, as LAX Account words it. */
  oneAccountTitle: "One account for all of LAX",
  oneAccountLead: "Sign in once to manage your details, security and works across",
  /** The product names the promise lists, each set in its own product's colour. */
  oneAccountProducts: { bid: "LAX Bid", shop: "LAX Shop", art: "lax.art" },
  /** Quiet line under the heading when the person came from a product: "to continue to LAX Bid". */
  continueTo: "to continue to",
  /**
   * Who provides the account, for the footer. The issuer may not import `@auction/branding`, so
   * this is a copy of `legalOperatorSentence("account")`; `packages/branding/tests` fails when it
   * drifts from the registry.
   */
  accountOperators:
    "LAX Account is provided by London Auction Xchange LTD and London Art Exchange Ltd.",
  footer: { privacy: "Privacy", help: "Help" },
  signUpAgreement: {
    lead: "By creating an account you agree to the",
    terms: "Terms",
    privacy: "Privacy notice",
  },
  theme: { toDark: "Switch to dark theme", toLight: "Switch to light theme" },
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
