import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@auction/ui/components/sonner", () => ({
  Toaster: ({ theme, mobileOffset }: { theme: string; mobileOffset?: { bottom?: string } }) => (
    <div
      data-testid="public-toaster"
      data-theme={theme}
      data-bottom-offset={mobileOffset?.bottom ?? ""}
    />
  ),
}));
vi.mock("@auction/ui/lax/toaster", () => ({
  Toaster: ({ density }: { density: string }) => (
    <div data-testid="workspace-toaster" data-density={density} />
  ),
}));

import { Toaster } from "./toaster";

describe("Toaster", () => {
  beforeEach(() => pathname.mockReset());

  it("hosts toasts on public pages", () => {
    pathname.mockReturnValue("/lots");
    const { getByTestId } = render(<Toaster />);
    expect(getByTestId("public-toaster")).toBeInTheDocument();
  });

  it("keeps a bottom toast above the docked tab bar", () => {
    pathname.mockReturnValue("/sales");
    const { getByTestId } = render(<Toaster />);
    expect(getByTestId("public-toaster").getAttribute("data-bottom-offset")).toContain(
      "--lax-bottom-bar-space",
    );
  });

  it("hosts the client workspace's toasts on the LAX system toast, at the client density", () => {
    pathname.mockReturnValue("/selling/consignments");
    const { getByTestId, queryByTestId } = render(<Toaster />);
    expect(getByTestId("workspace-toaster")).toHaveAttribute("data-density", "client");
    expect(queryByTestId("public-toaster")).toBeNull();
  });

  it("leaves admin pages to the staff toaster, so a toast shows once", () => {
    pathname.mockReturnValue("/admin/payments");
    const { queryByTestId } = render(<Toaster />);
    expect(queryByTestId("public-toaster")).toBeNull();
  });
});
