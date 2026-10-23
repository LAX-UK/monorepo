import type { AccountSession } from "@auction/identity-contracts";
import type { IdentityCallResult } from "../ports/account-identity-gateway";
import { type SessionsVm, buildSessionsVm } from "./account-sessions.vm";

/**
 * What the "Where you're signed in" section shows. The two ways the list can be missing need
 * different answers, so the page never has to guess from a missing list:
 *  - `reauth_required`: the issuer no longer knows this sign-in, so the person signs in again;
 *  - `unavailable`: the issuer could not answer; the list is unknown, not empty.
 */
export type DevicesSectionVm =
  | { status: "list"; sessions: SessionsVm }
  | { status: "reauth_required" }
  | { status: "unavailable" };

export function buildDevicesSection(
  result: IdentityCallResult<AccountSession[]> | null,
  now: Date,
): DevicesSectionVm {
  // Listing devices has no refusal the person can act on, so a refusal reads as "could not answer".
  if (!result || result.status === "unavailable" || result.status === "rejected") {
    return { status: "unavailable" };
  }
  if (result.status === "reauth_required") return { status: "reauth_required" };
  return { status: "list", sessions: buildSessionsVm(result.value, now) };
}
