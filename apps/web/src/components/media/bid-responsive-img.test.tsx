import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const report = vi.fn();
vi.mock("@/lib/observability/report-image-fallback", () => ({
  reportImageFallback: (src: string) => report(src),
}));

import { BidResponsiveImg } from "./bid-responsive-img";

describe("BidResponsiveImg", () => {
  beforeEach(() => report.mockClear());

  it("falls back to the original and reports it once when the resized files fail", () => {
    render(<BidResponsiveImg src="/media/a.jpg" srcSet="/r/a-320.jpg 320w" alt="Harbour" />);
    const img = screen.getByAltText("Harbour");
    fireEvent.error(img);
    expect(img.getAttribute("srcset")).toBeNull();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("/media/a.jpg");
  });
});
