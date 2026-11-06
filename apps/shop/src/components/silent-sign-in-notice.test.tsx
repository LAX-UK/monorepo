import { SHOP_SILENT_NOTICE_COOKIE } from "@/lib/silent-sign-in/config";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilentSignInNotice } from "./silent-sign-in-notice.client";

function setNoticeCookie() {
  document.cookie = `${SHOP_SILENT_NOTICE_COOKIE}=1; path=/`;
}

describe("SilentSignInNotice", () => {
  afterEach(() => {
    cleanup();
    document.cookie = `${SHOP_SILENT_NOTICE_COOKIE}=; Max-Age=0; path=/`;
  });

  it("does nothing when the notice cookie is absent", () => {
    render(
      <SilentSignInNotice
        logoutActionUrl="https://identity.shop.example/logout"
        displayName="Alex"
        email="member@example.com"
      />,
    );
    expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
  });

  it("shows a polite corner toast, not a dialog, and clears the cookie", async () => {
    setNoticeCookie();
    render(
      <SilentSignInNotice
        logoutActionUrl="https://identity.shop.example/logout"
        displayName="Alex Member"
        email="member@example.com"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("silent-sign-in-notice")).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Signed in as Alex");
    expect(document.cookie).not.toMatch(new RegExp(`${SHOP_SILENT_NOTICE_COOKIE}=1`));
  });

  it("posts to shop identity logout on Not you?", async () => {
    setNoticeCookie();
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, "requestSubmit");
    render(
      <SilentSignInNotice
        logoutActionUrl="https://identity.shop.example/logout"
        displayName="Alex"
        email="member@example.com"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Not you?" }));
    expect(submitSpy).toHaveBeenCalled();
    expect(screen.queryByTestId("silent-sign-in-notice")).not.toBeInTheDocument();
    submitSpy.mockRestore();
  });
});
