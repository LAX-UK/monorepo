import { BidPhoneMenuMount } from "@/components/layout/bid-phone-menu-mount";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const chunk = vi.hoisted(() => ({ failures: 0 }));

vi.mock("@/components/layout/bid-phone-menu", () => ({
  // Reading the export throws while a failure is queued, like a chunk that cannot be fetched.
  get BidPhoneMenu() {
    if (chunk.failures > 0) {
      chunk.failures -= 1;
      throw new Error("Loading chunk failed");
    }
    return ({ open }: { open: boolean }) => (
      <div data-testid="phone-menu" data-open={String(open)} />
    );
  },
}));

const props = {
  onOpenChange: () => {},
  pathname: "/",
  searchParams: new URLSearchParams(),
  sections: emptyMegaMenuSections(),
};

describe("BidPhoneMenuMount", () => {
  afterEach(() => {
    chunk.failures = 0;
  });

  it("closes again when the chunk fails to load, then opens on the next tap", async () => {
    chunk.failures = 1;
    const onOpenChange = vi.fn();
    const view = render(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open={false} />);
    view.rerender(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open />);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId("phone-menu")).toBeNull();
    view.rerender(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open={false} />);
    view.rerender(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open />);
    expect(await screen.findByTestId("phone-menu")).toHaveAttribute("data-open", "true");
  });

  it("reloads the page when a second tap cannot load the menu either", async () => {
    chunk.failures = 2;
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const onOpenChange = vi.fn();
    const view = render(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open />);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    view.rerender(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open={false} />);
    view.rerender(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    vi.unstubAllGlobals();
  });

  it("closes on Escape while the menu is still loading", () => {
    const onOpenChange = vi.fn();
    render(<BidPhoneMenuMount {...props} onOpenChange={onOpenChange} open />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

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
