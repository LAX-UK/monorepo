import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BID_COVER_FIXTURES,
  COVER_BEHAVIOUR_FIXTURES,
  type CoverFixture,
  SHOP_COVER_FIXTURES,
} from "./cover-fixtures.js";
import { neutralCoverSlide } from "./cover-neutral.js";
import { MarketingCover } from "./marketing-cover.js";

const fixture = (list: readonly CoverFixture[], id: string): CoverFixture => {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
};

function renderFixture(item: CoverFixture) {
  return render(<MarketingCover slides={item.slides} label="Featured sales" />);
}

describe("MarketingCover modes", () => {
  it("draws a photograph under a scrim and credits it with a link", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "live"));
    expect(container.querySelector("[data-cover-mode='photo']")).not.toBeNull();
    expect(container.querySelector("[data-cover-scrim]")).not.toBeNull();
    expect(container.querySelector("[data-cover-credit-band]")).not.toBeNull();
    const credit = screen.getByRole("link", { name: /Estuary, Evening \(detail\)/ });
    expect(credit).toHaveAttribute("href", "#lot-4");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Modern & Contemporary: Online",
    );
  });

  it("draws a plate with no scrim", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "no-cover"));
    expect(container.querySelector("[data-cover-mode='plate']")).not.toBeNull();
    expect(container.querySelector("[data-cover-scrim]")).toBeNull();
  });

  it("draws type only when there are no pictures", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "no-images"));
    expect(container.querySelector("[data-cover-mode='type']")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("sets the title on the type scale for its length", () => {
    renderFixture(fixture(BID_COVER_FIXTURES, "long-title"));
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("md:text-[36px]");
  });

  it("moves the text to the right when the picture says so", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "long-title"));
    expect(container.querySelector("[data-cover-side='right']")).not.toBeNull();
  });

  it("renders every Bid, Shop and behaviour scenario", () => {
    for (const item of [
      ...BID_COVER_FIXTURES,
      ...SHOP_COVER_FIXTURES,
      ...COVER_BEHAVIOUR_FIXTURES,
    ]) {
      const { unmount } = renderFixture(item);
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("failures", () => {
  it("moves to the next source without a message when a photograph fails", () => {
    const { container } = renderFixture(fixture(COVER_BEHAVIOUR_FIXTURES, "photo-fails"));
    expect(container.querySelector("[data-cover-mode='photo']")).not.toBeNull();
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("[data-cover-mode='plate']")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls to type only when no source is left", () => {
    const { container } = renderFixture(fixture(COVER_BEHAVIOUR_FIXTURES, "all-fail"));
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("[data-cover-mode='type']")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("shows a neutral type cover for a data error", () => {
    const { container } = render(
      <MarketingCover
        label="Featured sales"
        slides={[
          neutralCoverSlide({
            title: "Sales can’t be shown right now",
            primary: { label: "Browse sales", href: "/sales" },
          }),
        ]}
      />,
    );
    expect(container.querySelector("[data-cover-mode='type']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Browse sales" })).toHaveAttribute("href", "/sales");
  });
});

describe("pinned sales", () => {
  it("steps with previous and next, with no autoplay or pause control", () => {
    renderFixture(fixture(BID_COVER_FIXTURES, "pinned"));
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause|play/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next sale" }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The November Room");
    fireEvent.click(screen.getByRole("button", { name: "Previous sale" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous sale" }));
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
  });

  it("describes itself as a carousel only when there are several", () => {
    const several = renderFixture(fixture(BID_COVER_FIXTURES, "pinned"));
    expect(several.container.querySelector("[aria-roledescription='carousel']")).not.toBeNull();
    several.unmount();
    const one = renderFixture(fixture(BID_COVER_FIXTURES, "live"));
    expect(one.container.querySelector("[aria-roledescription='carousel']")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next sale" })).toBeNull();
  });

  it("shows at most three", () => {
    const base = fixture(BID_COVER_FIXTURES, "live").slides[0];
    if (!base) throw new Error("fixture");
    const slides = [1, 2, 3, 4, 5].map((n) => ({ ...base, id: `s${n}` }));
    render(<MarketingCover slides={slides} label="Featured sales" />);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });
});

describe("loading and motion", () => {
  it("keeps the picture invisible until it has loaded, then fades it in", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "live"));
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.className).toContain("opacity-0");
    expect(img.className).toContain("duration-[240ms]");
    expect(img.className).toContain("motion-reduce:transition-none");
    fireEvent.load(img);
    expect(img.className).toContain("opacity-100");
    expect(container.querySelector("[data-cover-blur]")).not.toBeNull();
  });

  it("settles a picture under 2880px and keeps a sharp one still", () => {
    const soft = renderFixture(fixture(BID_COVER_FIXTURES, "live"));
    expect(soft.container.querySelector(".marketing-cover-settle")).not.toBeNull();
    soft.unmount();
    const sharp = fixture(BID_COVER_FIXTURES, "live").slides[0];
    const media = sharp?.media[0];
    if (!sharp || media?.kind !== "photo") throw new Error("fixture");
    const stillMedia = {
      ...media,
      slots: { default: { ...media.slots.default, width: 3600, zoom: 1 } },
    };
    const { container } = render(
      <MarketingCover slides={[{ ...sharp, media: [stillMedia] }]} label="Featured sales" />,
    );
    expect(container.querySelector(".marketing-cover-settle")).toBeNull();
  });

  it("gives the phone one opaque badge on the picture and the status once to screen readers", () => {
    const { container } = renderFixture(fixture(BID_COVER_FIXTURES, "live"));
    const onPicture = container.querySelector(
      "[data-cover-media] [aria-hidden='true'].md\\:hidden",
    );
    expect(onPicture).toHaveTextContent("Live");
    const media = container.querySelector("[data-cover-media]") as HTMLElement;
    expect(within(media).getAllByText("Live")).toHaveLength(1);
  });

  it("states where the person stands", () => {
    renderFixture(fixture(BID_COVER_FIXTURES, "approved"));
    expect(screen.getByText("You’re approved to bid in this sale")).toBeInTheDocument();
  });
});
