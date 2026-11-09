import { HomeCover } from "@/components/sections/home/home-cover";
import { bidHeroPresence } from "@/lib/layout/bid-hero-presence";
import { resetImageFallbackReports } from "@/lib/observability/report-image-fallback";
import { BID_COVER_FIXTURES } from "@auction/marketing-ui/cover-fixtures";
import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/marketing-cover/cover-viewer.client", () => ({
  fetchCoverViewer: vi.fn(async () => "anonymous"),
}));

const slidesOf = (id: string) => {
  const found = BID_COVER_FIXTURES.find((fixture) => fixture.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found.slides;
};

const mount = (id: string) =>
  render(<HomeCover slides={slidesOf(id)} leadSale={null} signedIn={false} />);

describe("HomeCover and the header", () => {
  it("tells the header a cover photograph is under it, and lets go when it leaves", () => {
    const presence = renderHook(() => bidHeroPresence.useHeroPresent());
    expect(presence.result.current).toBe(false);
    const view = mount("live");
    expect(presence.result.current).toBe(true);
    expect(screen.getByRole("region", { name: /./ })).toBeInTheDocument();
    view.unmount();
    expect(presence.result.current).toBe(false);
  });

  it("keeps the header solid under a plate or a type-only cover", () => {
    const presence = renderHook(() => bidHeroPresence.useHeroPresent());
    for (const id of ["no-cover", "no-images"]) {
      const view = mount(id);
      expect(presence.result.current).toBe(false);
      view.unmount();
    }
  });
});

describe("HomeCover and a refused resized picture", () => {
  beforeEach(() => {
    resetImageFallbackReports();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it("reports the fallback to the original, once", () => {
    const { container } = mount("live");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});
