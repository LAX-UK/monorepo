// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  removeSignInMethodAction: vi.fn(),
}));

const { SignInMethodsList } = await import("./sign-in-methods-list.client");

afterEach(cleanup);

describe("Password row", () => {
  it("opens the password form in place and closes it again", () => {
    render(
      <SignInMethodsList
        rows={[
          {
            kind: "password",
            title: "Password",
            isSet: true,
            status: "Set",
            detail: "Sign in with your email and password.",
            actionLabel: "Change",
          },
        ]}
        hint={null}
        returnTo="/account/security"
        passwordPanel={<p>Password form</p>}
        twoStep={{ title: "Two-step verification", href: "https://auth.example/2fa" }}
      />,
    );
    const change = screen.getByRole("button", { name: "Change" });
    const panel = document.getElementById(change.getAttribute("aria-controls") ?? "");
    expect(change.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hidden).toBe(true);
    fireEvent.click(change);
    expect(change.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.hidden).toBe(false);
    fireEvent.click(change);
    expect(panel?.hidden).toBe(true);
  });
});
