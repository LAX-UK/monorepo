// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadConnectAndInitialize = vi.fn(() => ({ update: vi.fn() }));

vi.mock("@stripe/connect-js/pure", () => ({
  loadConnectAndInitialize: (...args: unknown[]) =>
    (loadConnectAndInitialize as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConnectAccountOnboarding: () => <div>onboarding</div>,
  ConnectAccountManagement: () => <div>management</div>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/selling-actions.server", () => ({
  createPayoutSessionAction: vi.fn(),
}));

const { PayoutAccountCard } = await import("./payout-account-card.client");

const ACCOUNT = {
  stage: "not_set_up",
  statusLabel: "Not set up",
  tone: "warning",
  title: "Bank details for payouts",
  description: "Add your bank details.",
  action: { label: "Set up payouts", surface: "onboarding" },
  publishableKey: "pk_test_123",
} as const;

afterEach(() => {
  cleanup();
  loadConnectAndInitialize.mockClear();
});

describe("PayoutAccountCard", () => {
  it("does not load Stripe Connect when it renders", () => {
    render(<PayoutAccountCard account={ACCOUNT} />);
    expect(screen.getByRole("button", { name: "Set up payouts" })).toBeTruthy();
    expect(loadConnectAndInitialize).not.toHaveBeenCalled();
  });

  it("loads Stripe Connect with the publishable key when payout setup opens", () => {
    render(<PayoutAccountCard account={ACCOUNT} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up payouts" }));
    expect(loadConnectAndInitialize).toHaveBeenCalledTimes(1);
    expect(loadConnectAndInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ publishableKey: "pk_test_123" }),
    );
  });
});
