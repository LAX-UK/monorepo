import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BidCloseCountdown } from "./bid-close-countdown";

describe("BidCloseCountdown", () => {
  it("shows the closing time, never a bare placeholder, before the clock starts", () => {
    const html = renderToString(<BidCloseCountdown endsAt="2026-11-01T12:00:00.000Z" />);
    expect(html).toContain("1 Nov, 12:00");
    expect(html).toContain('dateTime="2026-11-01T12:00:00.000Z"');
    expect(html).not.toContain("…");
  });

  it("renders nothing for a missing closing time", () => {
    expect(renderToString(<BidCloseCountdown endsAt="not a date" />)).toBe("");
  });
});
