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

  it("accepts a social sign-in for a policy requirement", async () => {
    const { app } = setup({
      requirement: STAFF_REQUIRED,
      socialAuthAt: new Date(),
      hasPassword: false,
    });

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
