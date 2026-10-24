import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MappedStatusBadge, defineStatusMap, humanizeStatus } from "./status-badge.js";

const present = defineStatusMap({
  paid: { label: "Paid", tone: "success" },
  live: { label: "Live", tone: "danger", live: true },
});

describe("defineStatusMap", () => {
  it("maps known statuses to their label and tone", () => {
    expect(present("paid")).toEqual({ label: "Paid", tone: "success" });
  });

  it("renders an unknown status by name in the neutral tone instead of failing", () => {
    expect(present("partially_refunded")).toEqual({ label: "Partially refunded", tone: "neutral" });
  });
});

describe("humanizeStatus", () => {
  it("reads machine names as sentence case", () => {
    expect(humanizeStatus("ready_for-collection")).toBe("Ready for collection");
  });
});

describe("MappedStatusBadge", () => {
  it("names the state in text, never by colour alone", () => {
    render(<MappedStatusBadge status="paid" present={present} />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});
