/**
 * The line that says how to reach the place: its collections email, and its phone when it has one.
 * Never a placeholder number: with no phone it is the email alone.
 */
export function collectionContactLine(contactEmail: string, contactPhone?: string | null): string {
  const phone = contactPhone?.trim();
  return phone
    ? `Questions? Email ${contactEmail} or call ${phone}.`
    : `Questions? Email ${contactEmail}.`;
}
