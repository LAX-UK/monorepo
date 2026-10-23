import type {
  AccountAddress,
  AccountContactResponse,
  AccountSecurityFactsResponse,
  AccountSession,
} from "@auction/identity-contracts";
import { decodeJwt } from "jose";
import { getLaxAccountContainer } from "../container";
import { type AccountOverviewVm, buildAccountOverview } from "../domain/account-overview.vm";
import type { IdentityCallResult } from "../ports/account-identity-gateway";
import { loadAccountRecord } from "./load-account-record";

export type AccountSessionState =
  | {
      status: "ok";
      subject: string;
      overview: AccountOverviewVm;
      /** Present only when requested, and null when the issuer could not answer. */
      liveSecurity: AccountSecurityFactsResponse | null;
      /** Present only when requested. */
      liveSessions: IdentityCallResult<AccountSession[]> | null;
      /** Present only when requested, and null when the issuer could not answer. */
      liveContact: AccountContactResponse | null;
      /** Present only when requested; failed when the issuer could not answer. */
      liveAddresses: IdentityCallResult<AccountAddress[]> | null;
    }
  | { status: "unsigned" }
  /** The session store could not be reached, so the person's state is unknown. */
  | { status: "unavailable" };

function idTokenClaims(idToken: string): Record<string, unknown> {
  try {
    return decodeJwt(idToken);
  } catch {
    return {};
  }
}

export type LoadAccountSessionOptions = {
  /** Ask the issuer for the person's current two-step state. */
  withLiveSecurity?: boolean;
  /**
   * Ask the issuer for the person's current name. The ID token's name is as of sign-in, so
   * without this a name changed here would keep showing the old one until the next sign-in.
   */
  withLiveName?: boolean;
  /** Ask the issuer for the person's signed-in devices. */
  withLiveSessions?: boolean;
  /** Ask the issuer for the person's current email and phone, and any email change under way. */
  withLiveContact?: boolean;
  /** Ask the issuer for the person's saved addresses. */
  withLiveAddresses?: boolean;
};

/** Only the pages that show a live fact pay for its extra issuer request. */
export async function loadAccountSession(
  options: LoadAccountSessionOptions = {},
): Promise<AccountSessionState> {
  const { securityFacts, identity } = getLaxAccountContainer();
  try {
    const record = await loadAccountRecord();
    if (!record) return { status: "unsigned" };
    const actor = { accessToken: record.accessToken, sid: record.sid };
    const [liveSecurity, liveName, liveSessions, liveContact, liveAddresses] = await Promise.all([
      options.withLiveSecurity ? securityFacts.read(record.accessToken) : null,
      options.withLiveName ? identity.readName(actor) : null,
      options.withLiveSessions ? identity.listSessions(actor) : null,
      options.withLiveContact ? identity.readContact(actor) : null,
      options.withLiveAddresses ? identity.listAddresses(actor) : null,
    ]);
    const claims = idTokenClaims(record.idToken);
    return {
      status: "ok",
      subject: record.subject,
      overview: buildAccountOverview(liveName ? { ...claims, name: liveName } : claims, record.acr),
      liveSecurity,
      liveSessions,
      liveContact,
      liveAddresses,
    };
  } catch (error) {
    // A Redis outage must not look like a sign-out: the person is still signed in, and sending
    // them to the issuer would only fail there too.
    console.error("account_session_load_failed", error);
    return { status: "unavailable" };
  }
}
