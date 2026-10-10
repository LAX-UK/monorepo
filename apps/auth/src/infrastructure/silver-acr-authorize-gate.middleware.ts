import type { createAuth } from "@auction/auth";
import { appendOidcAuthorizeParams, decideSilverAcrStep } from "@auction/auth";
import {
  AUTH_ROUTE_PATH,
  OIDC_ACR_SILVER,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { account, user } from "@auction/identity-db/schema";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { OidcRpSessionRepository } from "../services/oidc-session-coordinator.js";

function requestsSilverAcr(acrValues: string | null): boolean {
  if (!acrValues) return false;
  return acrValues.split(/\s+/).some((part) => part.trim() === OIDC_ACR_SILVER);
}

function oauthErrorRedirect(
  redirectUri: string,
  state: string | null,
  error: string,
  description: string,
): string {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  return target.toString();
}

export function createSilverAcrAuthorizeGateMiddleware(options: {
  auth: ReturnType<typeof createAuth>;
  db: IdentityDatabase;
  sessions: Pick<OidcRpSessionRepository, "findIdentitySession">;
  issuerOrigin: string;
}): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname.replace(/\/+$/, "");
    if (path !== `${AUTH_ROUTE_PATH}/oauth2/authorize`) {
      await next();
      return;
    }
    const params = new URL(c.req.url).searchParams;
    if (!requestsSilverAcr(params.get("acr_values"))) {
      await next();
      return;
    }
    const prompt = (params.get("prompt") ?? "").split(/\s+/);
    if (prompt.includes("none")) {
      await next();
      return;
    }
    const redirectUri = params.get("redirect_uri");
    const state = params.get("state");
    const clientId = params.get("client_id") as RegisteredOidcClientId | null;
    if (!redirectUri || !clientId || !(clientId in REGISTERED_OIDC_CLIENTS)) {
      await next();
      return;
    }

    const liveSession = await options.auth.api.getSession({ headers: c.req.raw.headers });
    const identitySessionId = liveSession?.session?.id;
    const subjectId = liveSession?.user?.id;
    if (!identitySessionId || !subjectId) {
      await next();
      return;
    }

    const identitySession = await options.sessions.findIdentitySession(identitySessionId);
    if (!identitySession || identitySession.subjectId !== subjectId) {
      await next();
      return;
    }

    if (identitySession.mfaCompletedAt) {
      await next();
      return;
    }

    const [subject] = await options.db
      .select({ twoFactorEnabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);

    const [credentialAccount] = await options.db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
      .limit(1);

    const canEnrolTotp = Boolean(credentialAccount?.id);

    const step = decideSilverAcrStep({
      mfaCompletedAt: identitySession.mfaCompletedAt,
      twoFactorEnabled: Boolean(subject?.twoFactorEnabled),
      canEnrolTotp,
    });

    if (step === "pass") {
      await next();
      return;
    }
    if (step === "verify") {
      const twoFactor = new URL("/two-factor", options.issuerOrigin);
      appendOidcAuthorizeParams(twoFactor, params, { ensureClientId: clientId });
      return c.redirect(twoFactor.toString(), 302);
    }
    if (step === "setup") {
      const setup = new URL("/two-factor/setup", options.issuerOrigin);
      appendOidcAuthorizeParams(setup, params, { ensureClientId: clientId });
      return c.redirect(setup.toString(), 302);
    }
    return c.redirect(
      oauthErrorRedirect(
        redirectUri,
        state,
        "unmet_authentication_requirements",
        "Multi-factor authentication is required but cannot be configured for this account",
      ),
      302,
    );
  };
}
