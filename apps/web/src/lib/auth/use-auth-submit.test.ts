import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuthSubmit } from "./use-auth-submit";

describe("useAuthSubmit", () => {
  it("normalises thrown network errors and always clears loading", async () => {
    const execute = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useAuthSubmit(execute));

    let response: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      response = await result.current.run({ email: "user@example.com" });
    });

    expect(response).toEqual({
      ok: false,
      code: "unknown",
      message: "Something went wrong. Please try again.",
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.lastErrorCode).toBe("unknown");
    expect(result.current.bannerError).toBe("Something went wrong. Please try again.");
  });
});
