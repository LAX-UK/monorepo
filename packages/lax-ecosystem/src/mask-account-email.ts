/** Masks an email for display in cross-product sign-in notices (e.g. m***@example.com). */
export function maskAccountEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return trimmed;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
