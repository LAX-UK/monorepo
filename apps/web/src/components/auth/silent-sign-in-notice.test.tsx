import { BID_SILENT_NOTICE_COOKIE } from "@/lib/auth/silent-sign-in/config";
import type { SessionUser } from "@/lib/data/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilentSignInNotice } from "./silent-sign-in-notice.client";

const trackSilentSignInResult = vi.fn();
const logout = vi.fn(async () => undefined);

vi.mock("@/lib/analytics/events", () => ({
  trackSilentSignInResult: (...args: unknown[]) => trackSilentSignInResult(...args),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: vi.fn(),
}));

vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout, pending: false }),
}));

import { useAppSession } from "@/lib/auth/use-app-session";

const user: SessionUser = {
  id: "user-1",
  email: "member@example.com",
  name: "Alex Member",
  role: "client",
};

function setNoticeCookie() {
  document.cookie = `${BID_SILENT_NOTICE_COOKIE}=1; path=/`;
}

describe("SilentSignInNotice", () => {
  afterEach(() => {
    cleanup();
    document.cookie = `${BID_SILENT_NOTICE_COOKIE}=; Max-Age=0; path=/`;
    vi.clearAllMocks();
  });

  it("does nothing when the notice cookie is absent", () => {
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);
    expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
  });

  it("shows a polite corner toast, not a dialog, clears the cookie, and tracks signed_in", async () => {
    setNoticeCookie();
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);

    await waitFor(() => {
      expect(screen.getByTestId("silent-sign-in-notice")).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Signed in as Alex");
    expect(document.cookie).not.toMatch(new RegExp(`${BID_SILENT_NOTICE_COOKIE}=1`));
    expect(trackSilentSignInResult).toHaveBeenCalledWith({
      strategy: "redirect",
      outcome: "signed_in",
    });
  });

  it("goes away by itself after about six seconds and tracks notice_continue", async () => {
    vi.useFakeTimers();
    try {
      setNoticeCookie();
      vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
      render(<SilentSignInNotice />);
      expect(screen.getByTestId("silent-sign-in-notice")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
      expect(trackSilentSignInResult).toHaveBeenCalledWith({
        strategy: "redirect",
        outcome: "notice_continue",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("Not you? tracks notice_sign_out, closes the toast and calls logout", async () => {
    setNoticeCookie();
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Not you?" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Not you?" }));
    expect(trackSilentSignInResult).toHaveBeenCalledWith({
      strategy: "redirect",
      outcome: "notice_sign_out",
    });
    expect(logout).toHaveBeenCalled();
    expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
  });
});
