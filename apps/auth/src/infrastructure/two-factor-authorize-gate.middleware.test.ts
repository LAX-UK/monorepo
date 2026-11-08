import type { TwoFactorRequirement } from "@auction/auth";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createTwoFactorAuthorizeGateMiddleware } from "./two-factor-authorize-gate.middleware.js";

const ISSUER = "https://auth.test";
const REDIRECT = "https://shop-admin.test/api/auth/callback";

function fakeDb(input: { twoFactorEnabled: boolean; hasPassword: boolean }) {
  const results = [
    [{ twoFactorEnabled: input.twoFactorEnabled }],
    input.hasPassword ? [{ id: "credential-1" }] : [],
  ];
  let call = 0;
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => results[call++] ?? [],
  };
  return { select: () => chain };
}

function setup(
  options: {
    requirement?: TwoFactorRequirement;
    mfaCompletedAt?: Date | null;
    socialAuthAt?: Date | null;
    twoFactorEnabled?: boolean;
    hasPassword?: boolean;
    signedIn?: boolean;
  } = {},
) {
  const readRequirement = vi.fn(
    async () => options.requirement ?? { required: false, sources: [] },
  );
  const app = new Hono();
  app.use(
    "/api/auth/*",
    createTwoFactorAuthorizeGateMiddleware({
      auth: {
        api: {
          getSession: async () =>
            options.signedIn === false
              ? null
              : { session: { id: "session-1" }, user: { id: "subject-1" } },
        },
      } as never,
      db: fakeDb({
        twoFactorEnabled: options.twoFactorEnabled ?? false,
        hasPassword: options.hasPassword ?? true,
      }) as never,
      sessions: {
        findIdentitySession: async () => ({
          id: "session-1",
          subjectId: "subject-1",
          createdAt: new Date(),
          lastPasswordAuthAt: new Date(),
          mfaCompletedAt: options.mfaCompletedAt ?? null,
          socialAuthAt: options.socialAuthAt ?? null,
          lastStepUpAt: null,
        }),
      },
      readRequirement,
      issuerOrigin: ISSUER,
    }),
  );
  app.get("/api/auth/oauth2/authorize", (c) => c.text("authorized"));
  return { app, readRequirement };
}

function authorize(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    client_id: "lax-shop-admin",
    redirect_uri: REDIRECT,
    response_type: "code",
    state: "state-1",
    ...extra,
  });
  return `${ISSUER}/api/auth/oauth2/authorize?${params}`;
}

const STAFF_REQUIRED: TwoFactorRequirement = { required: true, sources: [{ scope: "staff" }] };

describe("two-factor authorize gate", () => {
  it("lets optional two-step verification through without a challenge", async () => {
    const { app } = setup();

    const response = await app.request(authorize());

    expect(await response.text()).toBe("authorized");
  });

  it("forces setup with a reason when staff policy requires two-step verification", async () => {
    const { app } = setup({ requirement: STAFF_REQUIRED });

    const response = await app.request(authorize());

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/two-factor/setup");
    expect(location.searchParams.get("required_by")).toBe("staff");
    expect(location.searchParams.get("client_id")).toBe("lax-shop-admin");
  });

  it("asks an enrolled subject to verify when policy requires it", async () => {
    const { app } = setup({ requirement: STAFF_REQUIRED, twoFactorEnabled: true });

    const response = await app.request(authorize());

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor");
  });

  it("does not accept a social sign-in for a policy requirement: a person who can enrol is sent to set up", async () => {
    const { app } = setup({ requirement: STAFF_REQUIRED, socialAuthAt: new Date() });

    const response = await app.request(authorize());

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor/setup");
  });

  it("asks a person who signed in with Google and has two-step on for the code", async () => {
    const { app } = setup({
      requirement: STAFF_REQUIRED,
      socialAuthAt: new Date(),
      twoFactorEnabled: true,
    });

    const response = await app.request(authorize());

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor");
  });

  it("sends a social-only staff member to the set-password page, never to a bare error", async () => {
    const { app } = setup({
      requirement: STAFF_REQUIRED,
      socialAuthAt: new Date(),
      hasPassword: false,
    });

    const response = await app.request(authorize());

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(`${ISSUER}/two-factor/password`);
    expect(location.searchParams.get("required_by")).toBe("staff");
    expect(location.searchParams.get("client_id")).toBe("lax-shop-admin");
    expect(location.searchParams.get("error")).toBeNull();
  });

  describe("a social-only member of an organisation that requires two-step verification", () => {
    const ORG_REQUIRED: TwoFactorRequirement = {
      required: true,
      sources: [{ scope: "org", legalEntityId: "00000000-0000-4000-8000-00000000000a" }],
    };

    it("is sent to the set-password page by every product", async () => {
      for (const clientId of ["lax-bid-web", "lax-shop-web", "lax-art-web", "lax-shop-admin"]) {
        const { app } = setup({ requirement: ORG_REQUIRED, hasPassword: false });
        const response = await app.request(authorize({ client_id: clientId }));
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.origin + location.pathname, clientId).toBe(`${ISSUER}/two-factor/password`);
        expect(location.searchParams.get("required_by"), clientId).toBe("org");
        expect(location.searchParams.get("client_id"), clientId).toBe(clientId);
      }
    });

    it("keeps LAX Account reachable, so Security is where they set a password and an authenticator", async () => {
      const { app } = setup({ requirement: ORG_REQUIRED, hasPassword: false });

      const response = await app.request(authorize({ client_id: "lax-account-web" }));

      expect(await response.text()).toBe("authorized");
    });

    it("does not exempt LAX Account from a staff requirement", async () => {
      const { app } = setup({ requirement: STAFF_REQUIRED, hasPassword: false });

      const response = await app.request(authorize({ client_id: "lax-account-web" }));

      expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor/password");
    });

    it("does not exempt LAX Account when a staff requirement applies beside the organisation's", async () => {
      const { app } = setup({
        requirement: {
          required: true,
          sources: [{ scope: "staff" }, ...ORG_REQUIRED.sources],
        },
        hasPassword: false,
      });

      const response = await app.request(authorize({ client_id: "lax-account-web" }));

      expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor/password");
    });

    it("still sets up an organisation member who has a password, in LAX Account too", async () => {
      const { app } = setup({ requirement: ORG_REQUIRED, hasPassword: true });

      const other = await app.request(authorize({ client_id: "lax-shop-web" }));
      expect(new URL(other.headers.get("location") ?? "").pathname).toBe("/two-factor/setup");
      const account = await app.request(authorize({ client_id: "lax-account-web" }));
      expect(await account.text()).toBe("authorized");
    });

    it("answers a silent request with interaction_required, not the page", async () => {
      const { app } = setup({ requirement: ORG_REQUIRED, hasPassword: false });

      const response = await app.request(authorize({ client_id: "lax-shop-web", prompt: "none" }));

      expect(new URL(response.headers.get("location") ?? "").searchParams.get("error")).toBe(
        "interaction_required",
      );
    });
  });

  it("still passes a social sign-in when no requirement applies", async () => {
    const { app } = setup({ socialAuthAt: new Date(), hasPassword: false });

    const response = await app.request(authorize());

    expect(await response.text()).toBe("authorized");
  });

  it("returns interaction_required to silent requests that need two-step verification", async () => {
    const { app } = setup({ requirement: STAFF_REQUIRED });

    const response = await app.request(authorize({ prompt: "none" }));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(REDIRECT);
    expect(location.searchParams.get("error")).toBe("interaction_required");
    expect(location.searchParams.get("state")).toBe("state-1");
  });

  it("skips the policy lookup once the session completed two-step verification", async () => {
    const { app, readRequirement } = setup({
      requirement: STAFF_REQUIRED,
      mfaCompletedAt: new Date(),
    });

    const response = await app.request(authorize({ acr_values: OIDC_ACR_SILVER }));

    expect(await response.text()).toBe("authorized");
    expect(readRequirement).not.toHaveBeenCalled();
  });

  it("keeps Silver requests strict for social-only accounts", async () => {
    const { app } = setup({ socialAuthAt: new Date(), hasPassword: false });

    const response = await app.request(authorize({ acr_values: OIDC_ACR_SILVER }));

    expect(new URL(response.headers.get("location") ?? "").searchParams.get("error")).toBe(
      "unmet_authentication_requirements",
    );
  });

  it("leaves signed-out requests to the login flow", async () => {
    const { app, readRequirement } = setup({ signedIn: false, requirement: STAFF_REQUIRED });

    const response = await app.request(authorize());

    expect(await response.text()).toBe("authorized");
    expect(readRequirement).not.toHaveBeenCalled();
  });
});
