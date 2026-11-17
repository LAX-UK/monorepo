import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline.js";

describe("Timeline", () => {
  it("shows a step that keeps no time of its own without making one up", () => {
    render(
      <Timeline
        label="Delivery activity"
        events={[
          {
            id: "dispatched",
            title: "Handed to the courier",
            actor: "LAX",
            undated: "Time not recorded",
          },
          { id: "quoted", title: "LAX sent a quote", actor: "LAX", at: "2026-11-14T10:12:00.000Z" },
        ]}
      />,
    );
    const steps = screen.getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Handed to the courier");
    expect(steps[0]).toHaveTextContent("LAX · Time not recorded");
    expect(steps[0]?.querySelector("time")).toBeNull();
    expect(steps[1]?.querySelector("time")).toHaveAttribute("datetime", "2026-11-14T10:12:00.000Z");
    expect(steps[1]).toHaveTextContent("LAX ·");
  });
});
