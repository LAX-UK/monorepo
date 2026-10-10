import { beforeEach, describe, expect, it, vi } from "vitest";

const { disable, notifyTwoFactorDisabledEmail } = vi.hoisted(() => ({
  disable: vi.fn(),
  notifyTwoFactorDisabledEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { twoFactor: { disable } } }));
vi.mock("@/lib/auth/security-notify.client", () => ({ notifyTwoFactorDisabledEmail }));

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { disableTwoFactorService } from "./disable-two-factor.service";

describe("disableTwoFactorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains a policy block instead of blaming the password", async () => {
    disable.mockResolvedValue({
      error: { code: "TWO_FACTOR_REQUIRED_BY_POLICY", message: "required", status: 403 },
    });
    const result = await disableTwoFactorService("secret");
    expect(result).toEqual({
      ok: false,
      code: "two_factor_required_by_policy",
      message: AUTH_ERROR_MESSAGES.two_factor_required_by_policy,
    });
    expect(notifyTwoFactorDisabledEmail).not.toHaveBeenCalled();
  });

  it("keeps the generic failure for other errors", async () => {
    disable.mockResolvedValue({ error: { code: "INVALID_PASSWORD", message: "bad", status: 400 } });
    const result = await disableTwoFactorService("wrong");
    expect(result).toMatchObject({ ok: false, code: "two_factor_disable_failed" });
  });
});
