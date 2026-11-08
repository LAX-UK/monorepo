// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type {
  AdminRegisterAllItem,
  AdminRegisterAllList,
  AdminRegisterConflictList,
} from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/server/application/admin-offer-on-lax-art-actions.server", () => ({
  getLaxArtOfferAssessment: vi.fn(),
  offerOnLaxArt: vi.fn(),
}));
vi.mock("@/server/application/admin-inventory-actions.server", () => ({
  getAuctionOfferAssessment: vi.fn(),
  listAuctionSales: vi.fn(),
  offerAtAuction: vi.fn(),
}));
vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  searchArtistOptions: async () => [],
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { AllFromZohoList } = await import("./all-from-zoho-list.client");
const { NeedsDecisionList } = await import("./from-zoho-list.client");

const ZOHO_URL = "https://crm.example/{module}/{recordId}";
const EDITOR = ["artwork_register.read", "artwork_register.review", "catalogue.write"];

const CHIPS = {
  not_offered: { label: "Not offered", tone: "neutral", marker: "hollow" },
  draft_lax_art: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
  sold: { label: "Sold", tone: "neutral", marker: "check" },
} as const;

function item(
  n: number,
  key: keyof typeof CHIPS,
  patch: Partial<AdminRegisterAllItem> = {},
): AdminRegisterAllItem {
  return {
    registerId: `00000000-0000-4000-8000-00000000000${n}`,
    zohoProductId: `900${n}`,
    title: `Work ${n}`,
    artistName: "Ada Rowe",
    artistCode: "AR",
    stockCode: `LAX-ORI-AR-TM-26-000${n}`,
    kind: "original",
    missing: [],
    zohoModifiedAt: "2026-11-04T09:40:00.000Z",
    whereItIs: { key, chip: CHIPS[key] },
    ...patch,
  };
}

const PLACES = [
  { value: "not_offered", label: "Not offered", count: 1 },
  { value: "draft_lax_art", label: "Draft on lax.art", count: 1 },
  { value: "sold", label: "Sold", count: 1 },
] as const;

function page(items: AdminRegisterAllItem[]): AdminRegisterAllList {
  return {
    items,
    artists: [{ code: "AR", name: "Ada Rowe", count: items.length }],
    places: PLACES.map((place) => ({ ...place })),
    total: items.length,
    page: 1,
    pageSize: 25,
    counts: { new: 4, decisions: 2 },
  };
}

function inShell(node: React.ReactNode, capabilities: string[] = EDITOR) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Catalogue editor")}>
        {node}
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const rowOf = (title: string) => {
  const row = screen
    .getAllByText(title)
    .map((match) => match.closest("tr"))
    .find((candidate) => candidate !== null);
  if (!row) throw new Error(`no row for ${title}`);
  return within(row);
};

describe("AllFromZohoList", () => {
  const rows = [item(1, "not_offered"), item(2, "draft_lax_art"), item(3, "sold")];

  it("shows where each artwork is, with the tab strip and its counts", () => {
    inShell(
      <AllFromZohoList query={{ tab: "all" }} page={page(rows)} zohoUrlTemplate={ZOHO_URL} />,
    );
    expect(screen.getByRole("link", { name: "All artworks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(rowOf("Work 1").getByText("Not offered")).toBeInTheDocument();
    expect(rowOf("Work 2").getByText("Draft on lax.art")).toBeInTheDocument();
    expect(rowOf("Work 3").getByText("Sold")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Where it is" })).toBeInTheDocument();
  });

  it("offers the artwork from its row only while it is not offered anywhere", () => {
    inShell(
      <AllFromZohoList query={{ tab: "all" }} page={page(rows)} zohoUrlTemplate={ZOHO_URL} />,
    );
    const free = rowOf("Work 1");
    expect(free.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(free.getByRole("menuitem", { name: "Offer on lax.art…" })).toBeInTheDocument();
    expect(free.getByRole("menuitem", { name: "Edit in Zoho" })).toBeInTheDocument();
    expect(free.getByRole("menuitem", { name: "Copy stock code" })).toBeInTheDocument();
    for (const title of ["Work 2", "Work 3"]) {
      const row = rowOf(title);
      expect(row.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
      expect(row.queryByRole("menuitem", { name: "Offer on lax.art…" })).toBeNull();
      expect(row.queryByRole("menuitem", { name: "Offer at auction…" })).toBeNull();
    }
  });

  it("never offers a print, and hides the offers from a person who cannot make them", () => {
    const { unmount } = inShell(
      <AllFromZohoList
        query={{ tab: "all" }}
        page={page([item(1, "not_offered", { kind: "print" })])}
        zohoUrlTemplate={ZOHO_URL}
      />,
    );
    expect(rowOf("Work 1").queryByRole("menuitem", { name: /^Offer/ })).toBeNull();
    unmount();
    inShell(
      <AllFromZohoList query={{ tab: "all" }} page={page(rows)} zohoUrlTemplate={ZOHO_URL} />,
      ["artwork_register.read"],
    );
    expect(rowOf("Work 1").queryByRole("menuitem", { name: /^Offer/ })).toBeNull();
  });

  it("shows the place filter as a removable chip", () => {
    inShell(
      <AllFromZohoList
        query={{ tab: "all", place: "sold" }}
        page={page([item(3, "sold")])}
        zohoUrlTemplate={ZOHO_URL}
      />,
    );
    const applied = within(screen.getByRole("list", { name: "Applied filters" }));
    expect(applied.getByText("Where it is: Sold")).toBeInTheDocument();
  });

  it("says nothing matches, and offers to clear, when a filter finds nothing", () => {
    inShell(<AllFromZohoList query={{ tab: "all", place: "sold" }} page={page([])} />);
    expect(screen.getByText("No artworks match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("explains an empty register", () => {
    inShell(<AllFromZohoList query={{ tab: "all" }} page={page([])} />);
    expect(screen.getByText("No artworks from Zoho yet")).toBeInTheDocument();
  });
});

describe("NeedsDecisionList rows", () => {
  it("gives each row the shared menu without any offer", () => {
    const conflicts: AdminRegisterConflictList = {
      items: [
        {
          artwork: item(1, "not_offered"),
          conflict: {
            conflictId: "c0000000-0000-4000-8000-000000000001",
            field: "offerState",
            zohoValue: "sold",
            laxValue: "lax_art",
            canAcceptZoho: false,
            status: "open",
            resolution: null,
            resolvedAt: null,
            zohoModifiedAt: "2026-11-04T09:40:00.000Z",
            detectedAt: "2026-11-04T10:00:00.000Z",
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      counts: { new: 4, decisions: 1 },
    };
    inShell(
      <NeedsDecisionList
        query={{ tab: "decisions" }}
        page={conflicts}
        zohoUrlTemplate={ZOHO_URL}
      />,
    );
    const row = rowOf("Work 1");
    expect(row.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(row.getByRole("menuitem", { name: "Edit in Zoho" })).toBeInTheDocument();
    expect(row.getByRole("menuitem", { name: "Copy stock code" })).toBeInTheDocument();
    expect(row.queryByRole("menuitem", { name: /^Offer/ })).toBeNull();
  });
});
