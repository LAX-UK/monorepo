"use server";

import {
  type AccountEmailChangeConfirmedResponse,
  accountEmailSchema,
  accountNameSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
} from "@auction/identity-contracts";
import { getLaxAccountContainer } from "../container";
import type { AccountActionResult } from "../domain/account-action-result";
import { contactRejectionMessage } from "../domain/account-contact.vm";
import type { IdentityActor, IdentityCallResult } from "../ports/account-identity-gateway";
import { loadAccountRecord } from "./load-account-record";

const UNAVAILABLE_MESSAGE =
  "We couldn't do that just now. Nothing was changed. Please try again in a moment.";
const UNAVAILABLE: AccountActionResult = { status: "error", message: UNAVAILABLE_MESSAGE };

/**
 * Runs a change as the signed-in person. No session, or a session store that cannot be reached,
 * never reaches the issuer: the first sends the person to sign in again, the second reports
 * that nothing changed.
 */
async function actAsSignedInPerson<T>(
  change: (actor: IdentityActor) => Promise<IdentityCallResult<T>>,
  success: (value: T) => string,
): Promise<AccountActionResult> {
  let actor: IdentityActor;
  try {
    const record = await loadAccountRecord();
    if (!record) return { status: "reauth_required" };
    actor = { accessToken: record.accessToken, sid: record.sid };
  } catch (error) {
    console.error("account_session_load_failed", error);
    return UNAVAILABLE;
  }
  const result = await change(actor);
  if (result.status === "ok") return { status: "ok", message: success(result.value) };
  if (result.status === "rejected") {
    return { status: "error", message: contactRejectionMessage(result.reason) };
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
    return { status: "error", message: contactRejectionMessage(result.reason) };
  }
  return { status: "error", message: UNAVAILABLE_MESSAGE };
}
