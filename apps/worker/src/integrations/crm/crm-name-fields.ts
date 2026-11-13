/** Zoho's limits for the standard name fields on Leads and Contacts. */
const LAST_NAME_MAX = 80;
const FIRST_NAME_MAX = 40;
/** What Last_Name holds when neither the name nor the email gives anything to use. */
const LAST_NAME_FALLBACK = "Customer";

/**
 * Split a display name into Zoho First_Name / Last_Name. Last_Name is mandatory on Leads and
 * Contacts, so it is never empty: a one-word name is the surname, no name falls back to the
 * email's local part, then to "Customer". Both are cut to Zoho's lengths.
 */
export function splitDisplayName(
  name: string,
  fallbackEmail: string,
): {
  firstName: string | null;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    const local = (fallbackEmail.split("@")[0] ?? "").trim();
    return { firstName: null, lastName: local.slice(0, LAST_NAME_MAX) || LAST_NAME_FALLBACK };
  }
  if (parts.length === 1) {
    return { firstName: null, lastName: (parts[0] ?? "").slice(0, LAST_NAME_MAX) };
  }
  return {
    firstName: parts.slice(0, -1).join(" ").slice(0, FIRST_NAME_MAX),
    lastName: (parts.at(-1) ?? "").slice(0, LAST_NAME_MAX) || LAST_NAME_FALLBACK,
  };
}
