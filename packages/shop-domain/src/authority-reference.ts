import { ShopDomainError } from "./shop-domain-error.js";

export const AUTHORITY_REFERENCE_MAX_LENGTH = 200;

/** The reference to the artist's written authority: a document name, date or filing reference. */
export function assertAuthorityReference(reference: string | null | undefined): string {
  const trimmed = reference?.trim() ?? "";
  if (!trimmed) throw new ShopDomainError("Say where the artist's written authority is kept");
  if (trimmed.length > AUTHORITY_REFERENCE_MAX_LENGTH) {
    throw new ShopDomainError(
      `Keep the reference to ${AUTHORITY_REFERENCE_MAX_LENGTH} characters or fewer`,
    );
  }
  return trimmed;
}
