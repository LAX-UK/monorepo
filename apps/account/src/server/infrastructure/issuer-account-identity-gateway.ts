import {
  ACCOUNT_ACTION_PATH,
  ACCOUNT_ADDRESSES_CREATE_PATH,
  ACCOUNT_ADDRESSES_DEFAULT_PATH,
  ACCOUNT_ADDRESSES_DELETE_PATH,
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_ADDRESSES_UPDATE_PATH,
  ACCOUNT_ADDRESS_ERRORS,
  ACCOUNT_BACKUP_CODES_REGENERATE_PATH,
  ACCOUNT_CONTACT_ERRORS,
  ACCOUNT_CONTACT_PATH,
  ACCOUNT_DELETION_CANCEL_PATH,
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_REQUEST_PATH,
  ACCOUNT_EMAIL_CHANGE_CANCEL_PATH,
  ACCOUNT_EMAIL_CHANGE_CONFIRM_PATH,
  ACCOUNT_EMAIL_CHANGE_PATH,
  ACCOUNT_PASSWORD_CHANGE_PATH,
  ACCOUNT_PASSWORD_ERRORS,
  ACCOUNT_PHONE_REMOVE_PATH,
  ACCOUNT_PHONE_SEND_CODE_PATH,
  ACCOUNT_PHONE_VERIFY_PATH,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROFILE_UPDATE_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  ACCOUNT_SESSIONS_PATH,
  ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH,
  ACCOUNT_SESSIONS_REVOKE_PATH,
  ACCOUNT_SIGN_IN_METHODS_INTENT_PATH,
  ACCOUNT_SIGN_IN_METHODS_PATH,
  ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
  ACCOUNT_SIGN_IN_METHOD_ERRORS,
  ACCOUNT_TIME_ZONE_DEVICE_PATH,
  ACCOUNT_TIME_ZONE_ERRORS,
  ACCOUNT_TIME_ZONE_PATH,
  ACCOUNT_TIME_ZONE_UPDATE_PATH,
  type AccountAddressError,
  type AccountContactError,
  type AccountPasswordError,
  type AccountSignInMethodError,
  type AccountTimeZoneChange,
  type AccountTimeZoneError,
  accountActionIntentSchema,
  accountAddressDeletedSchema,
  accountAddressResultSchema,
  accountAddressesSchema,
  accountBackupCodesSchema,
  accountContactSchema,
  accountDeletionCancelOutcomeSchema,
  accountDeletionOutcomeSchema,
  accountDeletionStatusSchema,
  accountEmailChangeCancelledSchema,
  accountEmailChangeConfirmedSchema,
  accountEmailChangeStartedSchema,
  accountPasswordChangedSchema,
  accountPhoneCodeSentSchema,
  accountPhoneRemovedSchema,
  accountPhoneVerifiedSchema,
  accountProfileSchema,
  accountSessionsRevokedSchema,
  accountSessionsSchema,
  accountSignInMethodUnlinkedSchema,
  accountSignInMethodsSchema,
  accountTimeZoneSchema,
} from "@auction/identity-contracts";
import type { z } from "zod";
import type { LaxAccountConfig } from "../config";
import type {
  AccountIdentityGateway,
  IdentityActor,
  IdentityCallResult,
} from "../ports/account-identity-gateway";

const REQUEST_TIMEOUT_MS = 5_000;

const REJECTION_REASONS: ReadonlySet<string> = new Set([
  ...ACCOUNT_CONTACT_ERRORS,
  ...ACCOUNT_ADDRESS_ERRORS,
  ...ACCOUNT_PASSWORD_ERRORS,
  ...ACCOUNT_SIGN_IN_METHOD_ERRORS,
  ...ACCOUNT_TIME_ZONE_ERRORS,
]);

type RejectionReason =
  | AccountContactError
  | AccountAddressError
  | AccountPasswordError
  | AccountSignInMethodError
  | AccountTimeZoneError;

function rejectionReason(body: unknown): RejectionReason | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" && REJECTION_REASONS.has(error)
    ? (error as RejectionReason)
    : null;
}

function timeZoneFields(change: AccountTimeZoneChange): Record<string, string> {
  return change.mode === "fixed"
    ? { mode: "fixed", zone: change.zone }
    : { mode: "automatic", ...(change.deviceZone ? { zone: change.deviceZone } : {}) };
}

/** Whether `url` is the issuer's own `/account-action` page, on the issuer's public origin. */
export function isIssuerActionUrl(url: string, issuer: string): boolean {
  try {
    const target = new URL(url);
    return (
      target.origin === new URL(issuer).origin &&
      target.pathname === ACCOUNT_ACTION_PATH &&
      target.username === "" &&
      target.password === ""
    );
  } catch {
    return false;
  }
}

/**
 * Calls the issuer's account routes as LAX Account, for the person who owns the access token.
 * Tokens travel in the request body, never a URL, and nothing here logs them. Every failure
 * (network, timeout, refusal, unexpected body) is `unavailable`, except the issuer's explicit
 * "sign in again", which callers turn into a fresh sign-in, and its named refusals (`rejected`),
 * which the person can act on.
 */
export function createIssuerAccountIdentityGateway(
  config: Pick<
    LaxAccountConfig,
    "oidcIssuer" | "oidcInternalIssuer" | "oidcClientId" | "oidcClientSecret"
  >,
  fetchImpl: typeof fetch = fetch,
): AccountIdentityGateway {
  const base = `${config.oidcInternalIssuer}/api/auth`;
  const basic = Buffer.from(
    `${encodeURIComponent(config.oidcClientId)}:${encodeURIComponent(config.oidcClientSecret)}`,
  ).toString("base64");

  async function post<S extends z.ZodTypeAny>(
    path: string,
    fields: Record<string, string>,
    schema: S,
  ): Promise<IdentityCallResult<z.infer<S>>> {
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(fields),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        if (
          response.status === 403 &&
          (body as { error?: unknown } | null)?.error === ACCOUNT_REAUTH_REQUIRED
        ) {
          return { status: "reauth_required" };
        }
        const reason = rejectionReason(body);
        if (reason) return { status: "rejected", reason };
        console.warn("account_identity_unavailable", { path, status: response.status });
        return { status: "unavailable" };
      }
      const parsed = schema.safeParse(await response.json());
      return parsed.success ? { status: "ok", value: parsed.data } : { status: "unavailable" };
    } catch (error) {
      console.warn("account_identity_unavailable", {
        path,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  const fields = (actor: IdentityActor, extra: Record<string, string> = {}) => ({
    token: actor.accessToken,
    sid: actor.sid,
    ...extra,
  });

  return {
    async readName(actor) {
      const result = await post(
        ACCOUNT_PROFILE_PATH,
        { token: actor.accessToken },
        accountProfileSchema,
      );
      return result.status === "ok" ? result.value.name : null;
    },
    async rename(actor, name) {
      const result = await post(
        ACCOUNT_PROFILE_UPDATE_PATH,
        fields(actor, { name }),
        accountProfileSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.name } : result;
    },
    async readTimeZone(actor) {
      const result = await post(
        ACCOUNT_TIME_ZONE_PATH,
        { token: actor.accessToken },
        accountTimeZoneSchema,
      );
      return result.status === "ok" ? result.value : null;
    },
    setTimeZone(actor, change) {
      return post(
        ACCOUNT_TIME_ZONE_UPDATE_PATH,
        { token: actor.accessToken, ...timeZoneFields(change) },
        accountTimeZoneSchema,
      );
    },
    async reportDeviceZone(actor, deviceZone) {
      const result = await post(
        ACCOUNT_TIME_ZONE_DEVICE_PATH,
        { token: actor.accessToken, ...(deviceZone ? { zone: deviceZone } : {}) },
        accountTimeZoneSchema,
      );
      return result.status === "ok" ? result.value : null;
    },
    async readContact(actor) {
      const result = await post(
        ACCOUNT_CONTACT_PATH,
        { token: actor.accessToken },
        accountContactSchema,
      );
      return result.status === "ok" ? result.value : null;
    },
    async startEmailChange(actor, email) {
      const result = await post(
        ACCOUNT_EMAIL_CHANGE_PATH,
        fields(actor, { email }),
        accountEmailChangeStartedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.pendingEmail } : result;
    },
    async cancelEmailChange(actor) {
      const result = await post(
        ACCOUNT_EMAIL_CHANGE_CANCEL_PATH,
        fields(actor),
        accountEmailChangeCancelledSchema,
      );
      return result.status === "ok" ? { status: "ok", value: true } : result;
    },
    confirmEmailChange(emailToken) {
      return post(
        ACCOUNT_EMAIL_CHANGE_CONFIRM_PATH,
        { email_token: emailToken },
        accountEmailChangeConfirmedSchema,
      );
    },
    async sendPhoneCode(actor, phone) {
      const result = await post(
        ACCOUNT_PHONE_SEND_CODE_PATH,
        fields(actor, { phone }),
        accountPhoneCodeSentSchema,
      );
      return result.status === "ok" ? { status: "ok", value: true } : result;
    },
    async verifyPhone(actor, phone, code) {
      const result = await post(
        ACCOUNT_PHONE_VERIFY_PATH,
        fields(actor, { phone, code }),
        accountPhoneVerifiedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.phone } : result;
    },
    async removePhone(actor) {
      const result = await post(
        ACCOUNT_PHONE_REMOVE_PATH,
        fields(actor),
        accountPhoneRemovedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: true } : result;
    },
    changePassword(actor, { currentPassword, newPassword }) {
      return post(
        ACCOUNT_PASSWORD_CHANGE_PATH,
        fields(actor, {
          new_password: newPassword,
          ...(currentPassword === null ? {} : { current_password: currentPassword }),
        }),
        accountPasswordChangedSchema,
      );
    },
    async readDeletionStatus(actor) {
      const result = await post(
        ACCOUNT_DELETION_PATH,
        { token: actor.accessToken },
        accountDeletionStatusSchema,
      );
      return result.status === "ok" ? result.value : null;
    },
    requestDeletion(actor, confirmation) {
      return post(
        ACCOUNT_DELETION_REQUEST_PATH,
        fields(actor, { confirmation }),
        accountDeletionOutcomeSchema,
      );
    },
    async cancelDeletion(actor) {
      const result = await post(
        ACCOUNT_DELETION_CANCEL_PATH,
        fields(actor),
        accountDeletionCancelOutcomeSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.outcome } : result;
    },
    async listSessions(actor) {
      const result = await post(ACCOUNT_SESSIONS_PATH, fields(actor), accountSessionsSchema);
      return result.status === "ok" ? { status: "ok", value: result.value.sessions } : result;
    },
    async revokeSession(actor, sessionId) {
      const result = await post(
        ACCOUNT_SESSIONS_REVOKE_PATH,
        fields(actor, { session_id: sessionId }),
        accountSessionsRevokedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.revoked } : result;
    },
    async revokeOtherSessions(actor) {
      const result = await post(
        ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH,
        fields(actor),
        accountSessionsRevokedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.revoked } : result;
    },
    async listAddresses(actor) {
      const result = await post(
        ACCOUNT_ADDRESSES_PATH,
        { token: actor.accessToken },
        accountAddressesSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.addresses } : result;
    },
    async createAddress(actor, address) {
      const result = await post(
        ACCOUNT_ADDRESSES_CREATE_PATH,
        fields(actor, { address: JSON.stringify(address) }),
        accountAddressResultSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.address } : result;
    },
    async updateAddress(actor, addressId, expectedVersion, address) {
      const result = await post(
        ACCOUNT_ADDRESSES_UPDATE_PATH,
        fields(actor, {
          address_id: addressId,
          expected_version: String(expectedVersion),
          address: JSON.stringify(address),
        }),
        accountAddressResultSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.address } : result;
    },
    async deleteAddress(actor, addressId, expectedVersion) {
      const result = await post(
        ACCOUNT_ADDRESSES_DELETE_PATH,
        fields(actor, { address_id: addressId, expected_version: String(expectedVersion) }),
        accountAddressDeletedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: true } : result;
    },
    async setDefaultAddress(actor, addressId, kind) {
      const result = await post(
        ACCOUNT_ADDRESSES_DEFAULT_PATH,
        { token: actor.accessToken, address_id: addressId, kind },
        accountAddressResultSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.address } : result;
    },
    async regenerateBackupCodes(actor) {
      const result = await post(
        ACCOUNT_BACKUP_CODES_REGENERATE_PATH,
        fields(actor),
        accountBackupCodesSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.backupCodes } : result;
    },
    readSignInMethods(actor) {
      return post(
        ACCOUNT_SIGN_IN_METHODS_PATH,
        { token: actor.accessToken },
        accountSignInMethodsSchema,
      );
    },
    async startSignInMethodAction(actor, action) {
      const result = await post(
        ACCOUNT_SIGN_IN_METHODS_INTENT_PATH,
        fields(actor, { action }),
        accountActionIntentSchema,
      );
      if (result.status !== "ok") return result;
      // The browser is about to be sent here, so it must be the issuer's own page and nothing else.
      if (!isIssuerActionUrl(result.value.url, config.oidcIssuer)) {
        console.warn("account_identity_unavailable", { path: ACCOUNT_SIGN_IN_METHODS_INTENT_PATH });
        return { status: "unavailable" };
      }
      return result;
    },
    unlinkSignInMethod(actor, provider) {
      return post(
        ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
        fields(actor, { provider }),
        accountSignInMethodUnlinkedSchema,
      );
    },
  };
}
