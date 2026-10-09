import { IdentityRejectedError } from "@auction/identity-rp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHOP_ADMIN_CSRF_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "../../lib/session-cookie.js";

const forwardAdminRequest = vi.fn();

vi.mock("../container", () => ({
  getShopAdminContainer: () => ({
    config: { publicOrigin: "http://localhost:3030" },
    forwardAdminRequest,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === SHOP_ADMIN_SESSION_COOKIE) return { value: "session-1" };
      if (name === SHOP_ADMIN_CSRF_COOKIE) return { value: "csrf-1" };
      return undefined;
    },
  }),
  headers: async () => ({
    get: (name: string) => {
      if (name === "origin") return "http://localhost:3030";
      if (name === "next-action") return "1";
      return null;
    },
  }),
}));

describe("forwardAdminMutation", () => {
  beforeEach(() => {
    forwardAdminRequest.mockReset();
  });

  it("forwards the request origin from incoming headers", async () => {
    forwardAdminRequest.mockResolvedValue({
      status: 204,
      headers: {},
      body: new ArrayBuffer(0),
    });
    const { forwardAdminMutation } = await import("./forward-admin-mutation.js");
    await forwardAdminMutation({
      bffPath: "staff/grants",
      method: "POST",
    });
    expect(forwardAdminRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "http://localhost:3030",
        csrfHeader: null,
        fromServerAction: true,
      }),
    );
  });

  it("maps IdentityRejectedError to step_up_required", async () => {
    forwardAdminRequest.mockRejectedValue(
      new IdentityRejectedError(401, "Recent authentication is required", "login_required"),
    );
    const { forwardAdminMutation } = await import("./forward-admin-mutation.js");
    const result = await forwardAdminMutation({
      bffPath: "payouts/mark-paid",
      method: "POST",
    });
    expect(result).toEqual({
      ok: false,
      kind: "step_up_required",
      message: "Sign in again with step-up to continue.",
    });
  });
});
