import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OauthOnlyTip } from "./oauth-only-tip";

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => ({
    state: { hasPassword: false, google: { id: "1" }, apple: null, totalMethods: 1, accounts: [] },
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
    canUnlink: () => false,
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    setupPassword: vi.fn(),
  }),
}));

describe("OauthOnlyTip", () => {
  it("links to the sign-in methods and connected accounts anchors on the security page", () => {
    render(<OauthOnlyTip />);

    expect(screen.getByRole("link", { name: "Sign-in methods" })).toHaveAttribute(
      "href",
      "/dashboard/settings/security#password-setup",
    );
    expect(screen.getByRole("link", { name: "Connected accounts" })).toHaveAttribute(
      "href",
      "/dashboard/settings/security#connected-accounts",
    );
  });
});
