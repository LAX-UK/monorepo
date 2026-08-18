import { describe, expect, it, vi } from "vitest";
import {
  HttpIdentityIssuerClient,
  IdentityIssuerClientError,
} from "./http-identity-issuer.client.js";

describe("HttpIdentityIssuerClient", () => {
  it("posts sign-up to the issuer and returns the user id", async () => {
    const fetchImpl = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      Response.json({ user: { id: "user-1" } }, { status: 200 }),
    );
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com/",
      fetchImpl,
      defaultOrigin: "https://app.example.com/path",
    });

    await expect(
      client.signUpEmail({
        name: "Ada",
        email: "ada@example.com",
        password: "long-password",
        callbackURL: "https://app.example.com/verify-email",
      }),
    ).resolves.toEqual({ userId: "user-1" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://identity.example.com/api/auth/sign-up/email",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get("origin")).toBe("https://app.example.com");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "long-password",
      callbackURL: "https://app.example.com/verify-email",
    });
  });

  it("forwards only request headers needed by the issuer", async () => {
    const fetchImpl = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
    });
    await client.sendVerificationEmail({
      email: "ada@example.com",
      callbackURL: "https://app.example.com/verify-email",
      headers: new Headers({
        cookie: "session=abc",
        origin: "https://app.example.com",
        authorization: "Bearer must-not-forward",
        "x-forwarded-for": "203.0.113.1",
      }),
    });

    const headers = (fetchImpl.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get("cookie")).toBe("session=abc");
    expect(headers.get("origin")).toBe("https://app.example.com");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.1");
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("maps issuer HTTP failures to a typed error", async () => {
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl: vi.fn(async () =>
        Response.json(
          { message: "Email already exists", code: "USER_ALREADY_EXISTS" },
          {
            status: 422,
          },
        ),
      ),
    });

    const error = await client
      .requestPasswordReset({
        email: "ada@example.com",
        redirectTo: "https://app.example.com/reset-password",
      })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(IdentityIssuerClientError);
    expect(error).toMatchObject({
      kind: "http",
      status: 422,
      code: "USER_ALREADY_EXISTS",
      message: "Email already exists",
    });
  });

  it("maps aborted requests to a timeout error", async () => {
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      timeoutMs: 5,
      fetchImpl: vi.fn(
        async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    });

    await expect(
      client.requestMagicLink({
        email: "ada@example.com",
        callbackURL: "https://app.example.com/auth/activate/set-password",
        errorCallbackURL: "https://app.example.com/auth/activate/expired",
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("caches machine tokens and keeps cookie session tokens out of URLs", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/internal/oauth/token")) {
        return Response.json({
          access_token: "machine-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      return Response.json({
        hasCredential: true,
        lastPasswordAuthAt: "2026-01-01T00:00:00.000Z",
      });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await client.stepUpStatus({ subjectId: "user-1", sessionToken: "raw-cookie-token" });
    await client.stepUpStatus({ subjectId: "user-1", sessionToken: "raw-cookie-token" });

    expect(
      fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/internal/oauth/token")),
    ).toHaveLength(1);
    for (const [url] of fetchImpl.mock.calls) {
      expect(String(url)).not.toContain("raw-cookie-token");
    }
    const operationInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(operationInit.body))).toEqual({ sessionToken: "raw-cookie-token" });
  });

  it("parses lifecycle state from machine subject reads", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({
          access_token: "machine-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      return Response.json({
        subject: {
          id: "retired",
          email: "retired@example.com",
          name: "Retired User",
          emailVerified: true,
          identityDisabledAt: "2026-08-01T00:00:00.000Z",
          mergedIntoSubjectId: "canonical",
        },
      });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(client.readSubject("retired")).resolves.toEqual({
      id: "retired",
      email: "retired@example.com",
      name: "Retired User",
      emailVerified: true,
      identityDisabledAt: new Date("2026-08-01T00:00:00.000Z"),
      mergedIntoSubjectId: "canonical",
    });
  });
});
