import { resetImageFallbackReports } from "@/lib/observability/report-image-fallback";
import * as Sentry from "@sentry/nextjs";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeHangSection } from "./home-hang-section";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const work = (id: string) => ({
  lotId: id,
  href: `/lot/harbour/${id}`,
  photo: {
    imageSrc: `https://lax-media.lon1.cdn.digitaloceanspaces.com/lot/${id}.jpg`,
    aspect: 1.25,
    longSideCm: 90,
    sourceWidthPx: 1371,
    sourceHeightPx: 1100,
  },
  label: { eyebrow: "Artist", title: `Harbour ${id}` },
});

const hang = {
  kind: "inSale" as const,
  title: "In this sale",
  summary: "2 lots",
  scaleNote: false,
  seeAll: { href: "/sales/harbour", label: "See all lots" },
  works: [work("a"), work("b")],
};

describe("HomeHangSection and a refused resized picture", () => {
  beforeEach(() => {
    resetImageFallbackReports();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it("reports the fallback to the original once, however many works fall back", () => {
    const { container } = render(<HomeHangSection hang={hang as never} />);
    const images = [...container.querySelectorAll("img")];
    expect(images.length).toBeGreaterThanOrEqual(2);
    for (const img of images) fireEvent.error(img);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});
