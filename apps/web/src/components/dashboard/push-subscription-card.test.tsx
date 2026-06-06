import { PushSubscriptionCard } from "@/components/dashboard/push-subscription-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/push/use-push-subscription", () => ({
  usePushSubscription: vi.fn(),
}));

import { usePushSubscription } from "@/lib/push/use-push-subscription";

const mockHook = vi.mocked(usePushSubscription);

describe("PushSubscriptionCard", () => {
  it("shows loading state", () => {
    mockHook.mockReturnValue({
      supported: true,
      permission: "default",
      hasBrowserSubscription: false,
      hasServerSubscription: false,
      loading: true,
      busy: false,
      refresh: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      sync: vi.fn(),
    });
    render(<PushSubscriptionCard />);
    expect(screen.getByText("Checking push status…")).toBeInTheDocument();
  });

  it("shows unsupported message", () => {
    mockHook.mockReturnValue({
      supported: false,
      permission: "denied",
      hasBrowserSubscription: false,
      hasServerSubscription: false,
      loading: false,
      busy: false,
      refresh: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      sync: vi.fn(),
    });
    render(<PushSubscriptionCard />);
    expect(screen.getByText("Browser push not supported")).toBeInTheDocument();
  });

  it("shows enable CTA when not subscribed", () => {
    mockHook.mockReturnValue({
      supported: true,
      permission: "default",
      hasBrowserSubscription: false,
      hasServerSubscription: false,
      loading: false,
      busy: false,
      refresh: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      sync: vi.fn(),
    });
    render(<PushSubscriptionCard />);
    expect(screen.getByRole("button", { name: /enable browser push/i })).toBeInTheDocument();
  });

  it("shows disable CTA when subscribed", () => {
    mockHook.mockReturnValue({
      supported: true,
      permission: "granted",
      hasBrowserSubscription: true,
      hasServerSubscription: true,
      loading: false,
      busy: false,
      refresh: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      sync: vi.fn(),
    });
    render(<PushSubscriptionCard />);
    expect(screen.getByText("Browser push enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disable push/i })).toBeInTheDocument();
  });

  it("shows denied instructions", () => {
    mockHook.mockReturnValue({
      supported: true,
      permission: "denied",
      hasBrowserSubscription: false,
      hasServerSubscription: false,
      loading: false,
      busy: false,
      refresh: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      sync: vi.fn(),
    });
    render(<PushSubscriptionCard />);
    expect(screen.getByText("Notifications blocked")).toBeInTheDocument();
  });
});
