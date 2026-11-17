import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline.js";

describe("Timeline", () => {
  it("says a step's time is not recorded instead of showing one", () => {
    render(
      <Timeline
        label="Activity"
        events={[
          { id: "a", title: "Handed to the courier", at: null, noTime: "Time not recorded" },
          { id: "b", title: "Buyer accepted the quote", at: "2026-11-15T12:30:00.000Z" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Time not recorded");
    expect(items[0]?.querySelector("time")).toBeNull();
    expect(items[1]?.querySelector("time")).toHaveAttribute("datetime", "2026-11-15T12:30:00.000Z");
  });
});
