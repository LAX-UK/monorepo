import { useLogout } from "@/lib/auth/use-logout";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postAuthBroadcast = vi.fn();
const requestBffLogout = vi.fn();
const refetchSession = vi.fn();
const push = vi.fn();

vi.mock("@/lib/auth/auth-broadcast", () => ({
  postAuthBroadcast: (message: unknown) => postAuthBroadcast(message),
}));
vi.mock("@/lib/auth/fedcm/prevent-silent-access.client", () => ({
  preventFedcmSilentAccess: async () => {},
}));
vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => refetchSession,
}));
vi.mock("@/lib/data/http/auth-session.client", () => ({
  requestBffLogout: () => requestBffLogout(),
}));
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  clearClientActingLegalEntityId: () => {},
}));
vi.mock("@/lib/legal-entity/pending-invite-cookie.actions", () => ({
  clearPendingEntityInviteAction: async () => {},
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchSession.mockResolvedValue(undefined);
  });

  it("tells other tabs the session ended after a successful logout", async () => {
    requestBffLogout.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLogout());

    await act(() => result.current.logout());

    expect(postAuthBroadcast).toHaveBeenCalledWith({ type: "signed-out" });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("does not broadcast when the BFF logout fails", async () => {
    requestBffLogout.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useLogout());

    await act(() => result.current.logout());

    expect(postAuthBroadcast).not.toHaveBeenCalled();
  });
});
