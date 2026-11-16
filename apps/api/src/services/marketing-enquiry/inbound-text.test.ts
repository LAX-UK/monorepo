import { describe, expect, it } from "vitest";
import {
  messageIdsFromHeader,
  providerIdFromMessageId,
  sanitiseInboundLine,
  sanitiseInboundText,
  stripHtml,
} from "./inbound-text.js";

describe("sanitiseInboundText", () => {
  it("removes script, style and tags, keeping the visible text", () => {
    const text = sanitiseInboundText(
      '<html><head><style>p{}</style></head><body><p>Hello <b>there</b></p><script>alert(1)</script><a href="javascript:x()">link</a></body></html>',
      1000,
    );
    expect(text).not.toMatch(/[<>]|alert|javascript|p\{\}/);
    expect(text).toContain("Hello");
    expect(text).toContain("link");
  });

  it("does not let entities or nested tags rebuild markup", () => {
    const text = sanitiseInboundText(
      "&lt;script&gt;alert(1)&lt;/script&gt;<scr<script>ipt>x</scr</script>ipt>",
      1000,
    );
    expect(text).not.toMatch(/<[a-z/]/i);
  });

  it("removes control, bidi and zero-width characters and normalises newlines", () => {
    const text = sanitiseInboundText("a\u0000b‮c​d\r\n\r\n\r\n\r\ne", 100);
    expect(text).toBe("abcd\n\ne");
  });

  it("caps the length", () => {
    const text = sanitiseInboundText("x".repeat(500), 100);
    expect(text.length).toBeLessThanOrEqual(100);
    expect(text.endsWith("…")).toBe(true);
  });

  it("is empty for nothing", () => {
    expect(sanitiseInboundText(undefined, 10)).toBe("");
  });
});

describe("other helpers", () => {
  it("collapses a line and caps it", () => {
    expect(sanitiseInboundLine("Re:  Your\n enquiry <b>E-1</b>", 300)).toBe("Re: Your enquiry E-1");
    expect(sanitiseInboundLine("y".repeat(400), 300)).toHaveLength(300);
  });

  it("reads message ids from In-Reply-To and References", () => {
    expect(messageIdsFromHeader("<a@x.test> junk <b@y.test>")).toEqual(["a@x.test", "b@y.test"]);
    expect(messageIdsFromHeader(undefined)).toEqual([]);
    expect(providerIdFromMessageId("ABC-123@mtasv.net")).toBe("abc-123");
  });

  it("strips an unterminated tag", () => {
    expect(stripHtml("hi <img src=x onerror=")).not.toContain("<");
  });
});
