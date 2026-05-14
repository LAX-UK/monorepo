import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionsClientPage } from "./sessions-client-page";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => ({
    state: {
      hasPassword: true,
      google: null,
      apple: null,
      accounts: [],
      totalMethods: 1,
    },
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
    canUnlink: () => true,
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    setupPassword: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SessionsClientPage", () => {
  it("revokes a non-current session via injected ISessionsApi", async () => {
    refresh.mockClear();
    const revoke = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const sessionsApi = {
      revoke,
      revokeAllOthers: vi.fn(),
    };
    const sessions = [
      {
        id: "current",
        isCurrent: true,
        userAgent: "Mozilla/5.0 (Macintosh)",
        createdAt: "2026-05-15T10:00:00.000Z",
        expiresAt: "2026-05-22T10:00:00.000Z",
        ipAddress: "1.1.1.1",
        lastPasswordAuthAt: null,
      },
      {
        id: "other",
        isCurrent: false,
        userAgent: "Mozilla/5.0 (Windows NT 10.0)",
        createdAt: "2026-05-14T10:00:00.000Z",
        expiresAt: "2026-05-21T10:00:00.000Z",
        ipAddress: "2.2.2.2",
        lastPasswordAuthAt: null,
      },
    ];

    render(<SessionsClientPage sessions={sessions} sessionsApi={sessionsApi} />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith("other");
    });
    expect(refresh).toHaveBeenCalled();
  });
});
