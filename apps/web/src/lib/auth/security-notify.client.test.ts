import {
  notifyTwoFactorDisabledEmail,
  notifyTwoFactorEnabledEmail,
} from "@/lib/auth/security-notify.client";
import { beforeEach, describe, expect, it, vi } from "vitest";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("security-notify.client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("posts to the two-factor-enabled endpoint", () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    notifyTwoFactorEnabledEmail();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/security-notify/two-factor-enabled"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("posts to the two-factor-disabled endpoint", () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    notifyTwoFactorDisabledEmail();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/security-notify/two-factor-disabled"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("logs (instead of silently swallowing) a failed enabled-notify call", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    notifyTwoFactorEnabledEmail();
    await flushMicrotasks();

    expect(console.error).toHaveBeenCalledWith(
      "[auth] notify two-factor-enabled failed",
      expect.any(Error),
    );
  });

  it("logs (instead of silently swallowing) a failed disabled-notify call", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    notifyTwoFactorDisabledEmail();
    await flushMicrotasks();

    expect(console.error).toHaveBeenCalledWith(
      "[auth] notify two-factor-disabled failed",
      expect.any(Error),
    );
  });
});
