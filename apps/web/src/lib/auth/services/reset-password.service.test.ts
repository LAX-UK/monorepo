import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordService } from "./reset-password.service";

const resetPasswordService = new ResetPasswordService();

function mockFetchResponse(init: { ok: boolean; status?: number; body?: unknown }) {
  const res = new Response(init.body === undefined ? null : JSON.stringify(init.body), {
    status: init.status ?? (init.ok ? 200 : 400),
    headers: { "Content-Type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resetPasswordService", () => {
  it("returns ok on success", async () => {
    mockFetchResponse({ ok: true, body: { status: true } });
    const result = await resetPasswordService.submit({ token: "t", newPassword: "newpassword123" });
    expect(result).toEqual({ ok: true });
  });

  it("maps token errors to reset_token_invalid", async () => {
    mockFetchResponse({ ok: false, body: { code: "INVALID_TOKEN", message: "invalid token" } });
    const result = await resetPasswordService.submit({ token: "t", newPassword: "newpassword123" });
    expect(result).toMatchObject({ ok: false, code: "reset_token_invalid" });
  });

  it("falls back to reset_password_failed for other errors", async () => {
    mockFetchResponse({ ok: false, body: { code: "PASSWORD_TOO_SHORT", message: "too short" } });
    const result = await resetPasswordService.submit({ token: "t", newPassword: "newpassword123" });
    expect(result).toMatchObject({ ok: false, code: "reset_password_failed" });
  });

  it("falls back to reset_password_failed when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const result = await resetPasswordService.submit({ token: "t", newPassword: "newpassword123" });
    expect(result).toMatchObject({ ok: false, code: "reset_password_failed" });
  });
});
