import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PressCoverageCardMedia } from "./press-coverage-card-media";

describe("PressCoverageCardMedia", () => {
  it("renders a mention-type placeholder when no imageUrl is provided", () => {
    render(
      <PressCoverageCardMedia
        imageUrl={null}
        mentionType="quote"
        outletName="Art Daily"
        headline="Record results"
      />,
    );

    expect(screen.getByRole("img", { name: /Art Daily press coverage placeholder/i })).toBeTruthy();
  });

  it("falls back to placeholder when the remote image fails", async () => {
    const { container } = render(
      <PressCoverageCardMedia
        imageUrl="https://cdn.example.com/broken.jpg"
        mentionType="feature"
        outletName="Press"
        headline="Story"
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    img?.dispatchEvent(new Event("error"));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /Press press coverage placeholder/i })).toBeTruthy();
    });
  });
});
