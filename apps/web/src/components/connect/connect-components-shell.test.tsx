// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadConnectAndInitialize = vi.fn(() => ({ update: vi.fn() }));

vi.mock("@stripe/connect-js/pure", () => ({
  loadConnectAndInitialize: (...args: unknown[]) =>
    (loadConnectAndInitialize as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/connect/use-connect-appearance", () => ({
  useConnectAppearance: () => ({}),
}));

const { ConnectComponentsShell } = await import("./connect-components-shell");

afterEach(() => {
  cleanup();
  loadConnectAndInitialize.mockClear();
});

describe("ConnectComponentsShell", () => {
  it("does not load Stripe Connect until the shell mounts, then loads it with the publishable key", () => {
    expect(loadConnectAndInitialize).not.toHaveBeenCalled();
    render(
      <ConnectComponentsShell publishableKey="pk_test_456" fetchClientSecret={async () => "cs"}>
        <p>payout setup</p>
      </ConnectComponentsShell>,
    );
    expect(screen.getByText("payout setup")).toBeInTheDocument();
    expect(loadConnectAndInitialize).toHaveBeenCalledTimes(1);
    expect(loadConnectAndInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ publishableKey: "pk_test_456" }),
    );
  });
});
