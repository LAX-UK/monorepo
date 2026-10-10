import { describe, expect, it, vi } from "vitest";
import {
  OidcAuthorizationCodeCorrelationError,
  type OidcCodeCorrelationStore,
  type OidcIdentitySessionEvidence,
  type OidcRpSessionRepository,
  OidcSessionCoordinator,
  createAuthorizationServerErrorResponse,
  hashAuthorizationCode,
  readAuthorizationCodeFromResponse,
} from "./oidc-session-coordinator.js";

class MemoryCorrelationStore implements OidcCodeCorrelationStore {
  readonly values = new Map<string, string>();

  async putIfAbsent(codeHash: string, identitySessionId: string): Promise<boolean> {
    if (this.values.has(codeHash)) return false;
    this.values.set(codeHash, identitySessionId);
    return true;
  }

  async peek(codeHash: string): Promise<string | null> {
    return this.values.get(codeHash) ?? null;
  }

  async finalize(codeHash: string): Promise<void> {
    this.values.delete(codeHash);
  }
}

function makeRepository(
  evidence: OidcIdentitySessionEvidence,
): OidcRpSessionRepository & { upsertRpSession: ReturnType<typeof vi.fn> } {
  return {
    findIdentitySession: vi.fn(async (id: string) => (id === evidence.id ? evidence : null)),
    upsertRpSession: vi.fn(async () => undefined),
  };
}

describe("OIDC authorization-session coordination", () => {
  it("extracts codes from Better Auth authorize and consent response contracts", async () => {
    expect(
      await readAuthorizationCodeFromResponse(
        Response.json({ redirect: true, url: "https://lax.bid/callback?code=authorize-code" }),
      ),
    ).toBe("authorize-code");
    expect(
      await readAuthorizationCodeFromResponse(
        Response.json({ redirectURI: "https://lax.bid/callback?code=consent-code" }),
      ),
    ).toBe("consent-code");
    expect(
      await readAuthorizationCodeFromResponse(
        new Response(null, {
          status: 302,
          headers: { location: "https://lax.bid/callback?code=redirect-code" },
        }),
      ),
    ).toBe("redirect-code");
    expect(
      await readAuthorizationCodeFromResponse(
        new Response(null, {
          status: 302,
          headers: { location: "/callback?code=relative-code" },
        }),
        "https://test-auth.lax.bid/api/auth/verify-email",
      ),
    ).toBe("relative-code");
  });

  it("stores only a hash, consumes once, and emits truthful bronze claims", async () => {
    const correlations = new MemoryCorrelationStore();
    const createdAt = new Date("2026-08-13T05:00:00.123Z");
    const repository = makeRepository({
      id: "identity-session-1",
      subjectId: "subject-1",
      createdAt,
      lastPasswordAuthAt: createdAt,
      mfaCompletedAt: null,
      socialAuthAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      () => new Date("2026-08-13T05:05:00Z"),
    );
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=raw-secret-code" }),
      "identity-session-1",
    );
    expect(correlations.values.has("raw-secret-code")).toBe(false);
    expect(correlations.values.has(hashAuthorizationCode("raw-secret-code"))).toBe(true);

    const claims = await coordinator
      .runTokenRequest("raw-secret-code", async () => {
        const resolved = await coordinator.resolveIdTokenClaims({
          subjectId: "subject-1",
          clientId: "lax-bid-web",
        });
        return Response.json(resolved);
      })
      .then(async (response) => response.json());
    expect(claims).toEqual({
      sid: "identity-session-1",
      auth_time: Math.floor(createdAt.getTime() / 1_000),
      acr: "urn:mace:incommon:iap:bronze",
      amr: ["pwd"],
    });
    expect(repository.upsertRpSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "lax-bid-web",
        sid: "identity-session-1",
        identitySessionId: "identity-session-1",
      }),
    );
    await expect(
      coordinator.runTokenRequest("raw-secret-code", () =>
        coordinator.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
      ),
    ).rejects.toBeInstanceOf(OidcAuthorizationCodeCorrelationError);
  });

  it("uses the same invalid-grant signal for missing and invalid correlations", async () => {
    const missing = new OidcSessionCoordinator(
      new MemoryCorrelationStore(),
      makeRepository({
        id: "identity-session-unused",
        subjectId: "subject-1",
        createdAt: new Date("2026-08-13T05:00:00Z"),
        lastPasswordAuthAt: null,
        mfaCompletedAt: null,
        socialAuthAt: null,
        lastStepUpAt: null,
      }),
    );
    await expect(
      missing.runTokenRequest("never-captured", () =>
        missing.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
      ),
    ).rejects.toBeInstanceOf(OidcAuthorizationCodeCorrelationError);

    const correlations = new MemoryCorrelationStore();
    const invalid = new OidcSessionCoordinator(
      correlations,
      makeRepository({
        id: "identity-session-1",
        subjectId: "different-subject",
        createdAt: new Date("2026-08-13T05:00:00Z"),
        lastPasswordAuthAt: null,
        mfaCompletedAt: null,
        socialAuthAt: null,
        lastStepUpAt: null,
      }),
    );
    await invalid.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=invalid-correlation" }),
      "identity-session-1",
    );
    await expect(
      invalid.runTokenRequest("invalid-correlation", () =>
        invalid.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
      ),
    ).rejects.toBeInstanceOf(OidcAuthorizationCodeCorrelationError);
  });

  it("returns a safe OAuth server_error redirect when authorization has no session", async () => {
    const response = await createAuthorizationServerErrorResponse(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://registered.example/callback?code=issued-code&state=opaque-client-state",
        },
      }),
    );

    expect(response.status).toBe(302);
    const redirect = new URL(response.headers.get("location") ?? "");
    expect(redirect.origin).toBe("https://registered.example");
    expect(redirect.pathname).toBe("/callback");
    expect(redirect.searchParams.get("state")).toBe("opaque-client-state");
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(redirect.searchParams.get("error")).toBe("server_error");
  });

  it("preserves Better Auth's JSON authorize response contract for server_error", async () => {
    const response = await createAuthorizationServerErrorResponse(
      Response.json({
        redirect: true,
        url: "https://registered.example/callback?code=issued-code&state=state-1",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { redirect: boolean; url: string };
    expect(body.redirect).toBe(true);
    const redirect = new URL(body.url);
    expect(redirect.searchParams.get("state")).toBe("state-1");
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(redirect.searchParams.get("error")).toBe("server_error");
  });

  it("reports silver after this exact session completes MFA", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-2",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: new Date("2026-08-13T05:04:00Z"),
      mfaCompletedAt: new Date("2026-08-13T05:01:00Z"),
      socialAuthAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      () => new Date("2026-08-13T05:05:00Z"),
    );
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=mfa-code" }),
      "identity-session-2",
    );
    await expect(
      coordinator.runTokenRequest("mfa-code", () =>
        coordinator.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-shop-web" }),
      ),
    ).resolves.toMatchObject({
      acr: "urn:mace:incommon:iap:silver",
      amr: ["pwd", "otp"],
    });
  });

  it("reports bronze when only a recent password step-up occurred without MFA", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-step-up",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: new Date("2026-08-13T05:04:00Z"),
      mfaCompletedAt: null,
      socialAuthAt: null,
      lastStepUpAt: new Date("2026-08-13T05:04:00Z"),
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      () => new Date("2026-08-13T05:05:00Z"),
    );
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=step-up-code" }),
      "identity-session-step-up",
    );
    await expect(
      coordinator.runTokenRequest("step-up-code", () =>
        coordinator.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
      ),
    ).resolves.toMatchObject({
      acr: "urn:mace:incommon:iap:bronze",
      amr: ["pwd"],
    });
  });

  it("reuses the same correlation within one token request when claims resolve twice", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-double",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: new Date("2026-08-13T05:00:00Z"),
      mfaCompletedAt: null,
      socialAuthAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(correlations, repository);
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=double-resolve-code" }),
      "identity-session-double",
    );

    await coordinator.runTokenRequest("double-resolve-code", async () => {
      const first = await coordinator.resolveIdTokenClaims({
        subjectId: "subject-1",
        clientId: "lax-shop-web",
      });
      const second = await coordinator.resolveIdTokenClaims({
        subjectId: "subject-1",
        clientId: "lax-shop-web",
      });
      expect(second).toEqual(first);
      return Response.json(first);
    });
    expect(repository.upsertRpSession).toHaveBeenCalledTimes(2);
  });

  it("allows a failed token response to retry claim resolution with the same code", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-retry",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: new Date("2026-08-13T05:00:00Z"),
      mfaCompletedAt: null,
      socialAuthAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(correlations, repository);
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=retry-code" }),
      "identity-session-retry",
    );

    await coordinator.runTokenRequest("retry-code", async () =>
      Response.json({ error: "server_error" }, { status: 500 }),
    );
    expect(correlations.values.has(hashAuthorizationCode("retry-code"))).toBe(true);

    await expect(
      coordinator.runTokenRequest("retry-code", async () => {
        const claims = await coordinator.resolveIdTokenClaims({
          subjectId: "subject-1",
          clientId: "lax-bid-web",
        });
        return Response.json(claims);
      }),
    ).resolves.toMatchObject({ status: 200 });
    expect(correlations.values.has(hashAuthorizationCode("retry-code"))).toBe(false);
  });

  it("allows only one concurrent exchange to finalize a correlation", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-3",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: null,
      mfaCompletedAt: null,
      socialAuthAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(correlations, repository);
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=concurrent-code" }),
      "identity-session-3",
    );

    const results = await Promise.allSettled(
      [1, 2].map(() =>
        coordinator.runTokenRequest("concurrent-code", async () => {
          await coordinator.resolveIdTokenClaims({
            subjectId: "subject-1",
            clientId: "lax-bid-web",
          });
          return Response.json({ access_token: "token" });
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(correlations.values.has(hashAuthorizationCode("concurrent-code"))).toBe(false);
  });
});
