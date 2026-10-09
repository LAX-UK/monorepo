import { buildEndSessionUrl } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";
import type { SessionStore } from "../ports/session-store";

export async function endStaffSession(input: {
  config: ShopAdminConfig;
  sessions: SessionStore;
  sessionId: string | null;
}): Promise<{ redirectTo: string }> {
  if (!input.sessionId) {
    return { redirectTo: `${input.config.publicOrigin}/` };
  }
  const session = await input.sessions.get(input.sessionId);
  await input.sessions.delete(input.sessionId);
  if (session?.idToken) {
    return {
      redirectTo: buildEndSessionUrl({
        endSessionEndpoint: `${input.config.oidcIssuer}/api/auth/oauth2/end-session`,
        clientId: input.config.oidcClientId,
        idTokenHint: session.idToken,
        postLogoutRedirectUri: `${input.config.publicOrigin}/`,
      }),
    };
  }
  return { redirectTo: `${input.config.publicOrigin}/` };
}
