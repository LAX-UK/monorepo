import {
  LEGAL_ACCEPTANCE_PRODUCTS,
  type LegalAcceptanceProduct,
  type SignUpLegalAcceptance,
} from "../ports/legal-acceptance-recorder.js";

/**
 * The field the hosted sign-up and sign-in pages add to the request when it showed the person the Terms and
 * Privacy statement: `{ legalAcceptance: { product } }` in the email sign-up body, and the same
 * object in the social sign-in `additionalData`, which comes back with the provider callback.
 */
export const LEGAL_ACCEPTANCE_FIELD = "legalAcceptance";

const EMAIL_SIGN_UP_PATH = "/sign-up/email";

type EndpointContext = { path?: string | undefined; body?: unknown } | null | undefined;

function productFrom(value: unknown): LegalAcceptanceProduct | null {
  if (typeof value !== "object" || value === null) return null;
  const product = (value as { product?: unknown }).product;
  return LEGAL_ACCEPTANCE_PRODUCTS.find((known) => known === product) ?? null;
}

function fieldOf(container: unknown): unknown {
  return typeof container === "object" && container !== null
    ? (container as Record<string, unknown>)[LEGAL_ACCEPTANCE_FIELD]
    : undefined;
}

/**
 * What the person was shown when this account was created, or null when the request did not come
 * from a page that showed the statement (an unknown product value, or a sign-up from anywhere
 * else). A null result records nothing: no statement was shown, so none is claimed.
 */
export function signUpLegalAcceptance(
  subjectId: string,
  context: EndpointContext,
  oauthState: unknown,
): SignUpLegalAcceptance | null {
  if (context?.path === EMAIL_SIGN_UP_PATH) {
    const product = productFrom(fieldOf(context.body));
    return product ? { subjectId, product, source: "hosted_sign_up" } : null;
  }
  const product = productFrom(fieldOf(oauthState));
  return product ? { subjectId, product, source: "social_sign_up" } : null;
}
