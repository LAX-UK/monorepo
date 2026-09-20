import { type TokenResponse, validateOAuthState } from "../oidc.js";
import type { ShopIdentitySession } from "../session.js";
import type {
  AuthenticatedSessionWriter,
  IdentityTokenVerifier,
  OAuthCodeExchanger,
  ShopProfileDirectory,
} from "./ports/oauth-callback.ports.js";

export type CompleteOAuthCallbackInput = {
  session: ShopIdentitySession | null;
  receivedState: string | null;
  code: string | null;
  oauthError: string | null;
};

export type CompleteOAuthCallbackResult =
  | { kind: "session_expired" }
  | { kind: "error"; code: string }
  | { kind: "disabled" }
  | { kind: "authenticated"; idToken: string; refreshToken: string; sessionId: string };

export type CompleteOAuthCallbackDeps = {
  codeExchanger: OAuthCodeExchanger;
  tokenVerifier: IdentityTokenVerifier;
  profiles: ShopProfileDirectory;
  sessions: AuthenticatedSessionWriter;
};

export async function completeOAuthCallback(
  deps: CompleteOAuthCallbackDeps,
  input: CompleteOAuthCallbackInput,
): Promise<CompleteOAuthCallbackResult> {
  const session = input.session;
  const pending = session?.oauth;
  if (!session || !pending) {
    return { kind: "session_expired" };
  }

  if (!validateOAuthState(pending.state, input.receivedState)) {
    return { kind: "error", code: "invalid_state" };
  }

  if (!input.code) {
    return { kind: "error", code: input.oauthError ?? "unknown" };
  }

  let tokenResponse: TokenResponse;
  try {
    tokenResponse = await deps.codeExchanger.exchange({
      code: input.code,
      codeVerifier: pending.codeVerifier,
    });
  } catch {
    return { kind: "error", code: "token_exchange_failed" };
  }

  const decodedClaims = deps.tokenVerifier.decode(tokenResponse.id_token);
  if (!deps.tokenVerifier.validateClaims(decodedClaims, pending.nonce)) {
    return { kind: "error", code: "invalid_id_token" };
  }

  const verified = await deps.tokenVerifier.verify(tokenResponse.id_token);
  if (!verified) {
    return { kind: "error", code: "invalid_id_token" };
  }

  const email =
    typeof verified.payload.email === "string"
      ? verified.payload.email
      : (decodedClaims.email ?? null);
  const name =
    typeof verified.payload.name === "string"
      ? verified.payload.name
      : (decodedClaims.name ?? null);

  await deps.profiles.upsert({
    identitySubjectId: verified.subject,
    email,
    name,
  });

  const profile = await deps.profiles.find(verified.subject);
  if (profile?.disabledAt) {
    await deps.sessions.invalidate(session.id);
    return { kind: "disabled" };
  }

  const sid = typeof verified.payload.sid === "string" ? verified.payload.sid : null;
  if (!sid) {
    return { kind: "error", code: "missing_sid" };
  }

  if (!tokenResponse.refresh_token) {
    return { kind: "error", code: "missing_refresh_token" };
  }

  const sessionId = await deps.sessions.authenticate({
    id: session.id,
    subject: verified.subject,
    sid,
  });

  return {
    kind: "authenticated",
    idToken: tokenResponse.id_token,
    refreshToken: tokenResponse.refresh_token,
    sessionId,
  };
}
