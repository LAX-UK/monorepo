import { AdaptiveMediaFrame } from "@/components/ui/adaptive-media-frame";
import { HeroCoverImage } from "@/components/ui/hero-cover-image";
import { HERO_IMMERSIVE_SLOTS } from "@/lib/media/overlay-slot-presets";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HeroCoverImage", () => {
  it("renders picture with mobile source when mobile URL is distinct", () => {
    render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{
            desktopUrl: "https://cdn.example.com/wide.jpg",
            mobileUrl: "https://cdn.example.com/mobile.jpg",
          }}
          alt="Auction cover"
        />
      </AdaptiveMediaFrame>,
    );

    const sources = document.querySelectorAll("source");
    expect(sources).toHaveLength(1);
    expect(sources[0]).toHaveAttribute("srcset", "https://cdn.example.com/mobile.jpg");
    expect(screen.getByRole("img", { name: "Auction cover" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/wide.jpg",
    );
  });

  it("renders desktop xl source before mobile when both are distinct", () => {
    render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{
            desktopUrl: "https://cdn.example.com/wide.jpg",
            mobileUrl: "https://cdn.example.com/mobile.jpg",
            desktopWideUrl: "https://cdn.example.com/xl.jpg",
          }}
          alt="Auction cover"
        />
      </AdaptiveMediaFrame>,
    );

    const sources = document.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("media", "(min-width: 1280px)");
    expect(sources[0]).toHaveAttribute("srcset", "https://cdn.example.com/xl.jpg");
    expect(sources[1]).toHaveAttribute("media", "(max-width: 767px)");
  });

  it("renders img only when mobile URL is absent", () => {
    render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{ desktopUrl: "https://cdn.example.com/wide.jpg" }}
          alt="Auction cover"
        />
      </AdaptiveMediaFrame>,
    );

    expect(document.querySelector("source")).toBeNull();
    expect(screen.getByRole("img", { name: "Auction cover" })).toBeInTheDocument();
  });

  it("returns null when desktop URL is missing", () => {
    const { container } = render(
      <AdaptiveMediaFrame src={null} objectFit="cover" slots={HERO_IMMERSIVE_SLOTS}>
        <HeroCoverImage cover={{ desktopUrl: null }} alt="Missing" />
      </AdaptiveMediaFrame>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows shimmer placeholder and fades in non-priority images on load", () => {
    const { container } = render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{ desktopUrl: "https://cdn.example.com/wide.jpg" }}
          alt="Auction cover"
        />
      </AdaptiveMediaFrame>,
    );

    expect(container.querySelector(".shimmer-sweep")).toBeInTheDocument();
    const image = screen.getByRole("img", { name: "Auction cover" });
    expect(image).toHaveClass("opacity-0");

    fireEvent.load(image);

    expect(container.querySelector(".shimmer-sweep")).not.toBeInTheDocument();
    expect(image).toHaveClass("opacity-100");
  });

  it("skips fade-in for priority images (LCP guard)", () => {
    const { container } = render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{ desktopUrl: "https://cdn.example.com/wide.jpg" }}
          alt="Auction cover"
          priority
        />
      </AdaptiveMediaFrame>,
    );

    const image = screen.getByRole("img", { name: "Auction cover" });
    expect(image).not.toHaveClass("opacity-0");
    expect(container.querySelector(".shimmer-sweep")).toBeInTheDocument();

    fireEvent.load(image);

    expect(image).not.toHaveClass("opacity-100");
    expect(container.querySelector(".shimmer-sweep")).not.toBeInTheDocument();
  });

  it("omits placeholder when showPlaceholder is false", () => {
    const { container } = render(
      <AdaptiveMediaFrame
        src="https://cdn.example.com/wide.jpg"
        objectFit="cover"
        slots={HERO_IMMERSIVE_SLOTS}
      >
        <HeroCoverImage
          cover={{ desktopUrl: "https://cdn.example.com/wide.jpg" }}
          alt="Auction cover"
          showPlaceholder={false}
        />
      </AdaptiveMediaFrame>,
    );

    expect(container.querySelector(".shimmer-sweep")).not.toBeInTheDocument();
  });
});
