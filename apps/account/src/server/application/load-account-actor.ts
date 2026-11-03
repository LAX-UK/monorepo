import type { IdentityActor } from "../ports/account-identity-gateway";
import { loadAccountRecord } from "./load-account-record";

/**
 * The signed-in person as the issuer knows them, for a change made on their behalf. No session,
 * or a session store that cannot be reached, never reaches the issuer: the first sends the
 * person to sign in again, the second reports that nothing changed.
 */
export async function loadActor(): Promise<IdentityActor | "no_session" | "unavailable"> {
  try {
    const record = await loadAccountRecord();
    return record ? { accessToken: record.accessToken, sid: record.sid } : "no_session";
  } catch (error) {
    console.error("account_session_load_failed", error);
    return "unavailable";
  }
}
