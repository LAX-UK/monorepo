import type { AuthPorts, EmailSender } from "../ports/index.js";

export type AuthHookDeps = {
  ports: Pick<
    AuthPorts,
    | "subjectStatusReader"
    | "accountLinkReader"
    | "phoneNumberStore"
    | "email"
    | "securityNotices"
    | "legalAcceptance"
    | "twoFactorPolicyStore"
    | "events"
  >;
  /** Invoked from `databaseHooks.user.create.after` for every new auth user (email + OAuth). */
  onUserCreated?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
  /** Invoked from `databaseHooks.user.update.after` when canonical profile fields change. */
  onUserUpdated?:
    | ((authUser: {
        id: string;
        email: string;
        name: string;
        phoneNumber?: string | null;
        phoneNumberVerified?: boolean | null;
        image?: string | null;
      }) => Promise<void>)
    | undefined;
  onAccountCreated?:
    | ((account: { userId: string; providerId: string }) => Promise<void>)
    | undefined;
  /**
   * When `true`, `databaseHooks.session.create.after` reports every new session so the issuer
   * can email about sign-ins from a device it has not seen recently. Enabled in production;
   * leave unset in tests.
   */
  enableNewDeviceLoginEmail?: boolean | undefined;
  /** Hash of the private device marker a request carries, or null; attached to sign-in reports. */
  readDeviceHash?: ((headers: Headers | undefined) => string | null) | undefined;
  /**
   * Forgets that the person has signed in from the browser holding this marker hash. Called when
   * that browser signs itself out, so its marker no longer vouches for its next sign-in.
   */
  forgetDeviceMarker?:
    | ((input: { userId: string; deviceHash: string }) => Promise<void>)
    | undefined;
  /** When true, reject new auth user rows (email + OAuth) at `user.create.before`. */
  blockNewUserRegistration?: boolean | undefined;
  /**
   * Ends every session and product token of a person, as a password reset does. Used when a
   * provider proves an email whose password was set before it was confirmed (SM5).
   */
  revokeAllSessions?: ((userId: string) => Promise<number>) | undefined;
  /**
   * Called when the staff, two-step or email facts a Google or Apple sign-in depends on cannot
   * be read. The sign-in is stopped (it fails closed), so this is what an alert watches.
   */
  onSocialPolicyReadFailed?: ((error: unknown) => void) | undefined;
};

export type { EmailSender };
