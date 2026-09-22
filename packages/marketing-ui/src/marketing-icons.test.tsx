/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MarketingCarouselNextIcon,
  MarketingSearchIcon,
  MarketingViewAllChevron,
} from "./marketing-icons.js";

describe("marketing icons", () => {
  it("renders lucide SVG chrome for shared marketing actions", () => {
    const { container: viewAll } = render(<MarketingViewAllChevron />);
    const { container: carousel } = render(<MarketingCarouselNextIcon />);
    const { container: search } = render(<MarketingSearchIcon />);

    expect(viewAll.querySelector("svg.lucide-chevron-right")).toBeTruthy();
    expect(carousel.querySelector("svg.lucide-chevron-right")).toBeTruthy();
    expect(search.querySelector("svg.lucide-search")).toBeTruthy();
  });
});
