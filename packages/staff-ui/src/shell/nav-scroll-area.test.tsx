import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavScrollArea, scrollEdges } from "./nav-scroll-area.js";

describe("scrollEdges", () => {
  it("shows nothing when everything fits", () => {
    expect(scrollEdges({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 })).toEqual({
      top: false,
      bottom: false,
    });
  });

  it("marks the bottom while more pages wait below", () => {
    expect(scrollEdges({ scrollTop: 0, scrollHeight: 900, clientHeight: 400 })).toEqual({
      top: false,
      bottom: true,
    });
  });

  it("marks both edges mid-scroll and only the top at the end", () => {
    expect(scrollEdges({ scrollTop: 200, scrollHeight: 900, clientHeight: 400 })).toEqual({
      top: true,
      bottom: true,
    });
    expect(scrollEdges({ scrollTop: 500, scrollHeight: 900, clientHeight: 400 })).toEqual({
      top: true,
      bottom: false,
    });
  });
});

describe("NavScrollArea", () => {
  it("renders its children with decorative fades hidden from assistive tech", () => {
    const { container, getByText } = render(
      <NavScrollArea>
        <a href="/x">Orders</a>
      </NavScrollArea>,
    );
    expect(getByText("Orders")).toBeInTheDocument();
    const fades = container.querySelectorAll("[data-fade]");
    expect(fades).toHaveLength(2);
    for (const fade of fades) {
      expect(fade).toHaveAttribute("aria-hidden", "true");
      expect(fade.className).toContain("pointer-events-none");
    }
  });
});
