import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@auction/ui", () => ({
  Toaster: ({ theme }: { theme: string }) => (
    <div data-testid="public-toaster" data-theme={theme} />
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

  it("leaves admin pages to the staff toaster, so a toast shows once", () => {
    pathname.mockReturnValue("/admin/payments");
    const { queryByTestId } = render(<Toaster />);
    expect(queryByTestId("public-toaster")).toBeNull();
  });
});
