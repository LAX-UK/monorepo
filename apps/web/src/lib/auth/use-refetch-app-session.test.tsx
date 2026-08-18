import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refetchMock = vi.fn();

vi.mock("@/lib/data/http/auth-session.client", () => ({
  fetchCurrentBffSession: () => refetchMock(),
}));

describe("useRefetchAppSession", () => {
  it("throws when used outside AuthSessionProvider", () => {
    expect(() => {
      renderHook(() => useRefetchAppSession());
    }).toThrow("useRefetchAppSession must be used within AuthSessionProvider");
  });

  it("returns the provider refetch function", async () => {
    refetchMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRefetchAppSession(), {
      wrapper: ({ children }) => (
        <AuthSessionProvider serverUser={null} authCookiePresent={false}>
          {children}
        </AuthSessionProvider>
      ),
    });

    await result.current();

    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
