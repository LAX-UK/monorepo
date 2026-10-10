import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { getLaxAccountContainer } from "../container";
import { type AccountOverviewVm, buildAccountOverview } from "../domain/account-overview.vm";

export type AccountSessionState =
  | { status: "ok"; subject: string; overview: AccountOverviewVm }
  | { status: "unsigned" };

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
  const record = await container.sessions.get(sessionId);
  if (!record) return { status: "unsigned" };
  return {
    status: "ok",
    subject: record.subject,
    overview: buildAccountOverview(idTokenClaims(record.idToken), record.acr),
  };
}
