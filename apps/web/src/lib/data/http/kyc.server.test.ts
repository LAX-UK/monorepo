import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();

vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => "https://test.lax.bid",
}));

import { postServerKycSession } from "./kyc.server";

describe("postServerKycSession", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts an absolute returnUrl when given a relative path", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { verificationUrl: "https://veriff.com/session" } }),
    });

    const result = await postServerKycSession("/dashboard/seller/connect");

    expect(result).toEqual({ ok: true, url: "https://veriff.com/session" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/kyc/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          returnUrl: "https://test.lax.bid/dashboard/seller/connect",
        }),
      }),
    );
  });

  it("forwards entity header when entityId is provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { verificationUrl: "https://veriff.com/session" } }),
    });

    await postServerKycSession("/onboarding/organisation/step/identity?kyc=complete", {
      entityId: "le-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/kyc/session",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-legal-entity-id": "le-1",
        }),
      }),
    );
  });

  it("returns a string error when API responds with a Zod-shaped payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { name: "ZodError", issues: [{ message: "Invalid url" }] },
      }),
    });

    const result = await postServerKycSession("/dashboard/seller/connect");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error).toContain("We couldn’t start identity verification");
    }
  });
});
