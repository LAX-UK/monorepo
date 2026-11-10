// The device is in London; the moment is read against a chosen zone.
process.env.TZ = "Europe/London";

import { describeMoment } from "@auction/datetime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlainLocalTime } from "./plain-local-time.js";

const CLOSE = new Date("2026-11-12T18:00:00Z");
const moment = (zone: string) =>
  describeMoment(CLOSE, { officialZone: "Europe/London", viewerZone: zone, now: CLOSE });

describe("PlainLocalTime", () => {
  it("keeps the full line as its title and in the text, so a cut-off cell loses nothing", () => {
    const { container } = render(<PlainLocalTime moment={moment("Australia/Sydney")} />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("title", "Fri 13 Nov, 05:00 in Sydney");
    expect(root).toHaveTextContent("Your time: Fri 13 Nov, 05:00 in Sydney");
    expect(screen.getByText("Fri 13 Nov").closest("time")).toHaveTextContent(
      "Fri 13 Nov, 05:00 in Sydney",
    );
  });

  it("titles a same-day line with its time and city", () => {
    const { container } = render(<PlainLocalTime moment={moment("Africa/Cairo")} />);
    expect(container.firstElementChild).toHaveAttribute("title", "20:00 in Cairo");
  });

  it("draws nothing when the visitor's clock reads the same", () => {
    const { container } = render(<PlainLocalTime moment={moment("Europe/London")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
