import { SaleroomDayGallery } from "@/components/sections/saleroom/saleroom-day-gallery";
import type { DayGalleryVM } from "@/components/sections/saleroom/view-models";
import type { SaleDayMedia } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const preloaded = vi.hoisted(() => ({ count: 0 }));

const mediaLightboxMock = vi.fn(
  ({
    open,
    index,
    onClose,
  }: {
    open: boolean;
    index: number;
    onClose: () => void;
  }) => (
    // Always rendered once mounted, like the real viewer, which plays its closing motion.
    <div data-testid="media-lightbox" data-index={index} data-open={String(open)}>
      {open ? (
        <button type="button" onClick={onClose}>
          Close lightbox
        </button>
      ) : null}
    </div>
  ),
);

vi.mock("@/components/gallery/engine/media-lightbox", () => {
  preloaded.count += 1;
  return {
    MediaLightbox: (props: Parameters<typeof mediaLightboxMock>[0]) => mediaLightboxMock(props),
  };
});

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt, label }: { alt?: string; label?: string }) => (
    <img alt={alt ?? label ?? ""} data-testid="media-image" />
  ),
}));

function imageItem(index: number, caption?: string): SaleDayMedia {
  return {
    mediaType: "image",
    src: `uploads/day-${index}.jpg`,
    alt: `Photo ${index}`,
    ...(caption ? { caption } : {}),
  };
}

function videoItem(index: number): SaleDayMedia {
  return {
    mediaType: "video",
    src: `uploads/clip-${index}.webm`,
    posterSrc: `uploads/poster-${index}.jpg`,
    caption: `Clip ${index}`,
  };
}

function makeVm(items: SaleDayMedia[]): DayGalleryVM {
  return { saleTitle: "Evening Sale", items };
}

function clickFirstButton(name: string | RegExp) {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  fireEvent.click(button);
}

describe("SaleroomDayGallery", () => {
  it("starts fetching the viewer when a picture is pointed at, before anything is opened", async () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 15 }, (_, i) => imageItem(i + 1)))} />,
    );
    expect(preloaded.count).toBe(0);
    const thumbnail = screen.getAllByRole("button", { name: "Open photo 2 of 15: Photo 2" })[0];
    if (!thumbnail) throw new Error("Expected a picture");
    fireEvent.pointerEnter(thumbnail);
    await waitFor(() => expect(preloaded.count).toBe(1));
    expect(screen.queryByTestId("media-lightbox")).toBeNull();
  });

  it("renders all items inline for small sets without View all", () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 5 }, (_, i) => imageItem(i + 1)))} />,
    );

    expect(screen.getAllByRole("button", { name: /Open photo/i })).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /View all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /\+.*more/i })).toBeNull();
  });

  it("shows preview, overflow tile, and View all for large sets", () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 30 }, (_, i) => imageItem(i + 1)))} />,
    );

    expect(screen.getAllByRole("button", { name: /Open photo/i })).toHaveLength(11);
    expect(
      screen.getByRole("button", { name: /View all 30 auction day photographs/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /View all \(30\)/i })).toBeTruthy();
    expect(screen.getByText("+19")).toBeTruthy();
  });

  it("opens the sheet from View all and opens lightbox from a sheet item", async () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 15 }, (_, i) => imageItem(i + 1)))} />,
    );

    clickFirstButton(/View all \(15\)/i);
    expect(screen.getAllByRole("button", { name: /Open photo/i })).toHaveLength(15);

    clickFirstButton("Open photo 3 of 15: Photo 3");
    // The viewer is fetched when a picture is opened, so it arrives a moment later.
    expect(await screen.findByTestId("media-lightbox")).toHaveAttribute("data-index", "2");
  });

  it("opens lightbox directly from an inline preview thumb", async () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 15 }, (_, i) => imageItem(i + 1)))} />,
    );

    clickFirstButton("Open photo 1 of 15: Photo 1");
    expect(await screen.findByTestId("media-lightbox")).toHaveAttribute("data-index", "0");
  });

  it("keeps the viewer mounted after it closes, and leaves focus on the picture that opened it", async () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 15 }, (_, i) => imageItem(i + 1)))} />,
    );
    expect(screen.queryByTestId("media-lightbox")).toBeNull();

    const thumbnail = screen.getAllByRole("button", { name: "Open photo 1 of 15: Photo 1" })[0];
    if (!thumbnail) throw new Error("Expected the first picture");
    thumbnail.focus();
    fireEvent.click(thumbnail);
    const viewer = await screen.findByTestId("media-lightbox");
    expect(viewer).toHaveAttribute("data-open", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close lightbox" }));
    // Still mounted, now closed: the closing motion plays and the picture keeps focus.
    expect(screen.getByTestId("media-lightbox")).toHaveAttribute("data-open", "false");
    expect(document.body.contains(thumbnail)).toBe(true);
    expect(document.activeElement).toBe(thumbnail);
  });

  it("opens the sheet from the overflow tile", () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 15 }, (_, i) => imageItem(i + 1)))} />,
    );

    clickFirstButton(/View all 15 auction day photographs/);
    expect(screen.getAllByRole("button", { name: /Open photo/i })).toHaveLength(15);
  });

  it("renders video play affordance in preview and sheet", () => {
    const items = [
      ...Array.from({ length: 12 }, (_, i) => imageItem(i + 1)),
      videoItem(13),
      ...Array.from({ length: 2 }, (_, i) => imageItem(i + 14)),
    ];

    render(<SaleroomDayGallery vm={makeVm(items)} />);

    clickFirstButton(/View all \(15\)/i);
    expect(screen.getByRole("button", { name: /Play video 13 of 15/i })).toBeTruthy();
  });

  it("shows dynamic subtitle with total count for large sets", () => {
    render(
      <SaleroomDayGallery vm={makeVm(Array.from({ length: 30 }, (_, i) => imageItem(i + 1)))} />,
    );

    expect(screen.getByText("30 photographs from the saleroom floor.")).toBeTruthy();
  });
});
