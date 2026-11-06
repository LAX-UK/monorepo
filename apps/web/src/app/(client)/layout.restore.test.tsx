import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (to: string) => redirect(to),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ has: () => false, get: () => undefined })),
  headers: vi.fn(async () => new Headers({ host: "lax.bid" })),
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

vi.mock("@/lib/legal-entity/org-module-host.server", () => ({
  resolveOrgModuleEnabledFromRequest: async () => true,
}));

vi.mock("@/lib/legal-entity/acting-context.server", () => ({
  lookupActingContext: async () => ({ ok: true, context: { needsRestore: true } }),
}));

const RESTORE_FRAME = { restore: "frame" };
vi.mock("@/components/shell/restore-frame", () => ({
  restoreFrameFor: async (needsRestore: boolean) => (needsRestore ? RESTORE_FRAME : null),
}));

const { default: ClientAreaLayout } = await import("./layout");

describe("client area layout for a browser with no usable account", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("renders the restore frame (a full page load) and never calls redirect() to the hop", async () => {
    const element = (await ClientAreaLayout({ children: <p>Page</p> })) as ReactElement;

    expect(element).toBe(RESTORE_FRAME);
    expect(redirect).not.toHaveBeenCalled();
  });
});
