/** Alert addresses are compared without case: `Ann@Example.com` and `ann@example.com` are one. */
export function normalizeAlertEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Shows enough of an address for its owner to recognise it, without revealing it to someone who
 * only holds the link: `robert@example.com` becomes `r•••@example.com`.
 */
export function maskAlertEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}
