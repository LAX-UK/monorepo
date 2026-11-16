import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import { describe, expect, it } from "vitest";
import {
  fileTypeWord,
  inboundFileItems,
  replyMatchDetail,
  replyThreadItems,
} from "./enquiry-replies";

const reply = {
  id: "r1",
  receivedAt: "2026-11-03T08:40:00.000Z",
  subject: "Re: E-1042",
  body: "Tuesday works.",
  attachments: [
    { name: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
    { name: "report.pdf", contentType: "application/pdf", sizeBytes: 3_500_000 },
  ],
  matchedBy: "token" as const,
  spfResult: "pass" as const,
  dkimResult: "none" as const,
};

describe("replyThreadItems", () => {
  it("makes each reply a client message via email, with named files and no attachments to open", () => {
    const [item] = replyThreadItems(
      { name: "Daniel Price", replies: [reply] } as unknown as EnquiryView,
      new Date("2026-11-03T12:00:00.000Z"),
    );
    expect(item).toMatchObject({
      type: "message",
      id: "reply-r1",
      author: { name: "Daniel Price", initials: "DP", side: "client", role: "Client" },
      channel: "via email",
      body: "Tuesday works.",
      attachments: [],
    });
    if (item?.type !== "message") throw new Error("not a message");
    expect(item.files?.map((file) => [file.name, file.detail, file.kind])).toEqual([
      ["photo.jpg", "JPEG image · 2 KB", "image"],
      ["report.pdf", "PDF · 3.3 MB", "document"],
    ]);
  });
});

describe("file words", () => {
  it("names common types and falls back to the subtype", () => {
    expect(fileTypeWord("image/png")).toBe("PNG image");
    expect(fileTypeWord("image/tiff")).toBe("Image");
    expect(fileTypeWord("application/zip")).toBe("ZIP file");
    expect(fileTypeWord("")).toBe("File");
  });

  it("leaves out an unknown size", () => {
    expect(
      inboundFileItems([{ name: "a", contentType: "text/plain", sizeBytes: 0 }], "x")[0]?.detail,
    ).toBe("Text file");
  });

  it("says how a reply joined the thread", () => {
    expect(replyMatchDetail({ ...reply, matchedBy: "staff" })).toBe(
      "Attached by staff from held email",
    );
  });
});
