import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { getLaxAccountContainer } from "../container";
import { type AccountOverviewVm, buildAccountOverview } from "../domain/account-overview.vm";
import { revalidateAccountSession } from "./revalidate-account-session";

export type AccountSessionState =
  | { status: "ok"; subject: string; overview: AccountOverviewVm }
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

export async function loadAccountSession(): Promise<AccountSessionState> {
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
    };
  } catch (error) {
    // A Redis outage must not look like a sign-out: the person is still signed in, and sending
    // them to the issuer would only fail there too.
    console.error("account_session_load_failed", error);
    return { status: "unavailable" };
  }
}
