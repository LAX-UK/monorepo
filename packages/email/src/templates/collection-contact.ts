import { GALLERY_CONTACT } from "@auction/branding";

/**
 * The line that says how to reach the place: its collections email, and its phone when it has one.
 * Never a placeholder number: with no phone it is the email alone.
 */
export function collectionContactLine(
  contactEmail: string | null | undefined,
  contactPhone?: string | null,
): string {
  // An email queued before the address was part of the variables has none: the gallery's.
  const email = contactEmail?.trim() || GALLERY_CONTACT.email;
  const phone = contactPhone?.trim();
  return phone ? `Questions? Email ${email} or call ${phone}.` : `Questions? Email ${email}.`;
}
