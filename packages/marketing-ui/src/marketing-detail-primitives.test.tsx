import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingDetailAccordion } from "./marketing-detail-accordion.js";
import { MarketingShareButton } from "./marketing-share-button.js";
import { MarketingUnderlineTabsPanel } from "./marketing-underline-tabs-panel.js";

function stubNavigator(value: Partial<Navigator>) {
  for (const [key, impl] of Object.entries(value)) {
    Object.defineProperty(navigator, key, { configurable: true, value: impl });
  }
}

afterEach(() => {
  vi.useRealTimers();
  for (const key of ["share", "clipboard"]) {
    Reflect.deleteProperty(navigator, key);
  }
});

async function clickShare() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
  });
}

describe("MarketingShareButton", () => {
  it("copies the absolute URL when Web Share is unavailable, then resets", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    render(<MarketingShareButton url="/artworks/a" title="A" />);

    await clickShare();

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/artworks/a`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.getByRole("button")).toHaveTextContent("Share");
  });

  it("uses the native share sheet without claiming a copy, and ignores cancel", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    render(<MarketingShareButton url="/a" title="A" />);

    await clickShare();

    expect(share).toHaveBeenCalledWith({ title: "A", url: `${window.location.origin}/a` });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("announces a failure when copying is blocked", async () => {
    stubNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      } as unknown as Clipboard,
    });
    render(<MarketingShareButton url="/a" title="A" />);

    await clickShare();

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy link");
  });
});

describe("MarketingUnderlineTabsPanel", () => {
  it("renders a lone panel as a headed region without a tab list", () => {
    render(
      <MarketingUnderlineTabsPanel
        ariaLabel="About"
        items={[{ id: "a", label: "About", content: "Body" }]}
      />,
    );
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("region", { name: "About" })).toHaveTextContent("Body");
  });

  it("renders tabs when there are several panels", () => {
    render(
      <MarketingUnderlineTabsPanel
        ariaLabel="About this work"
        items={[
          { id: "a", label: "About", content: "Body" },
          { id: "e", label: "Exhibitions", content: "Shows" },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "About this work" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Body");
  });
});

describe("MarketingDetailAccordion", () => {
  it("opens the requested items and renders nothing when empty", () => {
    const { container, rerender } = render(<MarketingDetailAccordion items={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <MarketingDetailAccordion
        defaultOpen={["d"]}
        items={[
          { id: "d", title: "Details", content: "Year 2024" },
          { id: "p", title: "Provenance", content: "Private collection" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Provenance" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Year 2024")).toBeVisible();
  });
});
