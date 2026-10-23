"use server";

import {
  type AccountAddressDefaultKind,
  type AccountAddressError,
  type AccountAddressInput,
  type AccountContactError,
  type AccountEmailChangeConfirmedResponse,
  accountAddressDefaultKindSchema,
  accountAddressInputSchema,
  accountEmailSchema,
  accountNameSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
} from "@auction/identity-contracts";
import { getLaxAccountContainer } from "../container";
import type { AccountActionResult, BackupCodesActionResult } from "../domain/account-action-result";
import { addressRejectionMessage, isAddressRejection } from "../domain/account-addresses.vm";
import { contactRejectionMessage } from "../domain/account-contact.vm";
import type { IdentityActor, IdentityCallResult } from "../ports/account-identity-gateway";
import { loadAccountRecord } from "./load-account-record";

const UNAVAILABLE_MESSAGE =
  "We couldn't do that just now. Nothing was changed. Please try again in a moment.";
const UNAVAILABLE = { status: "error", message: UNAVAILABLE_MESSAGE } as const;

function rejectionMessage(reason: AccountContactError | AccountAddressError): string {
  return isAddressRejection(reason)
    ? addressRejectionMessage(reason)
    : contactRejectionMessage(reason);
}

/**
 * Runs a change as the signed-in person. No session, or a session store that cannot be reached,
 * never reaches the issuer: the first sends the person to sign in again, the second reports
 * that nothing changed.
 */
async function loadActor(): Promise<IdentityActor | "no_session" | "unavailable"> {
  try {
    const record = await loadAccountRecord();
    return record ? { accessToken: record.accessToken, sid: record.sid } : "no_session";
  } catch (error) {
    console.error("account_session_load_failed", error);
    return "unavailable";
  }
}

async function actAsSignedInPerson<T>(
  change: (actor: IdentityActor) => Promise<IdentityCallResult<T>>,
  success: (value: T) => string,
): Promise<AccountActionResult> {
  const actor = await loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return UNAVAILABLE;
  const result = await change(actor);
  if (result.status === "ok") return { status: "ok", message: success(result.value) };
  if (result.status === "rejected") {
    return { status: "error", message: rejectionMessage(result.reason) };
  }
  return result.status === "reauth_required" ? result : UNAVAILABLE;
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
