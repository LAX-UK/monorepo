const ENQUIRY_REFERENCE = /^E-\d+$/;

/**
 * The reference the shop API gives a stored enquiry ("E-2041"), read from its response. Null when
 * the response has none (an older API, or a submission it dropped as spam), so the confirmation
 * never promises a copy that was not sent.
 */
export function readEnquiryReference(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const reference = (body as { reference?: unknown }).reference;
  return typeof reference === "string" && ENQUIRY_REFERENCE.test(reference) ? reference : null;
}
