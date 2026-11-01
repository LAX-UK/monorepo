import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MarketingHangLabel } from "./marketing-hang-label.js";
import { MarketingHangSkeleton } from "./marketing-hang-skeleton.js";
import { MarketingHang, type MarketingHangWork } from "./marketing-hang.js";

function makeWorks(count: number, longSideCm: (i: number) => number | null = () => 80) {
  return Array.from(
    { length: count },
    (_, i): MarketingHangWork => ({
      id: `w${i + 1}`,
      href: `/lot/w${i + 1}`,
      imageSrc: `/img/${i + 1}.jpg`,
      aspect: 0.8,
      longSideCm: longSideCm(i),
      label: (
        <MarketingHangLabel
          eyebrow={`Lot ${i + 1}`}
          title={`Work ${i + 1}`}
          price={{ qualifier: "Current bid", value: "£1,000" }}
          notes={["Closes Tue 21:00"]}
        />
      ),
    }),
  );
}

const SEE_ALL = {
  href: "/sales/s1",
  label: "See all 8 lots",
  tile: { title: "See all 8 lots", note: "Modern & Contemporary" },
};

function mockOverflow(scrollWidth: number, clientWidth: number) {
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  const client = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
  return () => {
    scroll.mockRestore();
    client.mockRestore();
  };
}

describe("MarketingHang", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a labelled region named by its heading", () => {
    render(<MarketingHang title="In this sale" works={makeWorks(3)} />);
    const region = screen.getByRole("region", { name: "In this sale" });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "In this sale" })).toBeInTheDocument();
  });

  it("renders nothing for an empty wall", () => {
    const { container } = render(<MarketingHang title="In this sale" works={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tells a function meta which mode the wall settled on", () => {
    const meta = (mode: string) => (mode === "scale" ? "to scale line" : "salon line");
    const { rerender } = render(
      <MarketingHang title="In this sale" works={makeWorks(3)} meta={meta} />,
    );
    expect(screen.getByText("to scale line")).toBeInTheDocument();
    rerender(
      <MarketingHang
        title="In this sale"
        works={makeWorks(3, (i) => (i === 0 ? null : 80))}
        meta={meta}
      />,
    );
    expect(screen.getByText("salon line")).toBeInTheDocument();
  });

  it("draws the See all links as the kit text link: ink and underlined", () => {
    render(<MarketingHang title="In this sale" works={makeWorks(3)} seeAll={SEE_ALL} />);
    for (const link of screen.getAllByRole("link", { name: "See all 8 lots" })) {
      expect(link).toHaveClass("underline");
    }
  });

  describe("one work", () => {
    it("hangs the single work with no arrows and no figure on home", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(1)} />);
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.queryByText("Figure, 170 cm")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("hangs a 170 cm figure beside the work in figure mode", () => {
      render(<MarketingHang title="Highlights" works={makeWorks(1)} figure />);
      expect(screen.getByText("Figure, 170 cm")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /Scale bar/ })).toBeInTheDocument();
    });
  });

  describe("two to five works", () => {
    it("shows every work in one row with no arrows and no end tile", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(5)} seeAll={SEE_ALL} />);
      expect(screen.getByText("Work 5")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Next works" })).not.toBeInTheDocument();
      // The header link and the phone link, but no end tile.
      expect(screen.getAllByRole("link", { name: "See all 8 lots" })).toHaveLength(2);
      expect(screen.queryByText("Modern & Contemporary")).not.toBeInTheDocument();
    });

    it("keys the scale to the tallest work: one factor for the wall", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(3)} />);
      const bar = screen.getByRole("img", { name: /Scale bar/ });
      expect(bar).toHaveAttribute("aria-label", "Scale bar: 25 cm");
      expect(screen.getByText("True relative scale")).toBeInTheDocument();
    });
  });

  describe("six or more works", () => {
    it("shows the arrow pair beside the link and an end tile", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(8)} seeAll={SEE_ALL} />);
      expect(screen.getByRole("button", { name: "Previous works" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next works" })).toBeInTheDocument();
      expect(screen.getByText("Modern & Contemporary")).toBeInTheDocument();
      expect(screen.getByText("Work 8")).toBeInTheDocument();
    });

    it("disables the previous arrow at the start and no fade when nothing more can scroll", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(8)} />);
      expect(screen.getByRole("button", { name: "Previous works" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next works" })).toBeDisabled();
    });

    it("enables next and fades the edge while more can scroll, then disables next at the end", () => {
      const restore = mockOverflow(3000, 1000);
      const { container } = render(
        <MarketingHang title="In this sale" works={makeWorks(8)} seeAll={SEE_ALL} />,
      );
      const row = screen.getByRole("region", { name: /scrolls sideways/ });
      expect(screen.getByRole("button", { name: "Next works" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Previous works" })).toBeDisabled();
      expect(container.querySelector("[data-hang-fade]")).not.toBeNull();

      row.scrollLeft = 2000;
      fireEvent.scroll(row);
      expect(screen.getByRole("button", { name: "Next works" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Previous works" })).toBeEnabled();
      expect(container.querySelector("[data-hang-fade]")).toBeNull();
      restore();
    });

    it("scrolls a page when an arrow is pressed", () => {
      const restore = mockOverflow(3000, 1000);
      render(<MarketingHang title="In this sale" works={makeWorks(8)} />);
      const row = screen.getByRole("region", { name: /scrolls sideways/ });
      const scrollBy = vi.fn();
      row.scrollBy = scrollBy;
      fireEvent.click(screen.getByRole("button", { name: "Next works" }));
      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 750 }));
      restore();
    });
  });

  describe("salon mode", () => {
    it("says Not to scale when a size is missing and drops the scale bar", () => {
      render(
        <MarketingHang title="In this sale" works={makeWorks(5, (i) => (i === 2 ? null : 80))} />,
      );
      expect(screen.getByText("Not to scale")).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /Scale bar/ })).not.toBeInTheDocument();
      expect(screen.getByText(/Sizes missing for some works/)).toBeInTheDocument();
    });

    it("says why when the sizes differ too much", () => {
      render(
        <MarketingHang title="In this sale" works={makeWorks(3, (i) => [10, 80, 90][i] ?? 80)} />,
      );
      expect(screen.getByText("Not to scale")).toBeInTheDocument();
      expect(screen.getByText(/Sizes differ too much to show to scale/)).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("makes the row focusable only when there is more to scroll", () => {
      const quiet = render(<MarketingHang title="In this sale" works={makeWorks(3)} />);
      expect(screen.getByRole("region", { name: /scrolls sideways/ })).not.toHaveAttribute(
        "tabindex",
      );
      quiet.unmount();

      const restore = mockOverflow(3000, 1000);
      render(<MarketingHang title="In this sale" works={makeWorks(8)} />);
      expect(screen.getByRole("region", { name: /scrolls sideways/ })).toHaveAttribute(
        "tabindex",
        "0",
      );
      restore();
    });

    it("scrolls with the arrow keys, Home and End when the row has focus", () => {
      const restore = mockOverflow(3000, 1000);
      render(<MarketingHang title="In this sale" works={makeWorks(8)} />);
      const row = screen.getByRole("region", { name: /scrolls sideways/ });
      const scrollBy = vi.fn();
      const scrollTo = vi.fn();
      row.scrollBy = scrollBy;
      row.scrollTo = scrollTo as typeof row.scrollTo;
      row.focus();

      fireEvent.keyDown(row, { key: "ArrowRight" });
      expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: 160 }));
      fireEvent.keyDown(row, { key: "ArrowLeft" });
      expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -160 }));
      fireEvent.keyDown(row, { key: "Home" });
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
      fireEvent.keyDown(row, { key: "End" });
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 3000 }));
      restore();
    });

    it("leaves other keys alone", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(8)} />);
      const row = screen.getByRole("region", { name: /scrolls sideways/ });
      const scrollBy = vi.fn();
      row.scrollBy = scrollBy;
      fireEvent.keyDown(row, { key: "a" });
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it("makes each work one link whose name carries the label", () => {
      render(<MarketingHang title="In this sale" works={makeWorks(2)} />);
      const link = screen.getByRole("link", { name: /Work 1/ });
      expect(link).toHaveAttribute("href", "/lot/w1");
      expect(link).toHaveTextContent("£1,000");
    });

    it("gives the pictures empty alt text, because the label names the work", () => {
      const { container } = render(<MarketingHang title="In this sale" works={makeWorks(2)} />);
      for (const img of container.querySelectorAll("img")) expect(img).toHaveAttribute("alt", "");
    });
  });

  describe("images", () => {
    it("drops a work whose picture fails and keeps the rest", () => {
      const { container } = render(<MarketingHang title="In this sale" works={makeWorks(3)} />);
      const first = container.querySelector("img");
      expect(first).not.toBeNull();
      if (first) fireEvent.error(first);
      expect(screen.queryByText("Work 1")).not.toBeInTheDocument();
      expect(screen.getByText("Work 2")).toBeInTheDocument();
    });

    it("hides the whole wall when every picture fails", () => {
      const { container } = render(<MarketingHang title="In this sale" works={makeWorks(1)} />);
      const img = container.querySelector("img");
      if (img) fireEvent.error(img);
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("caps the wall at twelve works", () => {
    render(<MarketingHang title="In this sale" works={makeWorks(15)} />);
    expect(screen.getByText("Work 12")).toBeInTheDocument();
    expect(screen.queryByText("Work 13")).not.toBeInTheDocument();
  });
});

describe("MarketingHangSkeleton", () => {
  it("is hidden from assistive technology and reserves the wall's height", () => {
    render(<MarketingHangSkeleton />);
    const skeleton = screen.getByTestId("marketing-hang-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton.querySelector(".sm\\:h-\\[300px\\]")).not.toBeNull();
    expect(skeleton.querySelector(".h-\\[180px\\]")).not.toBeNull();
  });
});
