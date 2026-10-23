import type { AccountSecurityFactsResponse } from "@auction/identity-contracts";
import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { getLaxAccountContainer } from "../container";
import { type AccountOverviewVm, buildAccountOverview } from "../domain/account-overview.vm";
import { revalidateAccountSession } from "./revalidate-account-session";

export type AccountSessionState =
  | {
      status: "ok";
      subject: string;
      overview: AccountOverviewVm;
      /** Present only when requested, and null when the issuer could not answer. */
      liveSecurity: AccountSecurityFactsResponse | null;
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

/**
 * @param options.withLiveSecurity ask the issuer for the person's current two-step state.
 *   Only the pages that show it pay for the extra request.
 */
export async function loadAccountSession(
  options: { withLiveSecurity?: boolean } = {},
): Promise<AccountSessionState> {
  const container = getLaxAccountContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(container.cookies.sessionCookie)?.value;
  if (!sessionId) return { status: "unsigned" };
  try {
    const record = await revalidateAccountSession({
      sessionId,
      sessions: container.sessions,
      tokenEndpoint: container.tokenEndpoint,
      sessionTtlSeconds: container.config.sessionTtlSeconds,
    });
    if (!record) return { status: "unsigned" };
    return {
      status: "ok",
      subject: record.subject,
      overview: buildAccountOverview(idTokenClaims(record.idToken), record.acr),
      liveSecurity: options.withLiveSecurity
        ? await container.securityFacts.read(record.accessToken)
        : null,
    };
  } catch (error) {
    // A Redis outage must not look like a sign-out: the person is still signed in, and sending
    // them to the issuer would only fail there too.
    console.error("account_session_load_failed", error);
    return { status: "unavailable" };
  }
}
