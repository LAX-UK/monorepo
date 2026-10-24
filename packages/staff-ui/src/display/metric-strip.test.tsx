import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlainLink } from "../shell/link.js";
import { AttentionStrip } from "./attention-strip.js";
import { MetricStrip } from "./metric-strip.js";

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
            comparison: { text: "12% vs previous 30 days", direction: "up", tone: "positive" },
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
    expect(within(strip).getByRole("link", { name: "£12,400.00" })).toHaveAttribute(
      "href",
      "/payments",
    );
    // The arrow is spoken as a word, so the comparison never relies on colour.
    expect(within(strip).getByText(/Up:/)).toHaveClass("sr-only");
  });

  it("holds the strip's shape with placeholders while loading", () => {
    render(
      <MetricStrip label="Summary" period="Last 7 days" items={[]} loading placeholders={3} />,
    );
    const strip = screen.getByRole("region", { name: "Summary" });
    expect(strip).toHaveAttribute("aria-busy", "true");
    expect(within(strip).queryAllByRole("term")).toHaveLength(0);
    expect(strip.querySelectorAll("dl > div")).toHaveLength(3);
  });

  it("renders nothing without metrics", () => {
    const { container } = render(<MetricStrip label="Summary" period="Today" items={[]} />);
    expect(container).toBeEmptyDOMElement();
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
