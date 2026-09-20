/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaPlaceholder } from "./media-placeholder.js";

describe("MediaPlaceholder", () => {
  it("exposes hatch placeholder with uppercase label", () => {
    render(<MediaPlaceholder label="Artwork" aspect={[4, 5]} />);
    expect(screen.getByLabelText("Artwork placeholder")).toBeTruthy();
    expect(screen.getByText("Artwork")).toBeTruthy();
  });
});
