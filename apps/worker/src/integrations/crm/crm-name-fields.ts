/** Split a display name into Zoho First_Name / Last_Name (Contacts require Last_Name). */
export function splitDisplayName(
  name: string,
  fallbackEmail: string,
): {
  firstName: string | null;
  lastName: string;
} {
  const trimmed = name.trim();
  if (!trimmed) {
    const local = fallbackEmail.split("@")[0] ?? "Customer";
    return { firstName: null, lastName: local.slice(0, 80) || "Customer" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: null, lastName: parts[0] ?? "Customer" };
  }
  return {
    firstName: parts.slice(0, -1).join(" ").slice(0, 40),
    lastName: parts.at(-1)?.slice(0, 80) ?? "Customer",
  };
}
