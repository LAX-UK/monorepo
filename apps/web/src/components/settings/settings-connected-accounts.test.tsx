import type {
  ConnectedAccount,
  ConnectedAccountsState,
} from "@/lib/auth/hooks/use-connected-accounts";
import { computeSignInMethods } from "@/lib/auth/sign-in-methods";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsConnectedAccounts } from "./settings-connected-accounts";

const linkSocial = vi.fn();
const unlinkAccount = vi.fn();

function mockAccount(providerId: "google" | "apple", id: string): ConnectedAccount {
  return {
    id,
    accountId: `${providerId}-account`,
    providerId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
  };
}

let mockState: ConnectedAccountsState = {
  hasPassword: false,
  google: mockAccount("google", "g1"),
  apple: null,
  totalMethods: 1,
  accounts: [],
};

function buildSignInMethodsProps(state: ConnectedAccountsState, emailVerified = true) {
  const signInMethods = computeSignInMethods({ state, emailVerified });
  return {
    magicLinkAvailable: signInMethods.magicLinkAvailable,
    signInMethodCount: signInMethods.totalMethods,
    canUnlink: signInMethods.canUnlink,
    remainingSignInMethodLabels: signInMethods.remainingSignInMethodLabels,
  };
}

const baseProps = {
  loading: false,
  error: null,
  linkSocial,
  unlinkAccount,
};

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}));

describe("SettingsConnectedAccounts", () => {
  beforeEach(() => {
    mockState = {
      hasPassword: false,
      google: mockAccount("google", "g1"),
      apple: null,
      totalMethods: 1,
      accounts: [],
    };
    linkSocial.mockReset();
    unlinkAccount.mockReset();
  });

  it("allows disconnect when magic link remains the fallback", () => {
    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );

    expect(screen.getByRole("button", { name: "Disconnect" })).not.toBeDisabled();
    expect(screen.getByText(/Email sign-in link/i)).toBeInTheDocument();
    expect(screen.getByText(/still sign in with an email link/i)).toBeInTheDocument();
  });

  it("disables disconnect when it would remove the last sign-in method", () => {
    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, false)}
        state={mockState}
      />,
    );

    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
  });

  it("shows remaining sign-in options in the disconnect confirmation dialog", async () => {
    unlinkAccount.mockResolvedValue({ ok: true, value: undefined });

    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText(/You will still be able to sign in with:/i)).toBeInTheDocument();
    expect(screen.getAllByText("Email sign-in link").length).toBeGreaterThan(0);

    const disconnectButtons = screen.getAllByRole("button", { name: "Disconnect" });
    const confirmDisconnect = disconnectButtons.at(-1);
    expect(confirmDisconnect).toBeDefined();
    fireEvent.click(confirmDisconnect as HTMLButtonElement);
    expect(unlinkAccount).toHaveBeenCalledWith("google");
  });

  it("calls linkSocial when connecting an unlinked provider", () => {
    mockState = {
      hasPassword: true,
      google: null,
      apple: null,
      totalMethods: 1,
      accounts: [],
    };
    linkSocial.mockResolvedValue({ ok: true, value: undefined });

    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(linkSocial).toHaveBeenCalledWith("google");
  });

  it("surfaces a friendly message when linking fails due to email constraints", async () => {
    mockState = {
      hasPassword: true,
      google: null,
      apple: null,
      totalMethods: 1,
      accounts: [],
    };
    linkSocial.mockResolvedValue({
      ok: false,
      error: "Email must be verified and match your account email",
    });

    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText(/provider email is verified and matches your LAX account email/i),
    ).toBeInTheDocument();
  });

  it("shows phone management as a profile cross-link without a status badge", () => {
    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );

    const phoneLine = screen.getByText(/Phone number — managed on your/i);
    expect(phoneLine).toBeInTheDocument();
    expect(phoneLine).not.toHaveTextContent("Not connected");
    expect(screen.getByRole("link", { name: "Profile settings" })).toBeInTheDocument();
  });

  it("describes two-factor as managed below without a profile link", () => {
    render(
      <SettingsConnectedAccounts
        {...baseProps}
        {...buildSignInMethodsProps(mockState, true)}
        state={mockState}
      />,
    );

    expect(screen.getByText(/Two-factor authentication is managed below\./i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  });
});
