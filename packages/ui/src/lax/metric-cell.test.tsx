import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCell, isLongMetricValue } from "./index.js";

const trend = [1, 2, 3, 4];

describe("MetricCell with a long value", () => {
  it("recognises values that would crowd a trend beside them", () => {
    expect(isLongMetricValue("£5,638,464,102.00")).toBe(true);
    expect(isLongMetricValue("£1,250.00")).toBe(false);
    expect(isLongMetricValue(null)).toBe(false);
  });

  it("keeps the whole figure and puts the trend under it", () => {
    const { container } = render(
      <MetricCell
        item={{ id: "hammer", label: "Total hammer value", value: "£5,638,464,102.00", trend }}
      />,
    );
    expect(container.textContent).toContain("£5,638,464,102.00");
    // Only the compact trend is drawn: the wide one would sit beside the value.
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("dl")?.className).not.toContain(
      "grid-cols-[minmax(0,1fr)_auto]",
    );
  });

  it("keeps a short value and its trend side by side", () => {
    const { container } = render(
      <MetricCell item={{ id: "lots", label: "Lots", value: "128", trend }} />,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(container.querySelector("dl")?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
  });
});
