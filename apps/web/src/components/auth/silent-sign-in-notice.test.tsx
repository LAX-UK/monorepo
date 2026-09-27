import { BID_SILENT_NOTICE_COOKIE } from "@/lib/auth/silent-sign-in/config";
import type { SessionUser } from "@/lib/data/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    document.cookie = `${BID_SILENT_NOTICE_COOKIE}=; Max-Age=0; path=/`;
    vi.clearAllMocks();
  });

  it("does nothing when the notice cookie is absent", () => {
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);
    expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
  });

  it("opens the dialog, clears the cookie, and tracks signed_in", async () => {
    setNoticeCookie();
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "You're signed in" })).toBeInTheDocument();
    });
    expect(document.cookie).not.toMatch(new RegExp(`${BID_SILENT_NOTICE_COOKIE}=1`));
    expect(trackSilentSignInResult).toHaveBeenCalledWith({
      strategy: "redirect",
      outcome: "signed_in",
    });
    expect(screen.getByText(/Alex Member/)).toBeInTheDocument();
    expect(screen.getByText(/m\*\*\*@example\.com/)).toBeInTheDocument();
  });

  it("Continue tracks notice_continue and closes the dialog", async () => {
    setNoticeCookie();
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(trackSilentSignInResult).toHaveBeenCalledWith({
      strategy: "redirect",
      outcome: "notice_continue",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Not you? Sign out tracks notice_sign_out and calls logout", async () => {
    setNoticeCookie();
    vi.mocked(useAppSession).mockReturnValue({ user, pending: false });
    render(<SilentSignInNotice />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Not you? Sign out" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Not you? Sign out" }));
    expect(trackSilentSignInResult).toHaveBeenCalledWith({
      strategy: "redirect",
      outcome: "notice_sign_out",
    });
    expect(logout).toHaveBeenCalled();
  });
});
