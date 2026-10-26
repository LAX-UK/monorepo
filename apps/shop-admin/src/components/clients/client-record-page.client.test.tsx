// @vitest-environment jsdom
import type { AdminClientDetail, AdminPartyList } from "@auction/shop-contracts";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-people-actions.server", () => ({
  grantArtworkSaleAuthority: vi.fn(),
}));
vi.mock("@/server/application/admin-lookup-actions.server", () => ({
  searchPartyOptions: vi.fn(),
  searchArtworkOptions: vi.fn(),
  searchEditionOptions: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/clients",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { ClientRecordPage } = await import("./client-record-page.client");
const { ClientsList } = await import("./clients-list.client");
const { clientsList } = await import("@/server/domain/people-lists.vm");

const PARTY = "11111111-1111-4111-8111-111111111111";

const detail: AdminClientDetail = {
  party: {
    partyId: PARTY,
    displayName: "Ada Lovelace",
    kind: "person",
    identitySubjectId: "subject-ada",
    createdAt: "2025-03-01T10:00:00.000Z",
    email: "ada@example.com",
  },
  editions: [
    {
      editionId: "22222222-2222-4222-8222-222222222222",
      artworkId: "33333333-3333-4333-8333-333333333333",
      artworkSlug: "vessel-study",
      artworkTitle: "Vessel Study",
      editionNumber: 4,
      listingStatus: "authorised",
      custodyStatus: "stored",
    },
  ],
  saleAuthority: [],
  requests: [],
  payouts: [
    {
      payoutId: "44444444-4444-4444-8444-444444444444",
      source: "order_line",
      grossPence: 50_000,
      netPence: 42_500,
      status: "due",
      payoutDueAt: "2026-11-01T10:00:00.000Z",
      paidAt: null,
    },
  ],
  orders: [
    {
      orderId: "55555555-5555-4555-8555-555555555555",
      status: "paid",
      totalPence: 120_000,
      lineCount: 2,
      createdAt: "2026-10-01T10:00:00.000Z",
      paidAt: "2026-10-01T10:05:00.000Z",
    },
  ],
  orderCount: 14,
  enquiries: [
    {
      enquiryId: "66666666-6666-4666-8666-666666666666",
      kind: "general",
      subject: "private_viewing",
      status: "new",
      createdAt: "2026-10-02T10:00:00.000Z",
    },
  ],
  paidToDatePence: 98_000,
};

describe("a client's page", () => {
  it("says each figure once and links to their bidding instead of copying it", () => {
    render(<ClientRecordPage detail={detail} canGrant bidPublicUrl="https://lax.bid" />);
    const figures = screen.getByRole("region", { name: "Ada Lovelace at a glance" });
    expect(within(figures).getByText("£980.00")).toBeInTheDocument();
    expect(within(figures).getByText("£425.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bidding in Bid admin" })).toHaveAttribute(
      "href",
      "https://lax.bid/admin/clients?q=ada%40example.com",
    );
    expect(screen.getByRole("button", { name: "Grant sale authority" })).toBeInTheDocument();
  });

  it("lists their Shop and lax.art records as sections, with View all for orders", () => {
    render(<ClientRecordPage detail={detail} canGrant={false} bidPublicUrl={undefined} />);
    expect(screen.getByRole("link", { name: "View all 14" })).toHaveAttribute(
      "href",
      "/orders?q=ada%40example.com",
    );
    expect(screen.getAllByText("In LAX storage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Private viewing").length).toBeGreaterThan(0);
    expect(screen.queryByText(/private_viewing|order_line|authorised/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Grant sale authority" })).toBeNull();
  });
});

describe("the clients list", () => {
  const page: AdminPartyList = {
    items: [
      {
        partyId: PARTY,
        displayName: "Ada Lovelace",
        kind: "person",
        identitySubjectId: "subject-ada",
        createdAt: "2025-03-01T10:00:00.000Z",
        email: "ada@example.com",
        editionCount: 1,
        paidOrderCount: 3,
      },
    ],
    nextCursor: null,
    counts: { person: 1, gallery: 2 },
  };

  it("counts each kind, reads the kind as a word and opens the client from every row", () => {
    render(
      <ClientsList
        state={clientsList.parse({})}
        page={page}
        assignedOnly={false}
        bidPublicUrl="https://lax.bid"
      />,
    );
    expect(screen.getByRole("link", { name: /Galleries\s*2/ })).toBeInTheDocument();
    const row = within(screen.getByRole("grid")).getByText("Ada Lovelace").closest("tr");
    expect(within(row as HTMLElement).getByText("Person")).toBeInTheDocument();
    expect(
      within(row as HTMLElement).getByRole("link", { name: "Open client page" }),
    ).toHaveAttribute("href", `/clients/${PARTY}`);
  });
});
