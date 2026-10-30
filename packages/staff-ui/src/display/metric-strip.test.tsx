import { PlainLink, Sparkline, metricChange, sparklinePoints } from "@auction/ui/lax";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttentionStrip } from "./attention-strip.js";
import { MetricStrip } from "./metric-strip.js";
import { StatGrid } from "./stat-grid.js";

describe("MetricStrip", () => {
  it("shows at most four metrics in one surface, with the period stated", () => {
    render(
      <MetricStrip
        label="Payments summary"
        period="Matching the current filters"
        Link={PlainLink}
        items={[
          { id: "a", label: "Volume", value: "£12,400.00", href: "/payments" },
          { id: "b", label: "Awaiting capture", value: "£0.00" },
          {
            id: "c",
            label: "Settled",
            value: "£9,100.00",
            comparison: {
              text: "12%",
              direction: "up",
              tone: "positive",
              basis: "vs previous 30 days",
            },
          },
          { id: "d", label: "Refunded", value: "£300.00" },
          { id: "e", label: "Fifth", value: "never shown" },
        ]}
      />,
    );
    const strip = screen.getByRole("region", { name: "Payments summary" });
    expect(within(strip).getByText("Matching the current filters")).toBeInTheDocument();
    expect(within(strip).getAllByRole("term")).toHaveLength(4);
    expect(within(strip).queryByText("never shown")).not.toBeInTheDocument();
    // The whole cell is the link, named by its label and value.
    expect(within(strip).getByRole("link", { name: "Volume: £12,400.00" })).toHaveAttribute(
      "href",
      "/payments",
    );
    // The arrow is spoken as a word with what it compares, so the change never relies on colour.
    expect(within(strip).getByText("Up 12% vs previous 30 days")).toHaveClass("sr-only");
  });

  it("draws the trend only where there is one, coloured by the metric's tone", () => {
    const { container } = render(
      <MetricStrip
        label="Lots summary"
        period="All lots"
        items={[
          { id: "a", label: "Ending", value: "7", tone: "attention", trend: [1, 3, 2, 5] },
          { id: "b", label: "Drafts", value: "18" },
          { id: "c", label: "Hammer", value: null, trend: [1, 2, 3] },
        ]}
      />,
    );
    const cells = container.querySelectorAll("[data-metric-cell]");
    expect(cells[0]?.querySelectorAll("svg[data-tone='attention']").length).toBeGreaterThan(0);
    expect(cells[1]?.querySelector("svg")).toBeNull();
    // A missing number shows a dash and no chart.
    expect(cells[2]).toHaveTextContent("—No data");
    expect(cells[2]?.querySelector("svg")).toBeNull();
  });

  it("holds the strip's shape with placeholders while loading", () => {
    render(
      <MetricStrip label="Summary" period="Last 7 days" items={[]} loading placeholders={3} />,
    );
    const strip = screen.getByRole("region", { name: "Summary" });
    expect(strip).toHaveAttribute("aria-busy", "true");
    expect(within(strip).queryAllByRole("term")).toHaveLength(0);
    expect(strip.querySelectorAll("[data-metric-cell]")).toHaveLength(3);
  });

  it("renders nothing without metrics", () => {
    const { container } = render(<MetricStrip label="Summary" period="Today" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatGrid", () => {
  it("uses the metric cell, with the record's context line under the value", () => {
    render(
      <StatGrid
        label="Sale numbers"
        period="Daily activity over the last 30 days"
        items={[
          { id: "lots", label: "Lots", value: "48", hint: "44 published", trend: [1, 2] },
          { id: "revenue", label: "Expected revenue", value: null },
        ]}
      />,
    );
    const grid = screen.getByRole("region", { name: "Sale numbers" });
    expect(within(grid).getByText("Daily activity over the last 30 days")).toBeInTheDocument();
    expect(within(grid).getByText("44 published")).toBeInTheDocument();
    expect(within(grid).getByText("No data")).toHaveClass("sr-only");
  });
});

describe("Sparkline", () => {
  it("scales the series into the box with zero on the baseline", () => {
    const points = sparklinePoints([0, 5, 10], 80, 24);
    expect(points).toEqual([
      [3, 21],
      [40, 12],
      [77, 3],
    ]);
  });

  it("measures from zero, so a steady series sits at the top and no activity on the floor", () => {
    expect(sparklinePoints([4, 4], 80, 24).map(([, y]) => y)).toEqual([3, 3]);
    expect(sparklinePoints([0, 0], 80, 24).map(([, y]) => y)).toEqual([21, 21]);
  });

  it("draws nothing for fewer than two points", () => {
    const { container } = render(<Sparkline values={[3]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("metricChange", () => {
  it("states the change as a percentage, toned by whether a rise is good", () => {
    expect(metricChange({ current: 112, prior: 100, basis: "vs last week", rise: "good" })).toEqual(
      { text: "12%", direction: "up", tone: "positive", basis: "vs last week" },
    );
    expect(metricChange({ current: 112, prior: 100, basis: "vs last week", rise: "bad" })).toEqual({
      text: "12%",
      direction: "up",
      tone: "negative",
      basis: "vs last week",
    });
    expect(metricChange({ current: 80, prior: 100, basis: "vs last week" })).toMatchObject({
      text: "20%",
      direction: "down",
      tone: "neutral",
    });
    expect(metricChange({ current: 100.2, prior: 100, basis: "b", rise: "good" })).toMatchObject({
      text: "0%",
      direction: "flat",
      tone: "neutral",
    });
  });

  it("has no change to show when there is nothing before", () => {
    expect(metricChange({ current: 5, prior: 0, basis: "b" })).toBeUndefined();
  });
});

describe("AttentionStrip", () => {
  it("lists one line per waiting issue, linking to the filtered view, with no dismiss", () => {
    render(
      <AttentionStrip
        Link={PlainLink}
        items={[
          {
            id: "review",
            count: 10,
            label: "payments need manual review",
            href: "/payments?manualReview=1",
            tone: "warning",
          },
          { id: "none", count: 0, label: "disputes open", href: "/disputes" },
        ]}
      />,
    );
    const strip = screen.getByRole("region", { name: "Needs attention" });
    const links = within(strip).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("10 payments need manual reviewReview");
    expect(links[0]).toHaveAttribute("href", "/payments?manualReview=1");
    expect(within(strip).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when every issue is clear", () => {
    const { container } = render(
      <AttentionStrip Link={PlainLink} items={[{ id: "a", count: 0, label: "x", href: "/" }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
