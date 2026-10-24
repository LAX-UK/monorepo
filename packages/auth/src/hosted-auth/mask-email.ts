/**
 * Shows enough of an address for someone to recognise their own account on a shared device
 * without exposing it to whoever is looking at the screen: the first letter and the domain.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return "****";
  return `${trimmed.slice(0, 1)}***${trimmed.slice(at)}`;
}
