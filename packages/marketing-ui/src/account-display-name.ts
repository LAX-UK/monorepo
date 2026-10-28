/**
 * The short name shown beside the avatar in a header: the first name, never the full name in
 * capitals. Falls back to the part of the email before the "@" when there is no name.
 */
export function accountTriggerName(displayName: string, email: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  if (first) return first;
  return email.split("@")[0]?.trim() ?? "";
}
