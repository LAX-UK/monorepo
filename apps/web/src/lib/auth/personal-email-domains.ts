/**
 * Personal-domain detection used by the SE-P24 signup nudge: when a user
 * picks the "organisation" persona but supplies a personal email, we surface
 * an inline "Tip: use your work email…" message. Non-blocking — purely UX.
 */

export const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "yahoo.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
] as const;

export function isPersonalDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (domain.length === 0) return false;
  return (PERSONAL_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
