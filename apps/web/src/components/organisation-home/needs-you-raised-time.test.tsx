import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NeedsYouRaisedTime } from "./needs-you-raised-time";

describe("NeedsYouRaisedTime", () => {
  it("shows the time with tabular numerals and its machine-readable date", () => {
    render(
      <NeedsYouRaisedTime raised={{ text: "3 hours ago", dateTime: "2026-10-30T06:00:00.000Z" }} />,
    );
    const time = screen.getByText("3 hours ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-30T06:00:00.000Z");
    expect(time).toHaveClass("tabular-nums");
  });

  it("shows nothing when the task has no time", () => {
    const { container } = render(<NeedsYouRaisedTime raised={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
