import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiTile } from "./kpi-tile.js";

describe("KpiTile", () => {
  it("uses full-height layout with reserved footer space for equal row tiles", () => {
    const { container } = render(
      <KpiTile label="New clients" value="12" compareHint="vs 7 days ago" />,
    );

    const root = container.firstElementChild;
    expect(root?.className).toMatch(/h-full/);
    expect(root?.className).toMatch(/min-h-\[8\.5rem\]/);
    expect(container.querySelector(".min-h-\\[2\\.75rem\\]")).not.toBeNull();
    expect(container.querySelector(".h-7.w-\\[72px\\]")).toBeNull();
  });

  it("truncates long currency values and exposes full amount in title", () => {
    render(
      <div className="w-40">
        <KpiTile label="Portfolio value" value="£123,456.78" delta="Win rate 45%" />
      </div>,
    );

    const value = screen.getByTitle("£123,456.78");
    expect(value.className).toMatch(/truncate/);
    expect(value.className).toMatch(/text-xl/);
  });
});
