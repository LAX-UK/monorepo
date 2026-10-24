/**
 * Who is signed in, for the account menu: name and email from the ID token the session already
 * holds. The token was verified at sign-in; here it is only read, never trusted for access.
 */
export type StaffIdentity = { name: string | null; email: string | null };

export function readIdTokenIdentity(idToken: string | null | undefined): StaffIdentity {
  const payload = idToken?.split(".")[1];
  if (!payload) return { name: null, email: null };
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return { name: null, email: null };
    const { name, email } = claims as { name?: unknown; email?: unknown };
    return {
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
    };
  } catch {
    return { name: null, email: null };
  }
}

/** The account menu's heading: the person's name, else their email, else their role. */
export function staffDisplayName(identity: StaffIdentity, roleLabel: string): string {
  return identity.name ?? identity.email ?? roleLabel;
}
