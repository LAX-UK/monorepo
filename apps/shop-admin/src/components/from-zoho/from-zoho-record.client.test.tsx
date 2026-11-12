// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assess = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho/x",
}));
vi.mock("@/server/application/admin-offer-on-lax-art-actions.server", () => ({
  getLaxArtOfferAssessment: (...args: unknown[]) => assess(...args),
  offerOnLaxArt: vi.fn(),
}));
const assessAuction = vi.fn();
const auctionSales = vi.fn();
vi.mock("@/server/application/admin-inventory-actions.server", () => ({
  getAuctionOfferAssessment: (...args: unknown[]) => assessAuction(...args),
  listAuctionSales: (...args: unknown[]) => auctionSales(...args),
  offerAtAuction: vi.fn(),
}));
vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  searchArtistOptions: async () => [],
}));
vi.mock("@/server/application/admin-register-actions.server", () => ({
  resolveRegisterConflict: vi.fn(),
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { FromZohoRecord } = await import("./from-zoho-record.client");

const NOT_OFFERED = {
  key: "not_offered",
  chip: { label: "Not offered", tone: "neutral", marker: "hollow" },
  from: null,
  since: null,
  bidLot: null,
} as const;

function detail(patch: Partial<AdminRegisterDetail> = {}): AdminRegisterDetail {
  return {
    registerId: "11111111-1111-4111-8111-111111111111",
    zohoProductId: "1023341000017963004",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    kind: "original",
    zohoModule: "Products",
    title: "Tidal margin IV",
    artistName: "Ada Rowe",
    artistCode: "AR",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageCount: 3,
    catalogueStatus: "Available",
    zohoPrice: null,
    offerState: "held",
    whereItIs: NOT_OFFERED,
    laxArt: null,
    offerBlockers: [],
    auctionBlockers: [],
    catalogueChanges: [],
    missing: [],
    zohoModifiedAt: "2026-11-04T09:40:00.000Z",
    createdAt: "2026-11-02T02:10:00.000Z",
    conflicts: [],
    events: [],
    ...patch,
  };
}

const EDITOR = [
  "artwork_register.read",
  "artwork_register.review",
  "catalogue.read",
  "catalogue.write",
];
const READ_ONLY = ["artwork_register.read", "catalogue.read"];

function show(
  record: AdminRegisterDetail,
  capabilities: string[] = EDITOR,
  bidAdminUrl: string | null = null,
) {
  const roleLabel = capabilities.includes("catalogue.write") ? "Catalogue editor" : "Read-only";
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, roleLabel)}>
        <FromZohoRecord
          detail={record}
          zohoUrl="https://crm.example/Products/1"
          bidAdminUrl={bidAdminUrl}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("FromZohoRecord: Zoho changed since it was listed", () => {
  it("shows the difference above Where it is, for each copy that no longer matches", () => {
    show(
      detail({
        catalogueChanges: [
          {
            copy: "bid_lot",
            state: "in_sale",
            comparison: [
              {
                field: "title",
                label: "Title",
                laxArtValue: "Tidal margin IV",
                zohoValue: "Tidal margin V",
                changes: true,
              },
            ],
            canUpdate: false,
            note: "This lot is in a sale that is live or coming up, so it is not changed from Zoho.",
          },
        ],
      }),
    );
    expect(screen.getByText("Zoho changed since it was listed: Bid lot")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update from Zoho/ })).not.toBeInTheDocument();
  });

  it("shows nothing extra when every copy matches", () => {
    show(detail());
    expect(screen.queryByText(/Zoho changed since it was listed/)).not.toBeInTheDocument();
  });
});

describe("FromZohoRecord offer on lax.art", () => {
  beforeEach(() => assess.mockReset());

  it("puts Where it is first and offers the artwork on lax.art from the header and the section", () => {
    show(detail());
    const where = screen.getByRole("region", { name: "Where it is" });
    // The badge and the line under it.
    expect(within(where).getAllByText("Not offered")).toHaveLength(2);
    expect(within(where).getByText(/Only one place at a time/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Offer on lax.art…" })).toHaveLength(2);
  });

  it("opens the dialog, which checks the record first", async () => {
    assess.mockResolvedValue({ ok: false, kind: "failed", message: "Could not check." });
    show(detail());
    fireEvent.click(screen.getAllByRole("button", { name: "Offer on lax.art…" })[0] as HTMLElement);
    expect(assess).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(await screen.findByText("Could not check this artwork")).toBeInTheDocument();
  });

  it("keeps the action but disables it, and says why, when Zoho or another place holds the artwork", () => {
    show(
      detail({
        offerBlockers: [
          {
            message:
              "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.",
            link: { label: "Edit in Zoho", target: "zoho_record" },
          },
        ],
      }),
    );
    for (const button of screen.getAllByRole("button", { name: "Offer on lax.art…" })) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByText("This artwork can't go on lax.art yet")).toBeInTheDocument();
    expect(screen.getByText(/shows this artwork as reserved/)).toBeInTheDocument();
  });

  it("opens the lax.art listing once there is one, instead of offering again", () => {
    show(
      detail({
        whereItIs: {
          key: "draft_lax_art",
          chip: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
          from: null,
          since: null,
          bidLot: null,
        },
        laxArt: {
          artworkId: "22222222-2222-4222-8222-222222222222",
          slug: "ada-rowe-tidal-margin-iv",
          published: false,
          createdAt: "2026-11-04T10:42:00.000Z",
        },
        offerBlockers: [],
      }),
    );
    expect(screen.queryByRole("button", { name: "Offer on lax.art…" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Open on lax.art" })) {
      expect(link).toHaveAttribute("href", "/artworks/22222222-2222-4222-8222-222222222222");
    }
    expect(screen.getByText(/· created /)).toBeInTheDocument();
    // The History card beside it already lists the moves.
    expect(screen.queryByText("Recent moves")).not.toBeInTheDocument();
  });

  it("draws no offer for a print, and says prints are sold in runs on LAX Shop", () => {
    show(
      detail({
        kind: "print",
        offerBlockers: [{ message: "Prints are sold in runs.", link: null }],
      }),
    );
    expect(screen.queryByRole("button", { name: /Offer on lax.art/ })).not.toBeInTheDocument();
    expect(screen.getByText("Prints are sold in runs")).toBeInTheDocument();
    expect(screen.getByText(/on LAX Shop/)).toBeInTheDocument();
  });

  it("leaves the action out for someone who cannot catalogue, and says the page is view only", () => {
    show(detail(), READ_ONLY);
    expect(screen.queryByRole("button", { name: /Offer on lax.art/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Where it is" })).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
  });
});

const DRAFT_LOT = {
  key: "draft_bid_lot",
  chip: { label: "Draft lot in LAX Bid", tone: "info", marker: "hollow" },
  from: null,
  since: null,
  bidLot: { lotId: "44444444-4444-4444-8444-444444444444", saleTitle: "Winter sale" },
} as const;

describe("FromZohoRecord offer at auction", () => {
  beforeEach(() => {
    assessAuction.mockReset();
    auctionSales.mockReset();
  });

  it("keeps Offer at auction in the more menu for people who can offer", () => {
    show(detail());
    expect(screen.getByRole("menuitem", { name: "Offer at auction…" })).toBeInTheDocument();
  });

  it("leaves it out for people who cannot offer", () => {
    show(detail(), READ_ONLY);
    expect(screen.queryByRole("menuitem", { name: "Offer at auction…" })).not.toBeInTheDocument();
  });

  it("leaves it out for a print", () => {
    show(detail({ kind: "print" }));
    expect(screen.queryByRole("menuitem", { name: "Offer at auction…" })).not.toBeInTheDocument();
  });

  it("disables it with the reasons when the artwork cannot be offered", () => {
    show(
      detail({
        auctionBlockers: [{ message: "Zoho shows this artwork as reserved.", link: null }],
      }),
    );
    const item = screen.getByRole("menuitem", { name: /Offer at auction/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("says a draft lot is where it is, names the sale, and makes the lot the next step", () => {
    show(detail({ whereItIs: DRAFT_LOT }), EDITOR, "https://bid.example/admin");
    const where = screen.getByRole("region", { name: "Where it is" });
    expect(within(where).getAllByText("Draft lot in LAX Bid")).toHaveLength(2);
    expect(within(where).getByText(/Winter sale/)).toBeInTheDocument();
    // In the header, as the primary action, and in the section.
    const links = screen.getAllByRole("link", { name: /Open lot in LAX Bid/ });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        "https://bid.example/admin/lots/44444444-4444-4444-8444-444444444444",
      );
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("shows no lot link to a person who cannot open Bid admin", () => {
    show(detail({ whereItIs: DRAFT_LOT }), EDITOR, null);
    expect(screen.queryByRole("link", { name: /Open lot in LAX Bid/ })).not.toBeInTheDocument();
  });

  it("shows the lot link to a read-only person who can open Bid admin", () => {
    show(detail({ whereItIs: DRAFT_LOT }), READ_ONLY, "https://bid.example/admin");
    expect(screen.getAllByRole("link", { name: /Open lot in LAX Bid/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Offer on lax.art…" })).not.toBeInTheDocument();
  });

  it("keeps the lax.art listing as the next step once there is one", () => {
    show(
      detail({
        whereItIs: DRAFT_LOT,
        laxArt: {
          artworkId: "22222222-2222-4222-8222-222222222222",
          slug: "s",
          published: false,
          createdAt: "2026-11-04T10:00:00.000Z",
        },
      }),
      EDITOR,
      "https://bid.example/admin",
    );
    expect(screen.getAllByRole("link", { name: "Open on lax.art" }).length).toBeGreaterThan(0);
  });
});
