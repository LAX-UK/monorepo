import { AccountsUnavailableFrame } from "@/components/shell/accounts-unavailable-frame";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "lax_acting_legal_entity_id" ? { name, value: ORG_ID } : undefined,
    set: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers({ host: "lax.bid" })),
}));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (to: string) => redirect(to),
}));

vi.mock("@/lib/auth/guards.server", () => ({
  requireAuthenticatedUser: async () => ({
    id: "user-1",
    role: "client",
    staffRoles: [],
    name: "Lena Fischer",
    email: "lena@example.com",
    accountOnboardingComplete: true,
  }),
}));

const apiFetch = vi.fn();
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { default: ClientAreaLayout } = await import("./layout");

function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "0" },
  });
}

describe("client area layout when the accounts cannot be read", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    redirect.mockClear();
  });

  it("renders the retry state for a 429 from /legal-entities/me, never the personal account", async () => {
    apiFetch.mockImplementation(async () => tooManyRequests());

    const element = (await ClientAreaLayout({ children: <p>Page</p> })) as ReactElement;

    expect(element.type).toBe(AccountsUnavailableFrame);
    // Retried once, then reported; nothing sent the person to restore or to the access page.
    expect(apiFetch.mock.calls.filter(([path]) => path === "/legal-entities/me")).toHaveLength(2);
    expect(redirect).not.toHaveBeenCalled();
  });
});
