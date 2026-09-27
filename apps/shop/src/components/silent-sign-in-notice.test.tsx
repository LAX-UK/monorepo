import { SHOP_SILENT_NOTICE_COOKIE } from "@/lib/silent-sign-in/config";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilentSignInNotice } from "./silent-sign-in-notice.client";

function setNoticeCookie() {
  document.cookie = `${SHOP_SILENT_NOTICE_COOKIE}=1; path=/`;
}

describe("SilentSignInNotice", () => {
  afterEach(() => {
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

  it("opens the dialog and clears the cookie when authenticated props are present", async () => {
    setNoticeCookie();
    render(
      <SilentSignInNotice
        logoutActionUrl="https://identity.shop.example/logout"
        displayName="Alex Member"
        email="member@example.com"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "You're signed in" })).toBeInTheDocument();
    });
    expect(document.cookie).not.toMatch(new RegExp(`${SHOP_SILENT_NOTICE_COOKIE}=1`));
  });

  it("posts to shop identity logout on Not you? Sign out", async () => {
    setNoticeCookie();
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, "requestSubmit");
    render(
      <SilentSignInNotice
        logoutActionUrl="https://identity.shop.example/logout"
        displayName="Alex"
        email="member@example.com"
      />,
    );

    const signOutButton = await screen.findByRole("button", { name: "Not you? Sign out" });
    fireEvent.click(signOutButton);
    expect(submitSpy).toHaveBeenCalled();
    submitSpy.mockRestore();
  });
});
