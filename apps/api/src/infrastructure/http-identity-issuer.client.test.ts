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

  it.each([
    ["subject", (client: HttpIdentityIssuerClient) => client.readSubject("missing")],
    ["security status", (client: HttpIdentityIssuerClient) => client.readSecurityStatus("missing")],
  ])("treats subject_not_found as absent for %s reads", async (_label, read) => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({ access_token: "machine-token", expires_in: 300 });
      }
      return Response.json(
        { code: "subject_not_found", message: "Subject not found" },
        { status: 404 },
      );
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(read(client)).resolves.toBeNull();
  });

  it.each([
    ["subject", (client: HttpIdentityIssuerClient) => client.readSubject("user-1")],
    ["security status", (client: HttpIdentityIssuerClient) => client.readSecurityStatus("user-1")],
  ])("propagates generic 404 failures for %s reads", async (_label, read) => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({ access_token: "machine-token", expires_in: 300 });
      }
      return Response.json({ message: "Route not found" }, { status: 404 });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(read(client)).rejects.toMatchObject({
      kind: "http",
      status: 404,
      message: "Route not found",
    });
  });

  it("parses authoritative security status from the machine boundary", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({
          access_token: "machine-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      return Response.json({
        status: {
          twoFactorEnabled: true,
          phoneNumber: "+442012345678",
          phoneNumberVerified: true,
          pendingNewEmail: "next@example.com",
          emailChangeExpiresAt: "2026-08-21T00:00:00.000Z",
        },
      });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(client.readSecurityStatus("user-1")).resolves.toEqual({
      twoFactorEnabled: true,
      phoneNumber: "+442012345678",
      phoneNumberVerified: true,
      pendingNewEmail: "next@example.com",
      emailChangeExpiresAt: new Date("2026-08-21T00:00:00.000Z"),
    });
  });

  it("writes org two-factor policy and batches status lookups at 200 ids", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/internal/oauth/token")) {
        return Response.json({
          access_token: "machine-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      if (url.endsWith("/two-factor-status")) {
        const { subjectIds } = JSON.parse(String(init?.body)) as { subjectIds: string[] };
        return Response.json({
          statuses: subjectIds.map((subjectId) => ({ subjectId, twoFactorEnabled: true })),
        });
      }
      return Response.json({
        policy: { required: true, setBySubjectId: "user-1", setAt: "2026-10-01T00:00:00.000Z" },
        coverage: { members: 5, enrolled: 4 },
      });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    const view = await client.writeTwoFactorPolicy(
      { scope: "org", legalEntityId: "entity-1" },
      { required: true, actorSubjectId: "user-1" },
    );
    expect(view.policy.setAt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    const [writeUrl, writeInit] = fetchImpl.mock.calls[1] ?? [];
    expect(String(writeUrl)).toBe(
      "https://identity.example.com/internal/identity/two-factor-policies/orgs/entity-1",
    );
    expect(writeInit?.method).toBe("PUT");

    const ids = Array.from({ length: 250 }, (_, index) => `user-${index}`);
    const statuses = await client.readTwoFactorStatuses(ids);
    expect(statuses.size).toBe(250);
    expect(
      fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/two-factor-status")),
    ).toHaveLength(2);
  });

  describe("email change", () => {
    function clientFor(respond: (url: string, init?: RequestInit) => Response) {
      const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/internal/oauth/token")) {
          return Response.json({
            access_token: "machine-token",
            token_type: "Bearer",
            expires_in: 300,
          });
        }
        return respond(url, init);
      });
      const client = new HttpIdentityIssuerClient({
        issuerBaseUrl: "https://identity.example.com",
        fetchImpl,
        machineClientId: "api-service",
        machineClientSecret: "machine-secret-at-least-32-characters",
      });
      return { client, fetchImpl };
    }

    it("starts a change by naming only the new address; the issuer owns expiry and emails", async () => {
      const { client, fetchImpl } = clientFor(() =>
        Response.json({ pendingEmail: "new@example.com" }),
      );
      await client.startEmailChange({ subjectId: "user-1", newEmail: "new@example.com" });
      const [url, init] = fetchImpl.mock.calls[1] ?? [];
      expect(String(url)).toBe(
        "https://identity.example.com/internal/identity/subjects/user-1/email-change/start",
      );
      expect(JSON.parse(String(init?.body))).toEqual({ newEmail: "new@example.com" });
    });

    it("surfaces the issuer's refusal code so Bid can map it", async () => {
      const { client } = clientFor(() => Response.json({ error: "email_taken" }, { status: 409 }));
      await expect(
        client.startEmailChange({ subjectId: "user-1", newEmail: "taken@example.com" }),
      ).rejects.toMatchObject({ status: 409, code: "email_taken" });
    });

    it("confirms with the emailed token alone and reads who it was for", async () => {
      const { client, fetchImpl } = clientFor(() =>
        Response.json({ subjectId: "user-1", completed: true, confirmedFor: "new" }),
      );
      await expect(client.confirmEmailChange({ token: "signed.token" })).resolves.toEqual({
        subjectId: "user-1",
        completed: true,
        confirmedFor: "new",
      });
      const [url, init] = fetchImpl.mock.calls[1] ?? [];
      expect(String(url)).toBe(
        "https://identity.example.com/internal/identity/email-change/confirm",
      );
      expect(JSON.parse(String(init?.body))).toEqual({ token: "signed.token" });
    });

    it("rejects a confirmation answer that does not name the subject", async () => {
      const { client } = clientFor(() => Response.json({ completed: true }));
      await expect(client.confirmEmailChange({ token: "t" })).rejects.toBeInstanceOf(
        IdentityIssuerClientError,
      );
    });
  });

  describe("account deletion", () => {
    function clientFor(respond: () => Response) {
      const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: RequestInit) => {
        if (String(input).endsWith("/internal/oauth/token")) {
          return Response.json({
            access_token: "machine-token",
            token_type: "Bearer",
            expires_in: 300,
          });
        }
        return respond();
      });
      const client = new HttpIdentityIssuerClient({
        issuerBaseUrl: "https://identity.example.com",
        fetchImpl,
        machineClientId: "api-service",
        machineClientSecret: "machine-secret-at-least-32-characters",
      });
      return { client, fetchImpl };
    }

    it.each([
      [{ outcome: "requested", requestedAt: "2026-10-23T12:00:00.000Z" }],
      [{ outcome: "already_requested", requestedAt: "2026-10-01T09:00:00.000Z" }],
      [
        {
          outcome: "not_eligible",
          status: {
            requestedAt: null,
            products: [
              {
                product: "bid",
                state: "blocked",
                blockers: [{ code: "pay", message: "Pay it.", href: null }],
              },
            ],
          },
        },
      ],
    ])("returns Identity's outcome %j unchanged", async (outcome) => {
      const { client, fetchImpl } = clientFor(() => Response.json(outcome));
      await expect(client.requestAccountDeletion("user-1")).resolves.toEqual(outcome);
      expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
        "https://identity.example.com/internal/identity/subjects/user-1/deletion-request",
      );
    });

    it("rejects an answer it does not recognise instead of treating it as success", async () => {
      const { client } = clientFor(() => Response.json({ ok: true }));
      await expect(client.requestAccountDeletion("user-1")).rejects.toBeInstanceOf(
        IdentityIssuerClientError,
      );
    });
  });
});

describe("HttpIdentityIssuerClient address book", () => {
  const ID = "33333333-3333-4333-8333-333333333333";
  const wire = {
    id: ID,
    label: "Home",
    recipientName: "Ada",
    line1: "1 High Street",
    line2: null,
    city: "London",
    region: null,
    postcode: "SW1A 1AA",
    country: "GB",
    phone: null,
    isDefaultShipping: true,
    isDefaultBilling: true,
    version: 2,
    createdAt: "2026-10-23T12:00:00.000Z",
    updatedAt: "2026-10-23T12:00:00.000Z",
  };

  function client(answer: (url: string, init: RequestInit) => Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/internal/oauth/token")) {
        return Response.json({ access_token: "machine-token", expires_in: 300 });
      }
      calls.push({ url, init: init ?? {} });
      return answer(url, init ?? {});
    });
    return {
      calls,
      issuer: new HttpIdentityIssuerClient({
        issuerBaseUrl: "https://identity.example.com",
        fetchImpl: fetchImpl as never,
        machineClientId: "api-service",
        machineClientSecret: "machine-secret-that-is-long-enough-0123",
      }),
    };
  }

  it("lists, creates, updates, deletes and sets a default through the machine routes", async () => {
    const { issuer, calls } = client((_url, init) =>
      init.method === "DELETE"
        ? Response.json({ deleted: true })
        : init.method === "GET"
          ? Response.json({ addresses: [wire] })
          : Response.json({ address: wire }),
    );
    const input = {
      label: "Home",
      recipientName: "Ada",
      line1: "1 High Street",
      line2: null,
      city: "London",
      region: null,
      postcode: "SW1A 1AA",
      country: "GB",
      phone: null,
    };
    expect(await issuer.listAddresses("user/1")).toEqual([wire]);
    await issuer.createAddress("user/1", input);
    await issuer.updateAddress("user/1", ID, 2, input);
    await issuer.deleteAddress("user/1", ID, 2);
    await issuer.setDefaultAddress("user/1", ID, "billing");

    const base = "https://identity.example.com/internal/identity/subjects/user%2F1/addresses";
    expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      `GET ${base}`,
      `POST ${base}`,
      `PATCH ${base}/${ID}`,
      `DELETE ${base}/${ID}?expectedVersion=2`,
      `POST ${base}/${ID}/default`,
    ]);
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({ address: input, expectedVersion: 2 });
    expect(JSON.parse(String(calls[4]?.init.body))).toEqual({ kind: "billing" });
  });

  it("rejects with the issuer's refusal code and on an unexpected body", async () => {
    const refused = client(() => Response.json({ error: "version_conflict" }, { status: 409 }));
    await expect(refused.issuer.deleteAddress("u", ID, 1)).rejects.toMatchObject({
      status: 409,
      code: "version_conflict",
    });
    const broken = client(() => Response.json({ nope: true }));
    await expect(broken.issuer.listAddresses("u")).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("posts a two-step reset to the issuer's machine route for the subject", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: RequestInit) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({ access_token: "machine-token", expires_in: 300 });
      }
      return Response.json({ ok: true });
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(client.resetTwoFactor("user/1")).resolves.toBeUndefined();

    const call = fetchImpl.mock.calls.find(([url]) => String(url).includes("two-factor/reset"));
    expect(String(call?.[0])).toBe(
      "https://identity.example.com/internal/identity/subjects/user%2F1/two-factor/reset",
    );
    expect(call?.[1]).toMatchObject({ method: "POST" });
  });

  it("surfaces an unknown subject on reset as an http 404", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith("/internal/oauth/token")) {
        return Response.json({ access_token: "machine-token", expires_in: 300 });
      }
      return Response.json(
        { code: "subject_not_found", message: "Subject not found" },
        { status: 404 },
      );
    });
    const client = new HttpIdentityIssuerClient({
      issuerBaseUrl: "https://identity.example.com",
      fetchImpl,
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
    });

    await expect(client.resetTwoFactor("missing")).rejects.toMatchObject({
      kind: "http",
      status: 404,
      code: "subject_not_found",
    });
  });
});
