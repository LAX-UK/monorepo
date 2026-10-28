import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageGallery, type ImageGalleryItem } from "./image-gallery.js";

const ITEMS: ImageGalleryItem[] = [
  { id: "a", src: "/a.jpg", alt: "Morning tide", title: "Morning tide", caption: "2024 · Oil" },
  { id: "b", src: "/b.jpg", alt: "Low water", title: "Low water", badge: "Edition" },
  { id: "c", src: null, alt: "Lost", title: "Lost" },
];

describe("ImageGallery", () => {
  it("lists every work as a tile with its title, caption and badge", () => {
    render(<ImageGallery items={ITEMS} label="Works" />);
    const list = screen.getByRole("list", { name: "Works" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("2024 · Oil")).toBeInTheDocument();
    expect(screen.getByText("Edition")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Low water, 2 of 3" })).toBeInTheDocument();
  });

  it("says when an image cannot be shown instead of breaking", () => {
    render(<ImageGallery items={ITEMS} label="Works" />);
    expect(screen.getByText("Image not available")).toBeInTheDocument();
  });

  it("opens a viewer that steps through the set and wraps around", () => {
    render(<ImageGallery items={ITEMS} label="Works" />);
    fireEvent.click(screen.getByRole("button", { name: "View Morning tide, 1 of 3" }));
    const viewer = screen.getByRole("dialog");
    expect(within(viewer).getByText("1 of 3")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Next" }));
    expect(within(viewer).getByText("2 of 3")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Previous" }));
    fireEvent.click(within(viewer).getByRole("button", { name: "Previous" }));
    expect(within(viewer).getByText("3 of 3")).toBeInTheDocument();
  });

  it("moves with the arrow keys", () => {
    render(<ImageGallery items={ITEMS} label="Works" />);
    fireEvent.click(screen.getByRole("button", { name: "View Morning tide, 1 of 3" }));
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("shows no stepping controls for a single image", () => {
    render(<ImageGallery items={ITEMS.slice(0, 1)} label="Works" />);
    fireEvent.click(screen.getByRole("button", { name: "View Morning tide, 1 of 1" }));
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });
});
