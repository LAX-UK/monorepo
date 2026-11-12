import type {
  AccountActionIntentResponse,
  AccountAddress,
  AccountAddressDefaultKind,
  AccountAddressError,
  AccountAddressInput,
  AccountContactError,
  AccountContactResponse,
  AccountDeletionOutcome,
  AccountDeletionStatus,
  AccountEmailChangeConfirmedResponse,
  AccountPasskey,
  AccountPasskeyRemovedResponse,
  AccountPasswordChangedResponse,
  AccountPasswordError,
  AccountSession,
  AccountSignInMethodError,
  AccountSignInMethodUnlinkedResponse,
  AccountSignInMethodsResponse,
  AccountTimeZone,
  AccountTimeZoneChange,
  AccountTimeZoneError,
  SignInMethodKind,
  SocialSignInProvider,
} from "@auction/identity-contracts";

/**
 * What the issuer said to a request made on the signed-in person's behalf:
 *  - `reauth_required`: their sign-in is too old for a sensitive change, or has ended, so they
 *    must sign in again;
 *  - `rejected`: the issuer understood the request and said no for a reason the person can act
 *    on (an address already in use, a wrong code, too many attempts);
 *  - `unavailable`: the issuer refused, failed or did not answer; nothing is known to have changed.
 */
export type IdentityCallResult<T> =
  | { status: "ok"; value: T }
  | { status: "reauth_required" }
  | {
      status: "rejected";
      reason:
        | AccountContactError
        | AccountAddressError
        | AccountPasswordError
        | AccountSignInMethodError
        | AccountTimeZoneError;
    }
  | { status: "unavailable" };

/** The signed-in person's tokens: the access token names the person, `sid` names the sign-in. */
export type IdentityActor = { accessToken: string; sid: string };

/** The issuer-owned identity data LAX Account shows and edits. */
export type AccountIdentityGateway = {
  /** The person's current name, or null when the issuer could not answer. */
  readName(actor: IdentityActor): Promise<string | null>;
  rename(actor: IdentityActor, name: string): Promise<IdentityCallResult<string>>;
  /** The person's time zone preference, or null when the issuer could not answer. */
  readTimeZone(actor: IdentityActor): Promise<AccountTimeZone | null>;
  /** Saves "automatic" or "always use one city". Needs no recent sign-in. */
  setTimeZone(
    actor: IdentityActor,
    change: AccountTimeZoneChange,
  ): Promise<IdentityCallResult<AccountTimeZone>>;
  /**
   * Tells the issuer which zone this device is in. It is stored only while the person follows
   * their device. Resolves to the preference now stored, or null when the issuer could not answer.
   */
  reportDeviceZone(
    actor: IdentityActor,
    deviceZone: string | null,
  ): Promise<AccountTimeZone | null>;
  /** The live email and phone on file, or null when the issuer could not answer. */
  readContact(actor: IdentityActor): Promise<AccountContactResponse | null>;
  /** Emails a confirmation link to the current and the new address. Resolves to the new address. */
  startEmailChange(actor: IdentityActor, email: string): Promise<IdentityCallResult<string>>;
  cancelEmailChange(actor: IdentityActor): Promise<IdentityCallResult<true>>;
  /**
   * Confirms one inbox from its emailed link. The link is the proof, so this needs no
   * signed-in person: the page the link opens may be visited in any browser.
   */
  confirmEmailChange(
    emailToken: string,
  ): Promise<IdentityCallResult<AccountEmailChangeConfirmedResponse>>;
  sendPhoneCode(actor: IdentityActor, phone: string): Promise<IdentityCallResult<true>>;
  /** Checks the code and, if right, saves the number as verified. Resolves to the saved number. */
  verifyPhone(
    actor: IdentityActor,
    phone: string,
    code: string,
  ): Promise<IdentityCallResult<string>>;
  /** Clears the phone number and its verified flag. Needs a recent sign-in. */
  removePhone(actor: IdentityActor): Promise<IdentityCallResult<true>>;
  /**
   * Changes the password, or sets the first one when `currentPassword` is null and the account
   * has none. Needs a recent sign-in. Every other device is signed out; this one stays.
   */
  changePassword(
    actor: IdentityActor,
    input: { currentPassword: string | null; newPassword: string },
  ): Promise<IdentityCallResult<AccountPasswordChangedResponse>>;
  /** What is in the way of deleting the account, per product; null when Identity could not answer. */
  readDeletionStatus(actor: IdentityActor): Promise<AccountDeletionStatus | null>;
  /**
   * Starts the 30-day deletion after Identity has asked every product. Needs a recent sign-in
   * and the typed confirmation phrase. A refusal is an `ok` outcome, not a failure.
   */
  requestDeletion(
    actor: IdentityActor,
    confirmation: string,
  ): Promise<IdentityCallResult<AccountDeletionOutcome>>;
  cancelDeletion(actor: IdentityActor): Promise<IdentityCallResult<"cancelled" | "not_requested">>;
  listSessions(actor: IdentityActor): Promise<IdentityCallResult<AccountSession[]>>;
  /** Signs out one other device. Resolves to how many sessions were ended. */
  revokeSession(actor: IdentityActor, sessionId: string): Promise<IdentityCallResult<number>>;
  /** Signs out every device except the actor's own. Resolves to how many were ended. */
  revokeOtherSessions(actor: IdentityActor): Promise<IdentityCallResult<number>>;
  /** The person's saved addresses, oldest first. */
  listAddresses(actor: IdentityActor): Promise<IdentityCallResult<AccountAddress[]>>;
  /** Adding, editing and deleting need a recent sign-in; making a default does not. */
  createAddress(
    actor: IdentityActor,
    address: AccountAddressInput,
  ): Promise<IdentityCallResult<AccountAddress>>;
  /** `expectedVersion` is the version the person saw; a stale edit is rejected, not applied. */
  updateAddress(
    actor: IdentityActor,
    addressId: string,
    expectedVersion: number,
    address: AccountAddressInput,
  ): Promise<IdentityCallResult<AccountAddress>>;
  deleteAddress(
    actor: IdentityActor,
    addressId: string,
    expectedVersion: number,
  ): Promise<IdentityCallResult<true>>;
  setDefaultAddress(
    actor: IdentityActor,
    addressId: string,
    kind: AccountAddressDefaultKind,
  ): Promise<IdentityCallResult<AccountAddress>>;
  /**
   * Replaces the backup codes and resolves to the new set. This is the only time the codes are
   * available: the issuer does not reveal them again.
   */
  regenerateBackupCodes(actor: IdentityActor): Promise<IdentityCallResult<string[]>>;
  /** The password and linked Google or Apple accounts. */
  readSignInMethods(
    actor: IdentityActor,
  ): Promise<IdentityCallResult<AccountSignInMethodsResponse>>;
  /**
   * Asks the issuer for the one-time address that adds a method (the issuer's own page, which runs
   * the round trip to Google or Apple and returns to Security). Needs a recent sign-in. The
   * address is checked to be the issuer's before it is returned.
   */
  startSignInMethodAction(
    actor: IdentityActor,
    action: SignInMethodKind,
  ): Promise<IdentityCallResult<AccountActionIntentResponse>>;
  /**
   * Removes a linked Google or Apple sign-in. Needs a recent sign-in, and is refused when it is the
   * person's last method. Every other device is signed out; this one stays.
   */
  unlinkSignInMethod(
    actor: IdentityActor,
    provider: SocialSignInProvider,
  ): Promise<IdentityCallResult<AccountSignInMethodUnlinkedResponse>>;
  /**
   * Gives one of the person's own passkeys a new name. The issuer answers "not linked" for a
   * passkey that is not theirs. No recent sign-in is needed: a name changes how nobody signs in.
   */
  renamePasskey(
    actor: IdentityActor,
    passkeyId: string,
    name: string,
  ): Promise<IdentityCallResult<AccountPasskey>>;
  /**
   * Removes one of the person's own passkeys. Needs a recent sign-in, and is refused when it is the
   * person's last way in. Every other device is signed out; this one stays.
   */
  removePasskey(
    actor: IdentityActor,
    passkeyId: string,
  ): Promise<IdentityCallResult<AccountPasskeyRemovedResponse>>;
};
