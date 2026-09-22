import { describe, expect, it, vi } from "vitest";
import {
  type CompleteOAuthCallbackDeps,
  type CompleteOAuthCallbackInput,
  completeOAuthCallback,
} from "./complete-oauth-callback.handler.js";

const session = {
  id: "session-1",
  subject: null,
  sid: null,
  oauth: {
    state: "expected-state",
    nonce: "expected-nonce",
    codeVerifier: "verifier",
  },
};

const input: CompleteOAuthCallbackInput = {
  session,
  receivedState: "expected-state",
  code: "authorization-code",
  oauthError: null,
};

function createDeps(): CompleteOAuthCallbackDeps {
  return {
    codeExchanger: {
      exchange: vi.fn(async () => ({ id_token: "id-token", refresh_token: "refresh-token" })),
    },
    tokenVerifier: {
      decode: vi.fn(() => ({
        sub: "subject-1",
        iss: "https://identity.example",
        aud: "lax-shop-web",
        nonce: "expected-nonce",
        email: "shopper@example.com",
        name: "Shopper",
        sid: "provider-session",
      })),
      validateClaims: vi.fn(() => true),
      verify: vi.fn(async () => ({
        subject: "subject-1",
        payload: {
          email: "shopper@example.com",
          name: "Shopper",
          sid: "provider-session",
        },
      })),
    },
    profiles: {
      upsert: vi.fn(async () => undefined),
      find: vi.fn(async () => ({
        identitySubjectId: "subject-1",
        email: "shopper@example.com",
        name: "Shopper",
        disabledAt: null,
      })),
    },
    sessions: {
      authenticate: vi.fn(async () => "new-authenticated-session-id0123456789012"),
      invalidate: vi.fn(async () => undefined),
    },
  };
}

describe("completeOAuthCallback", () => {
  it("distinguishes missing sessions, state failures, and provider errors", async () => {
    const deps = createDeps();

    await expect(completeOAuthCallback(deps, { ...input, session: null })).resolves.toEqual({
      kind: "session_expired",
    });
    await expect(
      completeOAuthCallback(deps, { ...input, receivedState: "wrong" }),
    ).resolves.toEqual({ kind: "error", code: "invalid_state" });
    await expect(
      completeOAuthCallback(deps, {
        ...input,
        code: null,
        oauthError: "access_denied",
      }),
    ).resolves.toEqual({ kind: "error", code: "access_denied" });
  });

  it("maps token exchange and verification failures to stable error codes", async () => {
    const exchangeFailure = createDeps();
    vi.mocked(exchangeFailure.codeExchanger.exchange).mockRejectedValue(new Error("offline"));
    await expect(completeOAuthCallback(exchangeFailure, input)).resolves.toEqual({
      kind: "error",
      code: "token_exchange_failed",
    });

    const verificationFailure = createDeps();
    vi.mocked(verificationFailure.tokenVerifier.verify).mockResolvedValue(null);
    await expect(completeOAuthCallback(verificationFailure, input)).resolves.toEqual({
      kind: "error",
      code: "invalid_id_token",
    });
  });

  it("invalidates disabled profiles without authenticating the session", async () => {
    const deps = createDeps();
    vi.mocked(deps.profiles.find).mockResolvedValue({
      identitySubjectId: "subject-1",
      email: null,
      name: null,
      disabledAt: new Date(),
    });

    await expect(completeOAuthCallback(deps, input)).resolves.toEqual({
      kind: "disabled",
    });
    expect(deps.sessions.invalidate).toHaveBeenCalledWith("session-1");
    expect(deps.sessions.authenticate).not.toHaveBeenCalled();
  });

  it("persists the profile and authenticates a valid callback", async () => {
    const deps = createDeps();

    await expect(completeOAuthCallback(deps, input)).resolves.toEqual({
      kind: "authenticated",
      idToken: "id-token",
      refreshToken: "refresh-token",
      sessionId: "new-authenticated-session-id0123456789012",
    });
    expect(deps.profiles.upsert).toHaveBeenCalledWith({
      identitySubjectId: "subject-1",
      email: "shopper@example.com",
      name: "Shopper",
    });
    expect(deps.sessions.authenticate).toHaveBeenCalledWith({
      id: "session-1",
      subject: "subject-1",
      sid: "provider-session",
    });
  });

  it("returns refresh token for server-side persistence but not access tokens", async () => {
    const deps = createDeps();
    vi.mocked(deps.codeExchanger.exchange).mockResolvedValue({
      id_token: "id-token",
      access_token: "must-not-leak",
      refresh_token: "refresh-for-store",
    });

    const result = await completeOAuthCallback(deps, input);
    expect(result).toEqual({
      kind: "authenticated",
      idToken: "id-token",
      refreshToken: "refresh-for-store",
      sessionId: "new-authenticated-session-id0123456789012",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("access_token");
  });

  it("fails when the issuer omits a refresh token", async () => {
    const deps = createDeps();
    vi.mocked(deps.codeExchanger.exchange).mockResolvedValue({ id_token: "id-token" });
    await expect(completeOAuthCallback(deps, input)).resolves.toEqual({
      kind: "error",
      code: "missing_refresh_token",
    });
  });
});
