const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What to tell a person whose email address cannot be used, or null when it can. */
export function marketingEmailError(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address";
  if (!EMAIL_PATTERN.test(email)) {
    return "Enter an email address like name@example.com";
  }
  return null;
}
