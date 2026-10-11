import type { PortalEnquiry } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildPortalEnquiryRowViewModel } from "./portal-enquiry.vm.js";

const sample: PortalEnquiry = {
  enquiryId: "00000000-0000-4000-8000-000000000001",
  artworkId: "00000000-0000-4000-8000-000000000002",
  artworkSlug: "test-work",
  artworkTitle: "Test Work",
  salesChannel: "art",
  intent: "enquiry",
  status: "open",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("buildPortalEnquiryRowViewModel", () => {
  it("maps enquiry fields to row labels", () => {
    const row = buildPortalEnquiryRowViewModel(sample);
    expect(row.artworkHref).toBe("/artworks/test-work");
    expect(row.channelLabel).toBe("art");
    expect(row.statusLabel).toBe("open");
    expect(row.createdAtIso).toBe("2026-01-01T00:00:00.000Z");
    expect(row.createdAtLabel).toBe("1 Jan 2026");
  });

  it("keeps unparseable timestamps verbatim", () => {
    expect(buildPortalEnquiryRowViewModel({ ...sample, createdAt: "unknown" }).createdAtLabel).toBe(
      "unknown",
    );
  });
});
