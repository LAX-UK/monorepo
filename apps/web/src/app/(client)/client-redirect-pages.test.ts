import { laxAccountUrl } from "@/lib/lax-account-url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomeLayout from "./home/layout";
import HomePage from "./home/page";
import SettingsPage from "./settings/page";
import VerifyIdentityPage from "./verify-identity/page";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const activeOrganisation = vi.fn<() => { id: string; role: string } | null>();
const onboardingEnabled = vi.fn<() => boolean>();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("@/lib/legal-entity/active-organisation.server", () => ({
  resolveActiveOrganisation: async () => activeOrganisation(),
}));

const loadOrganisationHome = vi.fn(async () => ({}));
vi.mock("@/lib/organisation-home/load-organisation-home.server", () => ({
  loadOrganisationHome: (...args: unknown[]) => loadOrganisationHome(...(args as [])),
}));

const requestPath = vi.fn(() => "/home");
vi.mock("@/lib/navigation/client-request-path.server", () => ({
  resolveClientRequestPath: async () => requestPath(),
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

vi.mock("@/app/(client)/verify-identity/verify-identity-client", () => ({
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
  activeOrganisation.mockReset();
  activeOrganisation.mockReturnValue(null);
  onboardingEnabled.mockReset();
});

describe("/home", () => {
  async function visit(query: Record<string, string | string[]> = {}) {
    const Page = HomePage;
    return redirectTarget(() => Page({ searchParams: Promise.resolve(query) }));
  }

  it("opens My bids for a personal account", async () => {
    expect(await visit()).toBe("/bids");
  });

  it.each(["admin", "buyer_agent", "viewer"])(
    "shows the organisation's Home to a member with the %s role, without redirecting",
    async (role) => {
      activeOrganisation.mockReturnValue({ id: "org-1", role });
      expect(await visit()).toBeNull();
      expect(loadOrganisationHome).toHaveBeenCalledWith({ id: "user-1" }, { id: "org-1", role });
    },
  );

  it("keeps the query string so toast and analytics parameters survive", async () => {
    expect(await visit({ welcome: "back", utm_source: ["a", "b"] })).toBe(
      "/bids?welcome=back&utm_source=a&utm_source=b",
    );
  });
});

describe("/home layout", () => {
  it("redirects a personal account before Home's loading state streams, keeping the query", async () => {
    requestPath.mockReturnValue("/home?welcome=back");
    expect(await redirectTarget(() => HomeLayout({ children: null }))).toBe("/bids?welcome=back");
  });

  it("lets an organisation through to its Home", async () => {
    activeOrganisation.mockReturnValue({ id: "org-1", role: "owner" });
    expect(await redirectTarget(() => HomeLayout({ children: null }))).toBeNull();
  });
});

describe("/settings", () => {
  async function visit(query: Record<string, string> = {}) {
    const Page = SettingsPage;
    return redirectTarget(() => Page({ searchParams: Promise.resolve(query) }));
  }

  it("sends old security links in emails to LAX Account", async () => {
    expect(await visit({ tab: "security" })).toBe(laxAccountUrl("/account/security"));
  });
});

describe("/verify-identity", () => {
  async function visit(next?: string) {
    const Page = VerifyIdentityPage;
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
      "/onboarding/identity?next=%2Fhome&source=dashboard",
    );
  });

  it("stays put when onboarding is off, because that flow bounces back here", async () => {
    onboardingEnabled.mockReturnValue(false);
    expect(await visit()).toBeNull();
  });
});
