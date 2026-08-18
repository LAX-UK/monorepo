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

  async consume(codeHash: string): Promise<string | null> {
    const value = this.values.get(codeHash) ?? null;
    this.values.delete(codeHash);
    return value;
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
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      600,
      () => new Date("2026-08-13T05:05:00Z"),
    );
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=raw-secret-code" }),
      "identity-session-1",
    );
    expect(correlations.values.has("raw-secret-code")).toBe(false);
    expect(correlations.values.has(hashAuthorizationCode("raw-secret-code"))).toBe(true);

    const claims = await coordinator.runTokenRequest("raw-secret-code", () =>
      coordinator.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
    );
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
        lastStepUpAt: null,
      }),
      600,
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
        lastStepUpAt: null,
      }),
      600,
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
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      600,
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

  it("reports silver for a recognized recent step-up but not account capability", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-step-up",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: new Date("2026-08-13T05:04:00Z"),
      mfaCompletedAt: null,
      lastStepUpAt: new Date("2026-08-13T05:04:00Z"),
    });
    const coordinator = new OidcSessionCoordinator(
      correlations,
      repository,
      600,
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
      acr: "urn:mace:incommon:iap:silver",
      amr: ["pwd"],
    });
  });

  it("allows only one concurrent exchange to consume a correlation", async () => {
    const correlations = new MemoryCorrelationStore();
    const repository = makeRepository({
      id: "identity-session-3",
      subjectId: "subject-1",
      createdAt: new Date("2026-08-13T05:00:00Z"),
      lastPasswordAuthAt: null,
      mfaCompletedAt: null,
      lastStepUpAt: null,
    });
    const coordinator = new OidcSessionCoordinator(correlations, repository, 600);
    await coordinator.captureAuthorizationSession(
      Response.json({ redirectURI: "https://lax.bid/callback?code=concurrent-code" }),
      "identity-session-3",
    );

    const results = await Promise.allSettled(
      [1, 2].map(() =>
        coordinator.runTokenRequest("concurrent-code", () =>
          coordinator.resolveIdTokenClaims({ subjectId: "subject-1", clientId: "lax-bid-web" }),
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
