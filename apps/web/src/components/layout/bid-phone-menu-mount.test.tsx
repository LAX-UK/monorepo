import { BidPhoneMenuMount } from "@/components/layout/bid-phone-menu-mount";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/bid-phone-menu", () => ({
  BidPhoneMenu: ({ open }: { open: boolean }) => (
    <div data-testid="phone-menu" data-open={String(open)} />
  ),
}));

const props = {
  onOpenChange: () => {},
  pathname: "/",
  searchParams: new URLSearchParams(),
  sections: emptyMegaMenuSections(),
};

describe("BidPhoneMenuMount", () => {
  it("draws nothing before the menu is wanted", () => {
    render(<BidPhoneMenuMount {...props} open={false} />);
    expect(screen.queryByTestId("phone-menu")).toBeNull();
  });

  it("loads the menu when it is opened before the page is idle", async () => {
    const view = render(<BidPhoneMenuMount {...props} open={false} />);
    view.rerender(<BidPhoneMenuMount {...props} open />);
    expect(await screen.findByTestId("phone-menu")).toHaveAttribute("data-open", "true");
  });

  it("keeps the loaded menu mounted after it closes", async () => {
    const view = render(<BidPhoneMenuMount {...props} open />);
    await screen.findByTestId("phone-menu");
    view.rerender(<BidPhoneMenuMount {...props} open={false} />);
    expect(screen.getByTestId("phone-menu")).toHaveAttribute("data-open", "false");
  });
});
