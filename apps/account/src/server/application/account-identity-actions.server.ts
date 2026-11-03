"use server";

import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  type AccountAddressDefaultKind,
  type AccountAddressError,
  type AccountAddressInput,
  type AccountContactError,
  type AccountEmailChangeConfirmedResponse,
  type AccountPasswordError,
  type AccountSignInMethodError,
  accountAddressDefaultKindSchema,
  accountAddressInputSchema,
  accountEmailSchema,
  accountNameSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
  socialSignInProviderSchema,
} from "@auction/identity-contracts";
import { getLaxAccountContainer } from "../container";
import type {
  AccountActionResult,
  BackupCodesActionResult,
  PasswordActionResult,
} from "../domain/account-action-result";
import { addressRejectionMessage, isAddressRejection } from "../domain/account-addresses.vm";
import { contactRejectionMessage } from "../domain/account-contact.vm";
import {
  PASSWORD_FIELDS,
  isPasswordRejection,
  passwordRejection,
  validatePasswordForm,
} from "../domain/account-password.vm";
import {
  PROVIDER_LABEL,
  isSignInMethodRejection,
  signInMethodRejectionMessage,
} from "../domain/account-sign-in-methods.vm";
import type { IdentityActor, IdentityCallResult } from "../ports/account-identity-gateway";
import { loadActor } from "./load-account-actor";

const UNAVAILABLE_MESSAGE =
  "We couldn't do that just now. Nothing was changed. Please try again in a moment.";
const UNAVAILABLE = { status: "error", message: UNAVAILABLE_MESSAGE } as const;

function rejectionMessage(
  reason:
    | AccountContactError
    | AccountAddressError
    | AccountPasswordError
    | AccountSignInMethodError,
): string {
  if (isSignInMethodRejection(reason)) return signInMethodRejectionMessage(reason);
  if (isAddressRejection(reason)) return addressRejectionMessage(reason);
  if (isPasswordRejection(reason)) return passwordRejection(reason).message;
  return contactRejectionMessage(reason);
}

type NotOk = Exclude<AccountActionResult, { status: "ok" }>;

async function asSignedInPerson<T>(
  change: (actor: IdentityActor) => Promise<IdentityCallResult<T>>,
): Promise<{ status: "ok"; value: T } | NotOk> {
  const actor = await loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return UNAVAILABLE;
  const result = await change(actor);
  if (result.status === "ok") return result;
  if (result.status === "rejected") {
    return { status: "error", message: rejectionMessage(result.reason) };
  }
  return result.status === "reauth_required"
    ? result
    : { status: "error", message: UNAVAILABLE_MESSAGE };
}

async function actAsSignedInPerson<T>(
  change: (actor: IdentityActor) => Promise<IdentityCallResult<T>>,
  success: (value: T) => string,
): Promise<AccountActionResult> {
  const result = await asSignedInPerson(change);
  return result.status === "ok" ? { status: "ok", message: success(result.value) } : result;
}

export async function renameAccountAction(name: string): Promise<AccountActionResult> {
  const parsed = accountNameSchema.safeParse(name);
  if (!parsed.success) {
    return { status: "error", message: "Enter your name, using up to 200 characters." };
  }
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.rename(actor, parsed.data),
    () => "Your name has been updated.",
  );
}

export async function signOutDeviceAction(sessionId: string): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.revokeSession(actor, sessionId),
    () => "That device has been signed out.",
  );
}

export async function signOutOtherDevicesAction(): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.revokeOtherSessions(actor),
    () => "Every other device has been signed out.",
  );
}

/**
 * Creates a new set of backup codes. The codes come back in this one result and are never stored
 * by Account: the caller shows them once and the issuer will not reveal them again.
 */
export async function regenerateBackupCodesAction(): Promise<BackupCodesActionResult> {
  const actor = await loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return UNAVAILABLE;
  const { identity } = getLaxAccountContainer();
  const result = await identity.regenerateBackupCodes(actor);
  if (result.status === "ok") return { status: "ok", backupCodes: result.value };
  if (result.status === "rejected") {
    return { status: "error", message: rejectionMessage(result.reason) };
  }
  return result.status === "reauth_required" ? result : UNAVAILABLE;
}

/**
 * Removes a linked Google or Apple sign-in. The issuer needs a recent sign-in, refuses to remove
 * the last method, signs out every other device and emails the person.
 */
export async function removeSignInMethodAction(provider: string): Promise<AccountActionResult> {
  const parsed = socialSignInProviderSchema.safeParse(provider);
  if (!parsed.success) {
    return { status: "error", message: "That sign-in method can't be removed here." };
  }
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.unlinkSignInMethod(actor, parsed.data),
    () =>
      `${PROVIDER_LABEL[parsed.data]} sign-in has been removed. Every other device has been signed out.`,
  );
}

/**
 * Changes the password, or sets the first one when no current password is sent. The form checks
 * the same limits, and this repeats them because actions are public endpoints. The passwords are
 * passed straight to the issuer: they are never stored, logged or returned.
 */
export async function changePasswordAction(input: {
  currentPassword: string | null;
  newPassword: string;
}): Promise<PasswordActionResult> {
  const { newPassword, currentPassword } = input;
  const errors = validatePasswordForm(
    { current: currentPassword ?? "", next: newPassword, confirm: newPassword },
    currentPassword === null ? "create" : "change",
  );
  const invalid = PASSWORD_FIELDS.find((field) => errors[field]);
  if (invalid) return { status: "error", message: errors[invalid] ?? "", field: invalid };
  const actor = await loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return { ...UNAVAILABLE, field: null };
  const { identity } = getLaxAccountContainer();
  const result = await identity.changePassword(actor, { currentPassword, newPassword });
  if (result.status === "ok") return { status: "ok", created: result.value.created };
  if (result.status === "reauth_required") return result;
  if (result.status === "rejected" && isPasswordRejection(result.reason)) {
    return { status: "error", ...passwordRejection(result.reason) };
  }
  return { ...UNAVAILABLE, field: null };
}

export async function startEmailChangeAction(email: string): Promise<AccountActionResult> {
  const parsed = accountEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.startEmailChange(actor, parsed.data),
    () => "We've emailed a confirmation link to your current and your new address.",
  );
}

export async function cancelEmailChangeAction(): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.cancelEmailChange(actor),
    () => "The email change has been cancelled.",
  );
}

export async function sendPhoneCodeAction(phone: string): Promise<AccountActionResult> {
  const parsed = accountPhoneSchema.safeParse(phone);
  if (!parsed.success) {
    return { status: "error", message: contactRejectionMessage("invalid_phone") };
  }
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.sendPhoneCode(actor, parsed.data),
    () => "We've sent a 6-digit code by text message.",
  );
}

export async function verifyPhoneAction(phone: string, code: string): Promise<AccountActionResult> {
  const parsedPhone = accountPhoneSchema.safeParse(phone);
  if (!parsedPhone.success) {
    return { status: "error", message: contactRejectionMessage("invalid_phone") };
  }
  const parsedCode = accountPhoneCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return { status: "error", message: contactRejectionMessage("invalid_code") };
  }
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.verifyPhone(actor, parsedPhone.data, parsedCode.data),
    () => "Your phone number has been verified.",
  );
}

export async function removePhoneAction(): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.removePhone(actor),
    () => "Your phone number has been removed.",
  );
}

const INVALID_ADDRESS: AccountActionResult = {
  status: "error",
  message: addressRejectionMessage("invalid_address"),
};

/** The form has already been checked in the browser; this repeats it because actions are public endpoints. */
export async function addAddressAction(address: AccountAddressInput): Promise<AccountActionResult> {
  if (!accountAddressInputSchema.safeParse(address).success) return INVALID_ADDRESS;
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.createAddress(actor, address),
    () => "Your address has been saved.",
  );
}

export async function updateAddressAction(
  addressId: string,
  expectedVersion: number,
  address: AccountAddressInput,
): Promise<AccountActionResult> {
  if (!accountAddressInputSchema.safeParse(address).success) return INVALID_ADDRESS;
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.updateAddress(actor, addressId, expectedVersion, address),
    () => "Your address has been updated.",
  );
}

export async function deleteAddressAction(
  addressId: string,
  expectedVersion: number,
): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.deleteAddress(actor, addressId, expectedVersion),
    () => "The address has been deleted.",
  );
}

export async function setDefaultAddressAction(
  addressId: string,
  kind: AccountAddressDefaultKind,
): Promise<AccountActionResult> {
  if (!accountAddressDefaultKindSchema.safeParse(kind).success) return INVALID_ADDRESS;
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.setDefaultAddress(actor, addressId, kind),
    () =>
      kind === "shipping"
        ? "Default shipping address updated."
        : "Default billing address updated.",
  );
}

export type ConfirmEmailChangeActionResult =
  | ({ status: "ok" } & AccountEmailChangeConfirmedResponse)
  | { status: "error"; message: string };

/**
 * Confirms one inbox of an email change. The emailed link is the proof, so unlike the other
 * actions this works without a session: people open these links on a phone or in a mail app's
 * browser where they are not signed in to LAX.
 */
export async function confirmEmailChangeAction(
  emailToken: string,
): Promise<ConfirmEmailChangeActionResult> {
  if (!emailToken) return { status: "error", message: contactRejectionMessage("invalid_token") };
  const { identity } = getLaxAccountContainer();
  const result = await identity.confirmEmailChange(emailToken);
  if (result.status === "ok") return { status: "ok", ...result.value };
  if (result.status === "rejected") {
    return { status: "error", message: rejectionMessage(result.reason) };
  }
  return { status: "error", message: UNAVAILABLE_MESSAGE };
}

/**
 * Starts the 30-day deletion. Identity re-checks every product at this moment, so the page
 * that offered the button may be out of date: a refusal is reported as an error and the page
 * refreshes to show what is in the way.
 */
export async function requestAccountDeletionAction(
  confirmation: string,
): Promise<AccountActionResult> {
  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
    return { status: "error", message: "Type the confirmation phrase exactly as shown." };
  }
  const { identity } = getLaxAccountContainer();
  const result = await asSignedInPerson((actor) => identity.requestDeletion(actor, confirmation));
  if (result.status !== "ok") return result;
  switch (result.value.outcome) {
    case "requested":
      return { status: "ok", message: "Your account is scheduled for deletion." };
    case "already_requested":
      return { status: "ok", message: "Your account was already scheduled for deletion." };
    case "not_eligible":
      return {
        status: "error",
        message:
          "Your account can't be deleted just now. What's in the way is listed on this page.",
      };
  }
}

export async function cancelAccountDeletionAction(): Promise<AccountActionResult> {
  const { identity } = getLaxAccountContainer();
  return actAsSignedInPerson(
    (actor) => identity.cancelDeletion(actor),
    (outcome) =>
      outcome === "cancelled"
        ? "Deletion cancelled. Your account stays as it is."
        : "There was no deletion to cancel.",
  );
}
