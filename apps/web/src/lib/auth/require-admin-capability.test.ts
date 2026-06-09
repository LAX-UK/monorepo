import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerSessionUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: () => getServerSessionUser(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

import {
  ANALYTICS_ACCESS,
  CLIENT_BIDS_ACCESS,
  LOTS_ACCESS,
  USERS_DIRECTORY_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { requireAdminCapability } from "./require-admin-capability";

describe("requireAdminCapability", () => {
  beforeEach(() => {
    getServerSessionUser.mockReset();
    redirect.mockClear();
  });

  it("redirects unauthenticated users to login", async () => {
    getServerSessionUser.mockResolvedValue(null);
    await expect(requireAdminCapability(LOTS_ACCESS, "/admin/lots")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("allows catalogue_manager for lots", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "catalogue_manager",
    });
    const user = await requireAdminCapability(LOTS_ACCESS, "/admin/lots");
    expect(user.staffRole).toBe("catalogue_manager");
  });

  it("redirects staff_viewer away from lots", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "staff_viewer",
    });
    await expect(requireAdminCapability(LOTS_ACCESS, "/admin/lots")).rejects.toThrow("REDIRECT:");
  });

  it("redirects staff_viewer away from clients directory", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "staff_viewer",
    });
    await expect(requireAdminCapability(USERS_DIRECTORY_ACCESS, "/admin/clients")).rejects.toThrow(
      "REDIRECT:",
    );
  });

  it("allows client_advisor for clients directory", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "client_advisor",
    });
    const user = await requireAdminCapability(USERS_DIRECTORY_ACCESS, "/admin/clients");
    expect(user.staffRole).toBe("client_advisor");
  });

  it("allows client_advisor for client bids access", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "client_advisor",
    });
    const user = await requireAdminCapability(CLIENT_BIDS_ACCESS, "/admin/clients");
    expect(user.staffRole).toBe("client_advisor");
  });

  it("redirects specialist away from analytics", async () => {
    getServerSessionUser.mockResolvedValue({
      role: "staff",
      staffRole: "specialist",
    });
    await expect(requireAdminCapability(ANALYTICS_ACCESS, "/admin/analytics")).rejects.toThrow(
      "REDIRECT:",
    );
  });
});
