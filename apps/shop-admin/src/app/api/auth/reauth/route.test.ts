import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteSession = vi.fn();
let sessionCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      sessionCookie && name.includes("session") ? { value: sessionCookie } : undefined,
  }),
}));

vi.mock("../../../../server/container", () => ({
  getShopAdminContainer: () => ({
    config: { publicOrigin: "https://admin.example.com", NODE_ENV: "test" },
    sessions: { delete: deleteSession },
  }),
}));

const url = "https://internal:3030/api/auth/reauth?returnTo=/overview";

describe("/api/auth/reauth", () => {
  beforeEach(() => {
    deleteSession.mockReset();
    sessionCookie = undefined;
  });

  it("does not answer GET, so a link from another site cannot end the session", async () => {
    const route = (await import("./route.js")) as Record<string, unknown>;
    expect(route.GET).toBeUndefined();
    expect(typeof route.POST).toBe("function");
  });

  it("redirects a same-origin POST to login using publicOrigin", async () => {
    const { POST } = await import("./route.js");
    const response = await POST(
      new Request(url, { method: "POST", headers: { origin: "https://admin.example.com" } }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/api/auth/login?returnTo=%2Foverview",
    );
  });

  it("refuses a POST from another origin and leaves the session alone", async () => {
    const { POST } = await import("./route.js");
    const response = await POST(
      new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }),
    );
    expect(response.status).toBe(403);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("refuses a POST with no origin", async () => {
    const { POST } = await import("./route.js");
    const response = await POST(new Request(url, { method: "POST" }));
    expect(response.status).toBe(403);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("sends a not-authorised account to the sign-in error page", async () => {
    const { POST } = await import("./route.js");
    const response = await POST(
      new Request(`${url}&reason=not_authorized`, {
        method: "POST",
        headers: { origin: "https://admin.example.com" },
      }),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=not_authorized",
    );
  });
});
