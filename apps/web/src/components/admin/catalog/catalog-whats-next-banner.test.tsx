import { LotContextRail } from "@/components/admin/lot-detail/lot-context-rail";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogPostCreateSessionProvider } from "./catalog-post-create-session";
import { CatalogWhatsNextBanner } from "./catalog-whats-next-banner";

const replace = vi.fn();
const readiness = {
  items: [{ id: "images", label: "Images", ok: false, severity: "required" as const }],
  completeCount: 0,
  totalCount: 1,
  percent: 0,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("created=1"),
}));

const auction = {
  id: "lot-1",
  title: "Test lot",
  status: "draft",
  currentPrice: 0,
  images: [],
  updatedAt: new Date(),
} as unknown as Lot;

const context: LotDetailContext = {
  sale: null,
  parentSaleLotCount: null,
  artist: null,
  seller: null,
  categories: [],
};

function PostCreateFixture() {
  return (
    <CatalogPostCreateSessionProvider>
      <CatalogWhatsNextBanner
        entityLabel="lot"
        readiness={readiness}
        dismissKey="lot-1-readiness"
      />
      <LotContextRail
        lotId="lot-1"
        auction={auction}
        context={context}
        bidCount={0}
        publishReadiness={readiness}
      />
    </CatalogPostCreateSessionProvider>
  );
}

describe("CatalogWhatsNextBanner", () => {
  it("stays visible after URL param is stripped", () => {
    render(
      <CatalogPostCreateSessionProvider>
        <CatalogWhatsNextBanner
          entityLabel="lot"
          readiness={readiness}
          dismissKey="lot-1-readiness"
        />
      </CatalogPostCreateSessionProvider>,
    );

    expect(screen.getByText(/Your lot draft is saved/i)).toBeInTheDocument();
    expect(replace).toHaveBeenCalled();
    expect(screen.getByText(/Your lot draft is saved/i)).toBeInTheDocument();
  });
});

describe("Post-create readiness coordination", () => {
  it("hides rail readiness while post-create banner is active", () => {
    render(<PostCreateFixture />);

    expect(screen.getByText(/Your lot draft is saved/i)).toBeInTheDocument();
    expect(screen.queryByText("Catalog readiness")).not.toBeInTheDocument();
  });
});
