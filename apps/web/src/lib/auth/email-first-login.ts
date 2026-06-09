/** When unset or any value other than "false", the enumeration-safe email-first login is enabled. */
export function isEmailFirstLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_FIRST_LOGIN !== "false";
}
