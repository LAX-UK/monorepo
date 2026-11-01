/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@auction/ui/components/dropdown-menu", async (importOriginal) => {
  const React = await import("react");
  const DropdownOpenContext = React.createContext(false);

  function DropdownMenu({
    children,
    open,
    defaultOpen,
  }: {
    children: ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
  }) {
    const isOpen = open ?? defaultOpen ?? false;
    return <DropdownOpenContext.Provider value={isOpen}>{children}</DropdownOpenContext.Provider>;
  }

  function DropdownMenuContent({ children }: { children: ReactNode }) {
    const isOpen = React.useContext(DropdownOpenContext);
    if (!isOpen) return null;
    return <div role="menu">{children}</div>;
  }

  function DropdownMenuItem({
    children,
    asChild,
    className,
    onSelect,
  }: {
    children: ReactNode;
    asChild?: boolean;
    className?: string;
    onSelect?: (event: { preventDefault: () => void }) => void;
  }) {
    if (asChild && React.isValidElement(children)) {
      const child = children as ReactElement<{ className?: string; role?: string }>;
      return React.cloneElement(child, {
        role: "menuitem",
        className: [className, child.props.className].filter(Boolean).join(" "),
      });
    }
    return (
      <button
        type="button"
        role="menuitem"
        className={className}
        onClick={() => onSelect?.({ preventDefault: () => {} })}
      >
        {children}
      </button>
    );
  }

  // Everything the account menu does not use stays real, so other kit parts that share this module
  // (the LAX menu behind the cover's controls) keep their exports.
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    DropdownMenu,
    DropdownMenuTrigger: ({ children }: { asChild?: boolean; children: ReactNode }) => (
      <>{children}</>
    ),
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator: () => <hr />,
  };
});

import {
  ShopAuthenticatedAccountMenu,
  ShopGuestAccountMenu,
} from "@/components/header/shop-header-account-menu";

describe("Shop account menus", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists guest sign-in and create account destinations", () => {
    render(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        initialOpen
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?returnTo=%2F",
    );
    expect(screen.getByRole("menuitem", { name: "Create account" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("lists only Your orders, LAX Account settings and Sign out", () => {
    render(
      <ShopAuthenticatedAccountMenu
        displayName="Alex Collector"
        email="alex@lax.bid"
        logoutHref="https://identity.test/logout"
        headerTone="on-light"
        initialOpen
      />,
    );
    expect(screen.getByText("alex@lax.bid")).toBeTruthy();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Your orders",
      "LAX Account settings",
      "Sign out",
    ]);
    expect(screen.getByRole("menuitem", { name: "Your orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
    expect(
      screen.getByRole("menuitem", { name: "LAX Account settings" }).getAttribute("href"),
    ).toBe("http://localhost:3040/account");
  });

  it("submits the hoisted logout form when Sign out is selected", () => {
    const logoutHref = "https://identity.test/logout";
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});

    render(
      <ShopAuthenticatedAccountMenu
        displayName="Alex Collector"
        email="alex@lax.bid"
        logoutHref={logoutHref}
        headerTone="on-light"
        initialOpen
      />,
    );

    const hiddenForm = document.querySelector(
      `form[action="${logoutHref}"][method="post"]`,
    ) as HTMLFormElement;
    expect(hiddenForm).toBeTruthy();
    expect(hiddenForm.hidden).toBe(true);

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(requestSubmit.mock.instances[0]).toBe(hiddenForm);

    requestSubmit.mockRestore();
  });

  it("honours controlled open state", () => {
    const { rerender } = render(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByRole("menuitem", { name: "Sign in" })).toBeNull();
    rerender(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toBeTruthy();
  });
});
