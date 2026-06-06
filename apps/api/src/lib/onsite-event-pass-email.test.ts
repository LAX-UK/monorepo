import { describe, expect, it } from "vitest";
import {
  ONSITE_PASS_QR_CONTENT_ID,
  buildOnsiteEventPassEmailHtml,
} from "./onsite-event-pass-email.js";

describe("buildOnsiteEventPassEmailHtml", () => {
  it("references the inline QR attachment by CID instead of a data URI", () => {
    const html = buildOnsiteEventPassEmailHtml({
      userName: "Guest",
      eventTitle: "LAX 001",
      segmentLabel: "Full evening",
      plusOneLine: null,
      notesLine: null,
      passUrl: "https://event.lax.bid/pass/token",
      opsEmail: "events@lax.bid",
      arrivalNote: null,
      dressCode: null,
      kind: "confirmed",
    });

    expect(html).toContain(`src="cid:${ONSITE_PASS_QR_CONTENT_ID}"`);
    expect(html).not.toContain("data:image/png");
  });
});
