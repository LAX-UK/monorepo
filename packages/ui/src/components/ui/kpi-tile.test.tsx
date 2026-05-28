import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiTile } from "./kpi-tile.js";

describe("KpiTile", () => {
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
