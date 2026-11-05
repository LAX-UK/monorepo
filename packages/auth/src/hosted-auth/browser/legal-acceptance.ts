/** Must match LEGAL_ACCEPTANCE_FIELD, which the issuer reads when the account is created. */
const LEGAL_ACCEPTANCE_FIELD = "legalAcceptance";

/**
 * What the sign-up page tells the issuer about the statement it showed: which product's Terms
 * and Privacy notice were linked. Empty when the page carries no product, so nothing is claimed.
 */
export function legalAcceptanceFields(
  product: string | undefined,
): Record<string, { product: string }> {
  return product ? { [LEGAL_ACCEPTANCE_FIELD]: { product } } : {};
}
