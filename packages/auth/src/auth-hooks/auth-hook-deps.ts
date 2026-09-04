import type { AuthPorts, EmailSender } from "../ports/index.js";

export type AuthHookDeps = {
  ports: Pick<
    AuthPorts,
    | "subjectStatusReader"
    | "sessionCountReader"
    | "accountLinkReader"
    | "phoneNumberStore"
    | "email"
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
        image?: string | null;
      }) => Promise<void>)
    | undefined;
  onAccountCreated?:
    | ((account: { userId: string; providerId: string }) => Promise<void>)
    | undefined;
  /**
   * When `true`, `databaseHooks.session.create.after` fires a `new-device-login` email
   * for every new session. Enabled in production; leave unset in tests.
   */
  enableNewDeviceLoginEmail?: boolean | undefined;
};

export type { EmailSender };
