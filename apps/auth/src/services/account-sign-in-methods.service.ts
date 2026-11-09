import type { SecurityNoticePublisher } from "@auction/auth";
import {
  type AccountPasskey,
  type AccountSignInMethodError,
  type AccountSignInMethodsResponse,
  PASSKEY_NAME_MAX_LENGTH,
  type SocialSignInProvider,
  isValidPasskeyName,
} from "@auction/identity-contracts";
import type { ReauthRequired } from "./account-contact.service.js";
import type { DurableSecurityEffects } from "./durable-security-effects.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";
import type { PasskeyRow } from "./sign-in-method-rules.js";

const ACCOUNT_SIGN_IN_METHODS_PATH = "account-sign-in-methods";

/**
 * The refusals removing a social sign-in can end in; the rate limit is applied before the service
 * runs, and the passkey and availability refusals belong to adding methods, which come later.
 */
export type AccountSignInMethodRefusal = Extract<
  AccountSignInMethodError,
  "last_sign_in_method" | "not_linked"
>;

const REFUSALS: ReadonlySet<string> = new Set<AccountSignInMethodRefusal>([
  "last_sign_in_method",
  "not_linked",
]);

/** Which methods this environment offers; a method that is off is never shown as one to add. */
export type SignInMethodsAvailability = AccountSignInMethodsResponse["available"];

const UNNAMED_PASSKEY = "Passkey";
/** Transports that mean a separate security key rather than the device itself. */
const SECURITY_KEY_TRANSPORTS: ReadonlySet<string> = new Set(["usb", "nfc", "ble"]);

/**
 * A passkey as the person sees it. It is "synced" when a password manager copies it to their
 * other devices (the authenticator reports it as backed up), and a security key when it can only
 * be reached over USB, NFC or Bluetooth.
 */
export function presentPasskey(row: PasskeyRow): AccountPasskey {
  const transports = (row.transports ?? "")
    .split(",")
    .map((transport) => transport.trim())
    .filter(Boolean);
  const separateKey =
    transports.length > 0 &&
    transports.every((transport) => SECURITY_KEY_TRANSPORTS.has(transport));
  return {
    id: row.id,
    name: (row.name?.trim() || UNNAMED_PASSKEY).slice(0, PASSKEY_NAME_MAX_LENGTH),
    synced: row.deviceType === "multiDevice" && row.backedUp,
    kind: separateKey ? "security_key" : "platform",
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export type AccountSignInMethodsPorts = {
  operations: Pick<
    IdentityOperationsService,
    "listSessions" | "readSignInMethods" | "unlinkSocialSignIn" | "removePasskey" | "renamePasskey"
  >;
  /** Ends relying-party sessions and tokens, retrying from the durable outbox if that fails. */
  durable: Pick<DurableSecurityEffects, "settle">;
  /** Tells the account's email about the change; it never throws and never undoes the change. */
  notices: SecurityNoticePublisher;
  /** What this environment offers. Nothing is offered unless it is named here. */
  available?: SignInMethodsAvailability;
};

export type RenamePasskeyResult =
  | { ok: true; passkey: AccountPasskey }
  | { ok: false; kind: "not_linked" | "invalid_name" };

export type RemovePasskeyResult =
  | { ok: true; revokedSessions: number }
  | ReauthRequired
  | { ok: false; kind: AccountSignInMethodRefusal };

export type UnlinkSignInMethodResult =
  | { ok: true; unlinked: SocialSignInProvider; revokedSessions: number }
  | ReauthRequired
  | { ok: false; kind: AccountSignInMethodRefusal };

/**
 * Showing and removing the ways a person signs in, from LAX Account.
 *
 * Removing a social sign-in needs a recent sign-in, checked against the caller's own session
 * exactly as for the other sensitive changes, and it is refused when it would leave no password
 * or other provider behind. Every other sign-in is ended, because whoever else held the account
 * through that method must not keep access, while the sign-in making the change stays. The
 * person is emailed afterwards, naming the provider and the browser.
 */
export class AccountSignInMethodsService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountSignInMethodsPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async read(subjectId: string): Promise<AccountSignInMethodsResponse> {
    const methods = await this.ports.operations.readSignInMethods(subjectId);
    return {
      hasPassword: methods.hasPassword,
      social: methods.social.map((method) => ({
        provider: method.provider,
        linkedAt: method.linkedAt.toISOString(),
        providerEmail: method.providerEmail,
        hidden: method.hidden,
      })),
      passkeys: methods.passkeys.map(presentPasskey),
      available: this.ports.available ?? { google: false, apple: false, passkey: false },
    };
  }

  /**
   * Gives one of the person's passkeys a name they can tell it by. A name is a short line of
   * text: trimmed, one to forty characters, with no control or format characters (see
   * `isValidPasskeyName`). Another
   * person's passkey answers as not linked. No recent sign-in is needed: a name changes nothing
   * about how anyone signs in.
   */
  async renamePasskey(
    subjectId: string,
    passkeyId: string,
    rawName: string,
  ): Promise<RenamePasskeyResult> {
    const name = rawName.trim();
    if (!isValidPasskeyName(name)) return { ok: false, kind: "invalid_name" };
    const renamed = await this.ports.operations.renamePasskey(subjectId, passkeyId, name);
    return renamed
      ? { ok: true, passkey: presentPasskey(renamed) }
      : { ok: false, kind: "not_linked" };
  }

  /**
   * Removes one of the person's passkeys. It needs a recent sign-in, is refused when it would
   * leave no password, provider or other passkey (SM7), and, exactly as removing Google, ends
   * every other sign-in and the products' tokens (the usual reason is a lost or sold device) and
   * emails the person, naming the passkey and the browser.
   */
  async removePasskey(
    subjectId: string,
    currentSessionId: string,
    passkeyId: string,
  ): Promise<RemovePasskeyResult> {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    let outcome: { revokedSessionIds: string[]; name: string | null };
    try {
      outcome = await this.ports.operations.removePasskey(subjectId, passkeyId, currentSessionId);
    } catch (error) {
      if (error instanceof IdentityOperationError && REFUSALS.has(error.code)) {
        return { ok: false, kind: error.code as AccountSignInMethodRefusal };
      }
      throw error;
    }
    await this.ports.durable.settle(ACCOUNT_SIGN_IN_METHODS_PATH, {
      kind: "revoke_tokens_except_session",
      userId: subjectId,
      keepSessionId: currentSessionId,
    });
    void this.ports.notices.notify({
      kind: "sign_in_method_removed",
      userId: subjectId,
      at: this.now(),
      method: "passkey",
      detail: outcome.name,
      userAgent: current.userAgent,
    });
    return { ok: true, revokedSessions: outcome.revokedSessionIds.length };
  }

  async unlink(
    subjectId: string,
    currentSessionId: string,
    provider: SocialSignInProvider,
  ): Promise<UnlinkSignInMethodResult> {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    let revokedSessionIds: string[];
    // The address is read before the link goes, so the email can name what was removed.
    const removedAddress = await this.ports.operations
      .readSignInMethods(subjectId)
      .then(
        (methods) =>
          methods.social.find((method) => method.provider === provider)?.providerEmail ?? null,
      )
      .catch(() => null);
    try {
      ({ revokedSessionIds } = await this.ports.operations.unlinkSocialSignIn(
        subjectId,
        provider,
        currentSessionId,
      ));
    } catch (error) {
      if (error instanceof IdentityOperationError && REFUSALS.has(error.code)) {
        return { ok: false, kind: error.code as AccountSignInMethodRefusal };
      }
      throw error;
    }
    // Relying-party sessions (Bid, Shop, Art) can outlive the issuer session they came from, so
    // they are ended even when no issuer session was left to delete.
    await this.ports.durable.settle(ACCOUNT_SIGN_IN_METHODS_PATH, {
      kind: "revoke_tokens_except_session",
      userId: subjectId,
      keepSessionId: currentSessionId,
    });
    void this.ports.notices.notify({
      kind: "sign_in_method_removed",
      userId: subjectId,
      at: this.now(),
      method: provider,
      detail: removedAddress,
      userAgent: current.userAgent,
    });
    return { ok: true, unlinked: provider, revokedSessions: revokedSessionIds.length };
  }
}
