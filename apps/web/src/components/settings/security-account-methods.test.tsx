import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecurityAccountMethods } from "./security-account-methods";

vi.mock("@/components/auth/security-password-form", () => ({
  SecurityPasswordForm: () => <div>Change password form</div>,
}));

vi.mock("@/components/auth/set-password-form", () => ({
  SetPasswordForm: () => <div>Set password form</div>,
}));

vi.mock("@/components/settings/settings-connected-accounts", () => ({
  SettingsConnectedAccounts: () => <div>Connected accounts panel</div>,
}));

const useConnectedAccounts = vi.fn();

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => useConnectedAccounts(),
}));

describe("SecurityAccountMethods", () => {
  it("renders set-password when the user has no credential account", () => {
    useConnectedAccounts.mockReturnValue({
      state: {
        hasPassword: false,
        google: { id: "1" },
        apple: null,
        totalMethods: 1,
        accounts: [],
      },
      loading: false,
      error: null,
      canUnlink: () => false,
      linkSocial: vi.fn(),
      unlinkAccount: vi.fn(),
      setupPassword: vi.fn(),
    });

    render(<SecurityAccountMethods emailVerified />);

    expect(screen.getByText("Set password form")).toBeInTheDocument();
    expect(screen.queryByText("Change password form")).not.toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Connected accounts panel")).toBeInTheDocument();
  });

  it("renders change-password when the user has a credential account", () => {
    useConnectedAccounts.mockReturnValue({
      state: {
        hasPassword: true,
        google: null,
        apple: null,
        totalMethods: 1,
        accounts: [],
      },
      loading: false,
      error: null,
      canUnlink: () => true,
      linkSocial: vi.fn(),
      unlinkAccount: vi.fn(),
      setupPassword: vi.fn(),
    });

    render(<SecurityAccountMethods emailVerified />);

    expect(screen.getByText("Change password form")).toBeInTheDocument();
    expect(screen.queryByText("Set password form")).not.toBeInTheDocument();
    expect(screen.getByText("Set")).toBeInTheDocument();
  });

  it("shows a retry alert when the first account load fails in the password section", () => {
    const refresh = vi.fn();
    useConnectedAccounts.mockReturnValue({
      state: {
        hasPassword: false,
        google: null,
        apple: null,
        totalMethods: 0,
        accounts: [],
      },
      loading: false,
      error: "Could not load connected accounts.",
      refresh,
      canUnlink: () => false,
      linkSocial: vi.fn(),
      unlinkAccount: vi.fn(),
      setupPassword: vi.fn(),
    });

    render(<SecurityAccountMethods emailVerified />);

    expect(screen.getByText("Could not load connected accounts.")).toBeInTheDocument();
    expect(screen.queryByText("Set password form")).not.toBeInTheDocument();
    expect(screen.queryByText("Not set")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
