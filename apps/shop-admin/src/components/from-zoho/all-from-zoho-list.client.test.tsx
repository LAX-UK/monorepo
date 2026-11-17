// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type {
  AdminRegisterAllItem,
  AdminRegisterAllList,
  AdminRegisterConflictList,
} from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
const moveArtworksToLocation = vi.fn();
vi.mock("@/server/application/admin-stock-location-actions.server", () => ({
  moveArtworksToLocation: (...args: unknown[]) => moveArtworksToLocation(...args),
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
    zohoModule: "Products",
    title: `Work ${n}`,
    artistName: "Ada Rowe",
    artistCode: "AR",
    stockCode: `LAX-ORI-AR-TM-26-000${n}`,
    kind: "original",
    missing: [],
    zohoModifiedAt: "2026-11-04T09:40:00.000Z",
    whereItIs: { key, chip: CHIPS[key] },
    location: null,
    zohoPrice: null,
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

describe("AllFromZohoList Price in Zoho column", () => {
  const priced = [
    item(1, "not_offered", { zohoPrice: "4800.00" }),
    item(2, "not_offered"),
    item(3, "not_offered", { zohoPrice: "250.00" }),
  ];

  it("is hidden until it is chosen from Display", () => {
    window.localStorage.clear();
    inShell(<AllFromZohoList query={{ tab: "all" }} page={page(priced)} />);
    expect(screen.queryByRole("columnheader", { name: /Price in Zoho/ })).not.toBeInTheDocument();
  });

  it("shows the price or Not set in Zoho once shown, and sorts unpriced works together", async () => {
    window.localStorage.setItem(
      "staff.columns.from-zoho-all",
      JSON.stringify({
        hidden: [],
        known: ["artwork", "where", "location", "kind", "zohoPrice", "edited"],
      }),
    );
    inShell(<AllFromZohoList query={{ tab: "all" }} page={page(priced)} />);
    expect(rowOf("Work 1").getByText("£4,800.00")).toBeInTheDocument();
    expect(rowOf("Work 2").getByText("Not set in Zoho")).toBeInTheDocument();
    const header = screen.getByRole("columnheader", { name: /Price in Zoho/ });
    fireEvent.click(within(header).getByRole("button"));
    const order = screen
      .getAllByRole("row")
      .map((row) => /Work \d/.exec(row.textContent ?? "")?.[0])
      .filter(Boolean);
    expect(order).toEqual(["Work 3", "Work 1", "Work 2"]);
  });

  afterEach(() => window.localStorage.clear());
});

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

describe("AllFromZohoList: where each artwork physically is", () => {
  const ROOM = "11111111-1111-4111-8111-111111111111";
  const FRAMER = "22222222-2222-4222-8222-222222222222";
  const location = (id: string, name: string, status: "active" | "retired") => ({
    id,
    name,
    note: null,
    status,
    label: status === "retired" ? `${name} (retired)` : name,
    version: 1,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-01T09:00:00.000Z",
    retiredAt: status === "retired" ? "2026-11-02T09:00:00.000Z" : null,
  });
  const LOCATIONS = [location(ROOM, "Store room", "active"), location(FRAMER, "Framer", "retired")];
  const ADMIN = [...EDITOR, "artwork_location.read", "artwork_location.move"];
  const rows = [
    item(1, "not_offered", {
      location: { id: ROOM, name: "Store room", status: "active", label: "Store room" },
    }),
    item(2, "sold", {
      location: { id: FRAMER, name: "Framer", status: "retired", label: "Framer (retired)" },
    }),
    item(3, "draft_lax_art"),
  ];

  it("shows each artwork's location, a retired one marked, and Not recorded", () => {
    inShell(<AllFromZohoList query={{ tab: "all" }} page={page(rows)} locations={LOCATIONS} />);
    expect(screen.getByRole("columnheader", { name: "Location" })).toBeInTheDocument();
    expect(rowOf("Work 1").getByText("Store room")).toBeInTheDocument();
    expect(rowOf("Work 2").getByText("Framer (retired)")).toBeInTheDocument();
    expect(rowOf("Work 3").getByText("Location not recorded")).toBeInTheDocument();
  });

  it("shows the location filter as a removable chip, by name or as not recorded", () => {
    const { unmount } = inShell(
      <AllFromZohoList
        query={{ tab: "all", location: FRAMER }}
        page={page([rows[1] as AdminRegisterAllItem])}
        locations={LOCATIONS}
      />,
    );
    const applied = () => within(screen.getByRole("list", { name: "Applied filters" }));
    expect(applied().getByText("Location: Framer (retired)")).toBeInTheDocument();
    unmount();
    inShell(
      <AllFromZohoList
        query={{ tab: "all", location: "none" }}
        page={page([rows[2] as AdminRegisterAllItem])}
        locations={LOCATIONS}
      />,
    );
    expect(applied().getByText("Location: Location not recorded")).toBeInTheDocument();
  });

  it("lets nobody select rows who cannot move artworks, or when the locations did not load", () => {
    const { unmount } = inShell(
      <AllFromZohoList query={{ tab: "all" }} page={page(rows)} locations={LOCATIONS} />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    unmount();
    inShell(<AllFromZohoList query={{ tab: "all" }} page={page(rows)} locations={null} />, ADMIN);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("moves the selected artworks to an active location, with a note", async () => {
    moveArtworksToLocation.mockResolvedValue({
      ok: true,
      data: {
        locationId: ROOM,
        moved: [{ registerId: rows[1]?.registerId, fromLocationId: FRAMER }],
        unchanged: [rows[0]?.registerId],
        notFound: [],
      },
    });
    inShell(
      <AllFromZohoList query={{ tab: "all" }} page={page(rows)} locations={LOCATIONS} />,
      ADMIN,
    );
    fireEvent.click(rowOf("Work 1").getByRole("checkbox"));
    fireEvent.click(rowOf("Work 2").getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Move selected…" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Move 2 artworks" }));
    // Nothing chosen yet: the summary and the field both say so.
    fireEvent.click(dialog.getByRole("button", { name: "Move 2 artworks" }));
    expect(
      await dialog.findByText("Move to: Choose where the artwork is going."),
    ).toBeInTheDocument();
    expect(moveArtworksToLocation).not.toHaveBeenCalled();

    // Only active places are offered.
    fireEvent.click(dialog.getByRole("combobox"));
    expect(screen.queryByRole("option", { name: /Framer/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Store room" }));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Winter hang" } });
    fireEvent.click(dialog.getByRole("button", { name: "Move 2 artworks" }));
    await waitFor(() => expect(moveArtworksToLocation).toHaveBeenCalledOnce());
    expect(moveArtworksToLocation.mock.calls[0]?.[0]).toMatchObject({
      body: {
        registerIds: [rows[0]?.registerId, rows[1]?.registerId],
        locationId: ROOM,
        note: "Winter hang",
      },
    });
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
