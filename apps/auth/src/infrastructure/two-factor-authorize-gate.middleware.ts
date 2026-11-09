import type { TwoFactorRequirement, createAuth } from "@auction/auth";
import { appendOidcAuthorizeParams, decideAuthorizeTwoFactorStep } from "@auction/auth";
import {
  AUTH_ROUTE_PATH,
  OIDC_ACR_SILVER,
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
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

/** Hosted-page hint for why setup is forced; never forwarded to /oauth2/authorize. */
function requiredByHint(requirement: TwoFactorRequirement): "staff" | "org" | null {
  const [first] = requirement.sources;
  return first?.scope ?? null;
}

/**
 * LAX Account stays reachable when only an organisation asks for two-step verification: its
 * Security page is where a member sets a password and an authenticator app, so locking them out
 * of it would leave no way to meet the requirement. A staff requirement is never exempted.
 */
export function requirementForClient(
  requirement: TwoFactorRequirement,
  clientId: RegisteredOidcClientId,
): TwoFactorRequirement {
  if (
    clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB &&
    requirement.sources.length > 0 &&
    requirement.sources.every((source) => source.scope === "org")
  ) {
    return { required: false, sources: [] };
  }
  return requirement;
}

/**
 * Enforces two-step verification on authorize: always for `acr_values=silver`, and for
 * subjects whose staff or organisation policy requires it (D35).
 */
export function createTwoFactorAuthorizeGateMiddleware(options: {
  auth: ReturnType<typeof createAuth>;
  db: IdentityDatabase;
  sessions: Pick<OidcRpSessionRepository, "findIdentitySession">;
  readRequirement: (subjectId: string) => Promise<TwoFactorRequirement>;
  issuerOrigin: string;
}): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname.replace(/\/+$/, "");
    if (path !== `${AUTH_ROUTE_PATH}/oauth2/authorize`) {
      await next();
      return;
    }
    const params = new URL(c.req.url).searchParams;
    const requestsSilver = requestsSilverAcr(params.get("acr_values"));
    const silent = (params.get("prompt") ?? "").split(/\s+/).includes("none");
    if (requestsSilver && silent) {
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

    const requirement = requirementForClient(await options.readRequirement(subjectId), clientId);
    if (!requestsSilver && !requirement.required) {
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

    const step = decideAuthorizeTwoFactorStep({
      requestsSilver,
      requiredByPolicy: requirement.required,
      mfaCompletedAt: identitySession.mfaCompletedAt,
      twoFactorEnabled: Boolean(subject?.twoFactorEnabled),
      canEnrolTotp: Boolean(credentialAccount?.id),
    });

    if (step === "pass") {
      await next();
      return;
    }
    if (silent) {
      return c.redirect(
        oauthErrorRedirect(
          redirectUri,
          state,
          "interaction_required",
          "Two-step verification is required to continue",
        ),
        302,
      );
    }
    if (step === "verify") {
      const twoFactor = new URL("/two-factor", options.issuerOrigin);
      appendOidcAuthorizeParams(twoFactor, params, { ensureClientId: clientId });
      return c.redirect(twoFactor.toString(), 302);
    }
    if (step === "setup") {
      const setup = new URL("/two-factor/setup", options.issuerOrigin);
      appendOidcAuthorizeParams(setup, params, { ensureClientId: clientId });
      const hint = requestsSilver ? null : requiredByHint(requirement);
      if (hint) setup.searchParams.set("required_by", hint);
      return c.redirect(setup.toString(), 302);
    }
    if (!requestsSilver) {
      // A policy asks for two-step verification and there is no password to enrol an
      // authenticator app with (the person signs in only with Google or Apple): say so, and
      // start the one step they can take, instead of returning an error nobody can read.
      const password = new URL("/two-factor/password", options.issuerOrigin);
      appendOidcAuthorizeParams(password, params, { ensureClientId: clientId });
      const hint = requiredByHint(requirement);
      if (hint) password.searchParams.set("required_by", hint);
      return c.redirect(password.toString(), 302);
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
