// @vitest-environment jsdom
import type { AdminEnquiryListItem, AdminEnquiryListResponse } from "@auction/shop-contracts";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-enquiry-actions.server", () => ({ updateEnquiry: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/enquiries",
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

(await import("@/test/radix-stubs")).installLayoutStubs();
const { EnquiriesList } = await import("./enquiries-list.client");
const { StaffCatalogueImageProvider } = await import(
  "@/components/artworks/staff-catalogue-image-provider.client"
);
const { parseEnquiriesState } = await import("@/server/domain/enquiry-inbox.vm");

const enquiry = (n: number, thumbnailUrl: string): AdminEnquiryListItem => ({
  kind: "artwork",
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  topic: "artwork",
  status: "new",
  assignee: null,
  sender: { type: "guest", name: `Sender ${n}`, email: null },
  artwork: {
    id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    title: `Work ${n}`,
    slug: `work-${n}`,
    thumbnailUrl,
  },
  excerpt: "Is this still available?",
  version: "1",
  createdAt: "2026-10-01T10:00:00.000Z",
});

describe("EnquiriesList", () => {
  it("loads seed artwork pictures from the storefront that serves them", () => {
    const page: AdminEnquiryListResponse = {
      items: [
        enquiry(1, "/art/seed/hero-layer-3.webp"),
        enquiry(2, "https://cdn.example.test/work.jpg"),
      ],
      nextCursor: null,
      counts: { new: 2, in_progress: 0, closed: 0 },
    };
    const { container } = render(
      <StaffCatalogueImageProvider
        origins={{ shop: "https://test-shop.lax.bid", art: "https://test-art.lax.bid" }}
      >
        <EnquiriesList
          state={parseEnquiriesState({})}
          page={page}
          currentSubject="staff-1"
          canWrite
        />
      </StaffCatalogueImageProvider>,
    );
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toContain("https://test-art.lax.bid/art/seed/hero-layer-3.webp");
    expect(sources).toContain("https://cdn.example.test/work.jpg");
    expect(sources).not.toContain("/art/seed/hero-layer-3.webp");
  });
});
