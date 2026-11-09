import { SOCIAL_SIGN_IN_PROVIDERS, type SocialSignInProvider } from "@auction/identity-contracts";

/** One row of the account table that can sign the person in. */
export type SignInAccountRow = {
  providerId: string;
  hasPassword: boolean;
  createdAt: Date;
  /** The address the provider reported, opened for reading; null when none was kept. */
  providerEmail?: string | null;
  /** The provider gave a private relay address. */
  providerEmailHidden?: boolean;
};

/** A passkey as the issuer holds it. No key material: only what the person is shown. */
export type PasskeyRow = {
  id: string;
  name: string | null;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export type SignInMethods = {
  hasPassword: boolean;
  social: Array<{
    provider: SocialSignInProvider;
    linkedAt: Date;
    providerEmail: string | null;
    hidden: boolean;
  }>;
  passkeys: PasskeyRow[];
};

export type UnlinkDecision = "allowed" | "not_linked" | "last_sign_in_method";

const PROVIDERS: ReadonlySet<string> = new Set(SOCIAL_SIGN_IN_PROVIDERS);

function isSocialProvider(providerId: string): providerId is SocialSignInProvider {
  return PROVIDERS.has(providerId);
}

/** The password and each linked Google or Apple account; any other row is not shown. */
export function describeSignInMethods(
  rows: readonly SignInAccountRow[],
  passkeys: readonly PasskeyRow[] = [],
): SignInMethods {
  return {
    hasPassword: rows.some((row) => row.providerId === "credential" && row.hasPassword),
    social: rows
      .filter((row) => isSocialProvider(row.providerId))
      .map((row) => ({
        provider: row.providerId as SocialSignInProvider,
        linkedAt: row.createdAt,
        providerEmail: row.providerEmail ?? null,
        hidden: row.providerEmailHidden ?? false,
      }))
      .sort((a, b) => a.linkedAt.getTime() - b.linkedAt.getTime()),
    passkeys: [...passkeys].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };
}

/**
 * A social sign-in may go only if something else still signs the person in afterwards: a
 * password, or another linked provider. The emailed sign-in link is deliberately not counted.
 * It is a way back in, not a method the person set up, so removing the only visible method
 * must send them to add a password first rather than rely on their inbox.
 */
export function decideUnlink(
  rows: readonly SignInAccountRow[],
  provider: SocialSignInProvider,
): UnlinkDecision {
  const methods = describeSignInMethods(rows);
  if (!methods.social.some((method) => method.provider === provider)) return "not_linked";
  const remaining = (methods.hasPassword ? 1 : 0) + methods.social.length - 1;
  return remaining > 0 ? "allowed" : "last_sign_in_method";
}
