import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerSessionUser = vi.fn();
vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: () => getServerSessionUser(),
}));
vi.mock("@/lib/admin/admin-return-path.server", () => ({
  resolveAdminReturnPath: async () => "/admin/deliveries",
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import DeliveriesLayout from "./layout";

const enter = (staffRole: string) => {
  getServerSessionUser.mockResolvedValue({ role: "staff", staffRoles: [staffRole] });
  return DeliveriesLayout({ children: "Deliveries" });
};

// D5: the page "is hidden from roles without LOT_FULFILMENT_ACCESS" (PRM-1).
describe("Deliveries layout guard", () => {
  beforeEach(() => getServerSessionUser.mockReset());

  it.each(["fulfilment", "administrator"])("lets %s in", async (role) => {
    await expect(enter(role)).resolves.toBe("Deliveries");
  });

  it.each(["read_only", "finance", "cataloguer"])(
    "turns %s away, who cannot open Lot fulfilment",
    async (role) => {
      await expect(enter(role)).rejects.toThrow("REDIRECT:");
    },
  );
});
