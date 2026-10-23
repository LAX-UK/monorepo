"use server";

import { accountNameSchema } from "@auction/identity-contracts";
import { getLaxAccountContainer } from "../container";
import type { AccountActionResult } from "../domain/account-action-result";
import type { IdentityActor, IdentityCallResult } from "../ports/account-identity-gateway";
import { loadAccountRecord } from "./load-account-record";

const UNAVAILABLE: AccountActionResult = {
  status: "error",
  message: "We couldn't do that just now. Nothing was changed. Please try again in a moment.",
};

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
