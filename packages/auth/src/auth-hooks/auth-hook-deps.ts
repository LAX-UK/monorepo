import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";

export type AuthHookDeps = {
  db: Database;
  email?: IEmailService | undefined;
  /** Invoked from `databaseHooks.user.create.after` for every new auth user (email + OAuth). */
  onUserCreated?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
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
