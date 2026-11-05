/** The LAX products whose Terms and Privacy notice a person can be shown at sign-up. */
export const LEGAL_ACCEPTANCE_PRODUCTS = ["account", "bid", "shop", "art"] as const;
export type LegalAcceptanceProduct = (typeof LEGAL_ACCEPTANCE_PRODUCTS)[number];

/** How the person created the account: the hosted email form or a Google/Apple button. */
export type LegalAcceptanceSource = "hosted_sign_up" | "social_sign_up";

export type SignUpLegalAcceptance = {
  subjectId: string;
  /** The product whose Terms and Privacy notice the sign-up page linked. */
  product: LegalAcceptanceProduct;
  source: LegalAcceptanceSource;
};

/**
 * Keeps the record that a person accepted the Terms and Privacy notice shown when they created
 * their account. The implementation decides the document versions and the company they belong to.
 */
export interface LegalAcceptanceRecorder {
  recordSignUp(acceptance: SignUpLegalAcceptance): Promise<void>;
}
