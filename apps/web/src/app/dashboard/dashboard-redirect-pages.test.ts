import { laxAccountUrl } from "@/lib/lax-account-url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const cookieValue = vi.fn<() => string | undefined>();
const onboardingEnabled = vi.fn<() => boolean>();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "lax_client_workspace" && cookieValue() ? { value: cookieValue() } : undefined,
  }),
}));

vi.mock("@/lib/auth/guards.server", () => ({
  requireAuthenticatedUser: async () => ({ id: "user-1" }),
}));

vi.mock("@/lib/kyc/identity-onboarding-rollout.server", () => ({
  isIdentityOnboardingEnabled: () => onboardingEnabled(),
}));

vi.mock("@/lib/data/http/kyc.server", () => ({
  getServerKycStatusSummary: async () => null,
}));

vi.mock("@/app/dashboard/verify-identity/verify-identity-client", () => ({
  VerifyIdentityClient: () => null,
}));

async function redirectTarget(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const message = (error as Error).message;
    if (!message.startsWith("NEXT_REDIRECT:")) throw error;
    return message.slice("NEXT_REDIRECT:".length);
  }
}

beforeEach(() => {
  redirectMock.mockClear();
  cookieValue.mockReset();
  onboardingEnabled.mockReset();
});

describe("/dashboard", () => {
  async function visit(query: Record<string, string | string[]> = {}) {
    const { default: Page } = await import("./page");
    return redirectTarget(() => Page({ searchParams: Promise.resolve(query) }));
  }

  it("opens My bids by default", async () => {
    expect(await visit()).toBe("/dashboard/bids");
  });

  it("opens My bids in the buying workspace", async () => {
    cookieValue.mockReturnValue("buying");
    expect(await visit()).toBe("/dashboard/bids");
  });

  it("opens the seller overview in the selling workspace", async () => {
    cookieValue.mockReturnValue("selling");
    expect(await visit()).toBe("/dashboard/seller");
  });

  it("keeps the query string so toast and analytics parameters survive", async () => {
    expect(await visit({ welcome: "back", utm_source: ["a", "b"] })).toBe(
      "/dashboard/bids?welcome=back&utm_source=a&utm_source=b",
    );
  });
});

describe("/dashboard/settings", () => {
  async function visit(query: Record<string, string> = {}) {
    const { default: Page } = await import("./settings/page");
    return redirectTarget(() => Page({ searchParams: Promise.resolve(query) }));
  }

  it("sends old security links in emails to LAX Account", async () => {
    expect(await visit({ tab: "security" })).toBe(laxAccountUrl("/account/security"));
  });
});

describe("/dashboard/verify-identity", () => {
  async function visit(next?: string) {
    const { default: Page } = await import("./verify-identity/page");
    return redirectTarget(() => Page({ searchParams: Promise.resolve(next ? { next } : {}) }));
  }

  it("redirects to the identity onboarding flow when it is enabled, keeping a safe next", async () => {
    onboardingEnabled.mockReturnValue(true);
    expect(await visit("/lot/example/123")).toBe(
      "/onboarding/identity?next=%2Flot%2Fexample%2F123&source=dashboard",
    );
  });

  it("drops an unsafe next destination", async () => {
    onboardingEnabled.mockReturnValue(true);
    expect(await visit("//evil.example")).toBe(
      "/onboarding/identity?next=%2Fdashboard&source=dashboard",
    );
  });

  it("stays put when onboarding is off, because that flow bounces back here", async () => {
    onboardingEnabled.mockReturnValue(false);
    expect(await visit()).toBeNull();
  });
});
