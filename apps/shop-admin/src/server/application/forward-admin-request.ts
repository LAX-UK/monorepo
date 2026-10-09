import { assertRecentAuthentication } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";
import { resolveAdminProxyTarget } from "../domain/admin-proxy-policy";
import { assertMutationCsrf } from "../domain/csrf-policy";
import type { AdminApiClient } from "../ports/admin-api-client";
import type { Clock } from "../ports/clock";
import type { SessionStore } from "../ports/session-store";
import { refreshStaffSessionIfNeeded } from "./refresh-staff-session";

export async function forwardAdminRequest(input: {
  config: ShopAdminConfig;
  sessions: SessionStore;
  adminApi: AdminApiClient;
  clock: Clock;
  sessionId: string | null;
  bffPath: string;
  method: string;
  origin: string | null;
  csrfHeader: string | null;
  csrfCookie: string | null;
  fromServerAction?: boolean;
  body: ArrayBuffer | undefined;
  forwardHeaders: Record<string, string>;
}): Promise<{ status: number; headers: Record<string, string>; body: ArrayBuffer }> {
  if (!input.sessionId) {
    throw new Error("Unauthorized");
  }
  assertMutationCsrf({
    method: input.method,
    origin: input.origin,
    expectedOrigin: input.config.publicOrigin,
    csrfHeader: input.csrfHeader,
    csrfCookie: input.csrfCookie,
    fromServerAction: input.fromServerAction === true,
  });
  const target = resolveAdminProxyTarget({
    bffPath: input.bffPath,
    shopApiBaseUrl: input.config.shopApiBaseUrl,
    method: input.method,
  });
  if (!target) {
    throw new Error("Not found");
  }
  let session = await input.sessions.get(input.sessionId);
  if (!session) {
    throw new Error("Unauthorized");
  }
  session = await refreshStaffSessionIfNeeded({
    config: input.config,
    sessions: input.sessions,
    clock: input.clock,
    sessionId: input.sessionId,
    session,
  });
  if (target.requiresRecentAuth) {
    assertRecentAuthentication({
      authTime: session.authTime,
      maxAgeSeconds: 900,
      nowMs: input.clock.nowMs(),
    });
  }
  return input.adminApi.forward({
    method: input.method,
    url: target.upstreamUrl,
    accessToken: session.accessToken,
    body: input.body,
    headers: input.forwardHeaders,
  });
}
