import { describe, expect, it } from "vitest";
import {
  type RichTextSpan,
  htmlToSpans,
  normalizeSpans,
  spansToHtml,
  spansToPlainText,
} from "./rich-text-model";

function read(html: string): RichTextSpan[] {
  const root = document.createElement("div");
  root.innerHTML = html;
  return htmlToSpans(root);
}

describe("normalizeSpans", () => {
  it("merges neighbours with the same format and drops empty runs", () => {
    expect(
      normalizeSpans([
        { text: "a", marks: ["bold"] },
        { text: "", marks: ["italic"] },
        { text: "b", marks: ["bold"] },
        { text: "c" },
      ]),
    ).toEqual([{ text: "ab", marks: ["bold"] }, { text: "c" }]);
  });

  it("orders marks and keeps a link only with an address", () => {
    expect(
      normalizeSpans([{ text: "x", marks: ["link", "italic", "bold"], href: " /a " }]),
    ).toEqual([{ text: "x", marks: ["bold", "italic", "link"], href: "/a" }]);
    expect(normalizeSpans([{ text: "x", marks: ["link"] }])).toEqual([{ text: "x" }]);
  });

  it("is one empty run for an empty paragraph", () => {
    expect(normalizeSpans([])).toEqual([{ text: "" }]);
    expect(normalizeSpans([{ text: "" }])).toEqual([{ text: "" }]);
  });
});

describe("spans and html", () => {
  const cases: Array<[string, RichTextSpan[]]> = [
    ["plain text", [{ text: "Plain" }]],
    ["bold and italic", [{ text: "a " }, { text: "b", marks: ["bold", "italic"] }, { text: " c" }]],
    [
      "a link with formatting",
      [
        { text: "See " },
        { text: "our ", marks: ["link"], href: "/visit" },
        { text: "guide", marks: ["bold", "link"], href: "/visit" },
      ],
    ],
    ["a line break", [{ text: "one\ntwo" }]],
    ["a trailing line break", [{ text: "one\n" }]],
    ["characters that need escaping", [{ text: "a < b & c > d", marks: ["italic"] }]],
    ["an address with quotes", [{ text: "q", marks: ["link"], href: 'https://x.test/?a="b"&c=d' }]],
  ];

  it.each(cases)("round-trips %s", (_name, spans) => {
    expect(read(spansToHtml(spans))).toEqual(normalizeSpans(spans));
  });

  it("writes plain text from the runs", () => {
    expect(spansToPlainText([{ text: "a" }, { text: "b", marks: ["bold"] }])).toBe("ab");
  });
});

describe("htmlToSpans", () => {
  it("reads b, strong, i, em and a", () => {
    expect(read('<b>x</b><i>y</i><strong>z</strong><em>w</em><a href="/p">l</a>')).toEqual([
      { text: "x", marks: ["bold"] },
      { text: "y", marks: ["italic"] },
      { text: "z", marks: ["bold"] },
      { text: "w", marks: ["italic"] },
      { text: "l", marks: ["link"], href: "/p" },
    ]);
  });

  it("keeps the text and drops styling it cannot store", () => {
    expect(read('<span style="color:red">red</span> <u>under</u>')).toEqual([
      { text: "red under" },
    ]);
  });

  it("does not count the browser's trailing placeholder break as text", () => {
    expect(read("a<br>")).toEqual([{ text: "a" }]);
    expect(read("a<br><br>")).toEqual([{ text: "a\n" }]);
    expect(read("<br>")).toEqual([{ text: "" }]);
  });

  it("starts a new line for a block the browser inserted", () => {
    expect(read("one<div>two</div>")).toEqual([{ text: "one\ntwo" }]);
  });

  it("treats a link without an address as plain text", () => {
    expect(read("<a>x</a>")).toEqual([{ text: "x" }]);
  });
});
