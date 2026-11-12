import type { SignInMethodKinds } from "@auction/identity-contracts";
import type { KeyValueItem } from "@auction/staff-ui";

/**
 * The read-only "Sign-in methods" facts for a person: which kinds they have, and a passkey count
 * only when passkeys are offered. Kinds and counts, never an address, a name or a date. When the
 * issuer could not answer, one "Not available" fact stands in for all of them.
 */
export function signInMethodFacts(kinds: SignInMethodKinds | null): KeyValueItem[] {
  if (!kinds) return [{ label: "Sign-in methods", value: "Not available" }];
  return [
    { label: "Password", value: kinds.password ? "Set" : "Not set" },
    { label: "Google", value: kinds.google ? "Linked" : "Not linked" },
    { label: "Apple", value: kinds.apple ? "Linked" : "Not linked" },
    ...(kinds.passkeys === null
      ? []
      : [{ label: "Passkeys", value: String(kinds.passkeys), numeric: true }]),
  ];
}
