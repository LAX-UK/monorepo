import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordThumbnail } from "./record-thumbnail.js";

describe("RecordThumbnail", () => {
  it("shows the picture when there is one", () => {
    const { container } = render(<RecordThumbnail src="/a.jpg" title="Thames at low tide" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/a.jpg");
  });

  it("uses the hatched placeholder without a picture", () => {
    render(<RecordThumbnail src={null} title="Thames at low tide" />);
    expect(screen.getByRole("img", { name: "Thames at low tide placeholder" })).toBeTruthy();
  });

  it("falls back to the placeholder when the picture cannot load", () => {
    const { container } = render(<RecordThumbnail src="/gone.jpg" title="Thames" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(screen.getByRole("img", { name: "Thames placeholder" })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
