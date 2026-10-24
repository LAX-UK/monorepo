import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ map: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.map.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

const { isStaffStepUpResponse, redirectIfStaffStepUpRequired, resolveStepUpReturnPath } =
  await import("./staff-step-up.server");

function stepUp(): Response {
  return new Response(
    JSON.stringify({ error: "Recent sign-in required", code: "step_up_required" }),
    {
      status: 403,
    },
  );
}

describe("staff step-up on the server", () => {
  beforeEach(() => {
    requestHeaders.map.clear();
    requestHeaders.map.set("host", "bid.example.test");
  });

  it("recognises only a 403 that carries the step-up code", async () => {
    expect(await isStaffStepUpResponse(stepUp())).toBe(true);
    expect(await isStaffStepUpResponse(new Response("{}", { status: 403 }))).toBe(false);
    expect(
      await isStaffStepUpResponse(
        new Response(JSON.stringify({ code: "step_up_required" }), { status: 400 }),
      ),
    ).toBe(false);
    expect(await isStaffStepUpResponse(new Response("not json", { status: 403 }))).toBe(false);
  });

  it("returns to the page the action came from", async () => {
    requestHeaders.map.set("referer", "https://bid.example.test/admin/payouts?status=paid");
    expect(await resolveStepUpReturnPath("/admin/payouts")).toBe("/admin/payouts?status=paid");
  });

  it("ignores a Referer from another origin or a malformed one", async () => {
    requestHeaders.map.set("referer", "https://other.example.test/admin/evil");
    expect(await resolveStepUpReturnPath("/admin/payouts")).toBe("/admin/payouts");
    requestHeaders.map.set("referer", "not a url");
    expect(await resolveStepUpReturnPath("/admin/payouts")).toBe("/admin/payouts");
  });

  it("redirects to hosted re-authentication on a step-up answer", async () => {
    requestHeaders.map.set("referer", "https://bid.example.test/admin/payouts");
    await expect(redirectIfStaffStepUpRequired(stepUp(), "/admin/payouts")).rejects.toThrow(
      "NEXT_REDIRECT:/api/auth/login?next=%2Fadmin%2Fpayouts&intent=reauth",
    );
  });

  it("does nothing for other responses", async () => {
    await expect(
      redirectIfStaffStepUpRequired(new Response("{}", { status: 500 }), "/admin/payouts"),
    ).resolves.toBeUndefined();
    await expect(
      redirectIfStaffStepUpRequired(new Response("{}", { status: 200 }), "/admin/payouts"),
    ).resolves.toBeUndefined();
  });
});
