import type { QuarantineListItem, QuarantineMessage } from "@/lib/data/http/admin-enquiries.schema";

/** Held email for tests and screenshots. Every address and name here is invented. */
export const heldItem = (patch: Partial<QuarantineListItem> = {}): QuarantineListItem => ({
  id: "0b4f8c1e-6a0a-4a53-9a2a-1c9f8f0e9a11",
  reason: "sender_mismatch",
  status: "pending",
  fromAddress: "assistant@northbank-gallery.example",
  subject: "Re: Your enquiry E-1042",
  attachmentCount: 1,
  suspectedEnquiry: { reference: "E-1042", intent: "private_sale_sell" },
  receivedAt: "2026-11-03T08:40:00.000Z",
  purgeAt: "2026-12-03T08:40:00.000Z",
  reviewedAt: null,
  ...patch,
});

export const heldMessage = (patch: Partial<QuarantineMessage> = {}): QuarantineMessage => ({
  ...heldItem(),
  body: "Forwarding on behalf of Daniel, who is travelling.\nHe can do Tuesday afternoon.",
  attachments: [{ name: "corner-detail.jpg", contentType: "image/jpeg", sizeBytes: 2_150_000 }],
  spfResult: "pass",
  dkimResult: "pass_unaligned",
  ...patch,
});

export const heldList: QuarantineListItem[] = [
  heldItem(),
  heldItem({
    id: "1c5a9d2f-6a0a-4a53-9a2a-1c9f8f0e9a12",
    reason: "unmatched",
    fromAddress: "studio@calder-archive.example",
    subject: "Question about a valuation",
    attachmentCount: 0,
    suspectedEnquiry: null,
    receivedAt: "2026-11-02T16:05:00.000Z",
    purgeAt: "2026-12-02T16:05:00.000Z",
  }),
  heldItem({
    id: "2d6b0e3a-6a0a-4a53-9a2a-1c9f8f0e9a13",
    reason: "auto_reply",
    fromAddress: "no-reply@mailer.example",
    subject: "Out of office",
    attachmentCount: 0,
    suspectedEnquiry: { reference: "E-1038", intent: "general" },
    receivedAt: "2026-11-02T09:12:00.000Z",
    purgeAt: "2026-12-02T09:12:00.000Z",
  }),
];
