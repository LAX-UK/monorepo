import { ViewerZoneProvider } from "@auction/ui/time";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LotFact } from "./lot-fact";

const CLOSE = "2026-11-12T18:00:00Z";

function withZone(zone: string | null) {
  document.cookie = "lax_tz=; max-age=0; path=/";
  if (zone) document.cookie = `lax_tz=${encodeURIComponent(`fixed:${zone}`)}; path=/`;
}

afterEach(() => withZone(null));

describe("LotFact with a moment", () => {
  it("keeps the official line and adds the visitor's time under it", () => {
    withZone("Africa/Cairo");
    render(
      <ViewerZoneProvider initial={null}>
        <dl>
          <LotFact
            label="Time left"
            value="2d 04h"
            sub="Closes Thu 12 Nov, 18:00 GMT"
            tone="calm"
            clock
            moment={{ iso: CLOSE, zone: "Europe/London" }}
          />
        </dl>
      </ViewerZoneProvider>,
    );
    const official = screen.getByText("Closes Thu 12 Nov, 18:00 GMT");
    expect(official.tagName).toBe("TIME");
    expect(official).toHaveAttribute("datetime", CLOSE);
    expect(screen.getByRole("button")).toHaveTextContent("20:00 in Cairo");
  });

  it("stays neutral in the final hour", () => {
    withZone("Africa/Cairo");
    render(
      <ViewerZoneProvider initial={null}>
        <dl>
          <LotFact
            label="Final minutes"
            value="04m 12s"
            sub="Closes today, 18:00 GMT"
            tone="final"
            clock
            moment={{ iso: CLOSE, zone: "Europe/London" }}
          />
        </dl>
      </ViewerZoneProvider>,
    );
    expect(screen.getByRole("button").className).not.toContain("text-lax-danger");
  });

  it("is today's row without a moment", () => {
    render(
      <LotFact label="Time left" value="2d" sub="Closes Thu 12 Nov, 18:00 GMT" tone="calm" clock />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Closes Thu 12 Nov, 18:00 GMT").tagName).toBe("DD");
  });
});
