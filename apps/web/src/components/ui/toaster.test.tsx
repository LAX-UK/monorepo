import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@auction/ui", () => ({
  Toaster: ({ theme }: { theme: string }) => (
    <div data-testid="public-toaster" data-theme={theme} />
  ),
}));
vi.mock("@auction/ui/lax", () => ({
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
