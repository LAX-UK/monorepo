import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const vars = {
  userName: "Wendy",
  lotTitle: "Red chair, evening",
  lotUrl: "https://lax.bid/lots/red-chair",
  unsubscribeUrl: "https://lax.bid/unsubscribe?t=x",
  kind: "hour_before_close" as const,
  note: "Check the frame",
  closesAt: "26 Nov 2026, 18:00",
};

describe("watched-lot-reminder", () => {
  it("says when, with the person's note and the close, and a way to turn it off", async () => {
    const rendered = await renderEmail("watched-lot-reminder", vars);
    expect(rendered.subject).toBe("Red chair, evening closes soon");
    expect(rendered.text).toContain("It closes in about an hour.");
    expect(rendered.text).toContain("Check the frame");
    expect(rendered.text).toContain("26 Nov 2026, 18:00");
    expect(rendered.html).toContain("https://lax.bid/lots/red-chair");
    expect(rendered.html).toContain("https://lax.bid/unsubscribe?t=x");
  });

  it("words a sale-start reminder, and leaves out a note not given", async () => {
    const rendered = await renderEmail("watched-lot-reminder", {
      ...vars,
      kind: "sale_start",
      note: null,
    });
    expect(rendered.subject).toBe("Bidding has opened on Red chair, evening");
    expect(rendered.text).not.toContain("Your note");
  });
});
