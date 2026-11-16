import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import { describe, expect, it } from "vitest";
import {
  attachedProvenance,
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
  heldReason: null,
  reviewReason: null,
  senderVerified: true,
  fromOtherAddress: false,
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

  it("says how a reply joined the thread, and when its sender is not verified", () => {
    expect(replyMatchDetail({ ...reply, matchedBy: "staff" })).toBe(
      "Attached by staff from held email",
    );
    expect(replyMatchDetail({ ...reply, matchedBy: "staff", senderVerified: false })).toBe(
      "Attached by staff from held email · Sender not verified",
    );
  });
});

describe("attachedProvenance", () => {
  it("labels nothing on a reply that joined the thread on its own", () => {
    expect(attachedProvenance(reply)).toBeNull();
  });

  it("warns on held email attached from another sender, with why it was held and the reason", () => {
    expect(
      attachedProvenance({
        ...reply,
        matchedBy: "staff",
        heldReason: "sender_mismatch",
        reviewReason: "Confirmed by phone",
        senderVerified: false,
        fromOtherAddress: true,
        spfResult: "pass",
        dkimResult: null,
      }),
    ).toEqual({
      label: "Attached by staff · Sender not verified",
      tone: "warning",
      details: [
        "Held because: Different sender",
        "Sent from an address other than the client's.",
        "Sender checks: SPF passed, DKIM not recorded.",
        "Reason given: Confirmed by phone",
      ],
    });
  });

  it("is a quiet label for held email from the client's own verified address", () => {
    const item = replyThreadItems(
      {
        name: "Daniel Price",
        replies: [
          {
            ...reply,
            matchedBy: "staff",
            heldReason: "unmatched",
            reviewReason: "Quoted the reference",
          },
        ],
      } as unknown as EnquiryView,
      new Date("2026-11-03T12:00:00.000Z"),
    )[0];
    expect(item).toMatchObject({
      provenance: {
        label: "Attached by staff",
        tone: "neutral",
        details: ["Held because: No enquiry found", "Reason given: Quoted the reference"],
      },
    });
  });
});
