import { authClient } from "@/lib/auth-client";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}));

describe("signInService", () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.email).mockReset();
  });

  it("returns requiresTwoFactor when Better Auth sets twoFactorRedirect", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
      error: null,
    } as never);

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: true,
      requiresTwoFactor: true,
      twoFactorMethods: ["totp"],
    });
  });

  it("returns ok without requiresTwoFactor when sign-in completes", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
      error: null,
    } as never);

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({ ok: true });
  });

  it("maps errors", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid", code: "BAD" },
    } as never);

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({ ok: false, message: "Invalid", code: "BAD" });
  });
});
