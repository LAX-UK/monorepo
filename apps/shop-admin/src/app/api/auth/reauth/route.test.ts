import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteSession = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("../../../../server/container", () => ({
  getShopAdminContainer: () => ({
    config: { publicOrigin: "https://admin.example.com" },
    sessions: { delete: deleteSession },
  }),
}));

describe("GET /api/auth/reauth", () => {
  beforeEach(() => {
    deleteSession.mockReset();
  });

  it("redirects to login using publicOrigin", async () => {
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("https://internal:3030/api/auth/reauth?returnTo=/overview"),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/api/auth/login?returnTo=%2Foverview",
    );
  });
});
