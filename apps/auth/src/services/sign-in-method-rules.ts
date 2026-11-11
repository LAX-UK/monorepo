import {
  SOCIAL_SIGN_IN_PROVIDERS,
  type SignInMethodKinds,
  type SocialSignInProvider,
} from "@auction/identity-contracts";

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

/**
 * What staff may read about how a person signs in: which kinds they have and how many passkeys,
 * and nothing that identifies a method (no provider address, passkey name or credential id).
 * The passkey count is left out (null) when passkeys are not offered, so staff see nothing
 * about them.
 */
export function summariseSignInMethodKinds(
  methods: SignInMethods,
  passkeysOffered: boolean,
): SignInMethodKinds {
  const linked = (provider: SocialSignInProvider) =>
    methods.social.some((method) => method.provider === provider);
  return {
    password: methods.hasPassword,
    google: linked("google"),
    apple: linked("apple"),
    passkeys: passkeysOffered ? methods.passkeys.length : null,
  };
}

export type RemovePasskeyDecision = "allowed" | "last_sign_in_method";

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
 * password, another linked provider or a passkey (SM7). The emailed sign-in link is deliberately
 * not counted.
 * It is a way back in, not a method the person set up, so removing the only visible method
 * must send them to add a password first rather than rely on their inbox.
 */
export function decideUnlink(
  rows: readonly SignInAccountRow[],
  provider: SocialSignInProvider,
  /** How many passkeys the person holds, read under the same lock as `rows`. */
  passkeyCount = 0,
): UnlinkDecision {
  const methods = describeSignInMethods(rows);
  if (!methods.social.some((method) => method.provider === provider)) return "not_linked";
  const remaining = (methods.hasPassword ? 1 : 0) + methods.social.length - 1 + passkeyCount;
  return remaining > 0 ? "allowed" : "last_sign_in_method";
}

/**
 * A passkey may go only if something else still signs the person in afterwards: a password, a
 * linked provider or another passkey (SM7). `passkeyCount` is how many passkeys they hold now,
 * the one being removed included, read under the same lock as `rows`. The emailed sign-in link is
 * not counted, for the same reason as when a provider goes.
 */
export function decideRemovePasskey(
  rows: readonly SignInAccountRow[],
  passkeyCount: number,
): RemovePasskeyDecision {
  const methods = describeSignInMethods(rows);
  const remaining = (methods.hasPassword ? 1 : 0) + methods.social.length + (passkeyCount - 1);
  return remaining > 0 ? "allowed" : "last_sign_in_method";
}
