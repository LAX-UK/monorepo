import { AUTH_BROADCAST_CHANNEL } from "@/lib/auth/auth-broadcast";
import {
  AuthSessionProvider,
  BETTER_AUTH_MESSAGE_STORAGE_KEY,
} from "@/lib/auth/auth-session-provider";
import { useAppSession } from "@/lib/auth/use-app-session";
import type { SessionUser } from "@/lib/data/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refetchMock = vi.fn();
const useSessionMock = vi.fn();
const broadcastCloseMock = vi.fn();

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(_name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    for (const channel of MockBroadcastChannel.instances) {
      channel.onmessage?.({ data } as MessageEvent);
    }
  }

  close() {
    broadcastCloseMock();
  }
}

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
  },
}));

const serverUser: SessionUser = {
  id: "srv-1",
  email: "server@example.com",
  name: "Server User",
  role: "client",
  image: null,
};

function sessionState(data: { user?: Record<string, unknown> } | null, isPending = false) {
  return {
    data,
    isPending,
    isRefetching: false,
    error: null,
    refetch: refetchMock,
  };
}

function renderWithProvider(serverUserValue: SessionUser | null = null, authCookiePresent = false) {
  return renderHook(() => useAppSession(), {
    wrapper: ({ children }) => (
      <AuthSessionProvider serverUser={serverUserValue} authCookiePresent={authCookiePresent}>
        {children}
      </AuthSessionProvider>
    ),
  });
}

describe("useAppSession", () => {
  beforeEach(() => {
    refetchMock.mockClear();
    broadcastCloseMock.mockClear();
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    useSessionMock.mockReturnValue(sessionState(null));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when used outside AuthSessionProvider", () => {
    expect(() => {
      renderHook(() => useAppSession());
    }).toThrow("useAppSession must be used within AuthSessionProvider");
  });

  it("prefers client session over SSR fallback", () => {
    useSessionMock.mockReturnValue(
      sessionState({
        user: {
          id: "cli-1",
          email: "client@example.com",
          name: "Client User",
          role: "client",
        },
      }),
    );

    const { result } = renderWithProvider(serverUser);

    expect(result.current.user?.id).toBe("cli-1");
    expect(result.current.pending).toBe(false);
  });

  it("falls back to SSR user when client session is empty", () => {
    const { result } = renderWithProvider(serverUser);

    expect(result.current.user).toEqual(serverUser);
    expect(result.current.pending).toBe(false);
  });

  it("returns pending=true when client session is loading and no server fallback", () => {
    useSessionMock.mockReturnValue(sessionState(null, true));

    const { result } = renderWithProvider(null, true);

    expect(result.current.user).toBeNull();
    expect(result.current.pending).toBe(true);
  });

  it("returns pending=false for confirmed guests without an auth cookie", () => {
    useSessionMock.mockReturnValue(sessionState(null, true));

    const { result } = renderWithProvider(null, false);

    expect(result.current.user).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  it("returns pending=false when client session is loading but server fallback exists", () => {
    useSessionMock.mockReturnValue(sessionState(null, true));

    const { result } = renderWithProvider(serverUser, true);

    expect(result.current.user).toEqual(serverUser);
    expect(result.current.pending).toBe(false);
  });

  it("refetches when lax-auth signed-in broadcast is received", async () => {
    renderWithProvider(null);

    const channel = MockBroadcastChannel.instances[0];
    expect(channel).toBeDefined();

    act(() => {
      channel?.postMessage({ type: "signed-in" });
    });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    });
  });

  it("refetches when Better Auth storage event is received", async () => {
    renderWithProvider(null);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: BETTER_AUTH_MESSAGE_STORAGE_KEY,
          newValue: JSON.stringify({ event: "session", data: { trigger: "signout" } }),
        }),
      );
    });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    });
  });

  it("closes BroadcastChannel on unmount", () => {
    const { unmount } = renderWithProvider(null);

    unmount();

    expect(broadcastCloseMock).toHaveBeenCalled();
  });

  it("ignores unrelated storage events", async () => {
    renderWithProvider(null);
    refetchMock.mockClear();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "unrelated-key",
          newValue: "value",
        }),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(refetchMock).not.toHaveBeenCalled();
  });
});

describe("AuthSessionProvider broadcast channel name", () => {
  it("uses the lax-auth channel", () => {
    expect(AUTH_BROADCAST_CHANNEL).toBe("lax-auth");
  });
});
