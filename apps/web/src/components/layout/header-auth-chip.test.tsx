import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HeaderAuthChip } from "./header-auth-chip";

const useAppSessionMock = vi.fn();

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => useAppSessionMock(),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./notification-bell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  image: null,
};

describe("HeaderAuthChip", () => {
  it("renders a loading skeleton while the session resolves", () => {
    useAppSessionMock.mockReturnValue({ user: null, pending: true });

    render(<HeaderAuthChip variant="account" />);

    expect(screen.getByLabelText("Loading account")).toHaveAttribute("aria-busy", "true");
  });

  it("renders the login pill when signed out", () => {
    useAppSessionMock.mockReturnValue({ user: null, pending: false });

    render(<HeaderAuthChip variant="account" />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });

  it("renders the account menu from SSR fallback without waiting on client session", () => {
    useAppSessionMock.mockReturnValue({ user: clientUser, pending: false });

    render(<HeaderAuthChip variant="account" />);

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getAllByText("Client User")).toHaveLength(2);
    expect(screen.getByText("client@example.com")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
