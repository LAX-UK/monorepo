// @vitest-environment jsdom
import { StaffAccessProvider } from "@auction/staff-ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Record lists in LAX Admin open the record's page: the title is a real link, the whole row
 * follows it, and the browser's new-tab gestures open the page (staff design standard TBL-8).
 * Every record's URL carries the list it came from (`?list=`), so its pager and the way back
 * keep the same view, search, filters and sort.
 */

vi.mock("@/server/application/admin-artwork-actions.server");
vi.mock("@/server/application/admin-merchandise-actions.server");
vi.mock("@/server/application/admin-artist-application-actions.server");
vi.mock("@/server/application/admin-help-actions.server");
vi.mock("@/server/application/admin-people-actions.server");
vi.mock("@/server/application/edition-run-actions.server");
vi.mock("@/server/application/admin-enquiry-actions.server");
vi.mock("@/server/application/delivery-quote-actions.server");
vi.mock("@/lib/saved-views-port.client", () => ({
  createSavedViewsPort: () => ({
    load: async () => [],
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
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

(await import("@/test/radix-stubs")).installLayoutStubs();
// Coming back to a list restores its scroll; jsdom has no scrolling.
window.scrollTo = vi.fn() as typeof window.scrollTo;
const { expectRowOpens, tableRowOf } = await import("@/test/row-link");
const { OrderList } = await import("./orders/order-list.client");
const { ClientsList } = await import("./clients/clients-list.client");
const { ArtistList } = await import("./artists/artist-list.client");
const { MerchandiseList } = await import("./merchandise/merchandise-list.client");
const { DisputesList } = await import("./disputes/disputes-list.client");
const { ArtistApplicationsList } = await import(
  "./artist-applications/artist-applications-list.client"
);
const { HelpCategoriesList } = await import("./help/help-categories-list.client");
const { HelpArticlesList } = await import("./help/help-articles-list.client");
const { ArtworkList } = await import("./artworks/artwork-list.client");
const { EnquiriesList } = await import("./enquiries/enquiries-list.client");
const { DeliveryQuotesView } = await import("./delivery-quotes/delivery-quotes-view.client");
const { parseEnquiriesState } = await import("@/server/domain/enquiry-inbox.vm");
const { parseHelpArticlesState } = await import("@/server/domain/help-list.vm");
const { parseOrderListQuery } = await import("@/server/domain/order-list.vm");
const { clientsList } = await import("@/server/domain/people-lists.vm");
const { artistList } = await import("@/server/domain/artist-list.vm");
const { merchandiseList } = await import("@/server/domain/merchandise-list.vm");
const { disputesList } = await import("@/server/domain/sales-lists.vm");
const { parseArtistApplicationsState } = await import("@/server/domain/artist-application.vm");
const { parseHelpCategoriesState } = await import("@/server/domain/help-list.vm");

const ID = "5b1c2d3e-0000-4000-8000-000000000001";
const ORDER = "6c1c2d3e-0000-4000-8000-000000000002";
const listParam = (query: string) => `list=${encodeURIComponent(query)}`;

function asStaff(node: React.ReactNode, can: (permission: string) => boolean = () => true) {
  return render(
    <StaffAccessProvider access={{ can: (p) => typeof p === "string" && can(p) }}>
      {node}
    </StaffAccessProvider>,
  );
}

afterEach(cleanup);

describe("a record list's row opens the record's page", () => {
  it("Orders: the whole row opens the order, with the list's filters and sort", () => {
    asStaff(
      <OrderList
        query={parseOrderListQuery({ status: "paid", sort: "total", cursor: "c2" })}
        page={{
          items: [
            {
              orderId: ORDER,
              reference: "LAX-S-1001",
              status: "paid",
              totalPence: 12000,
              fulfilment: "none",
              buyerSubjectId: "buyer-1",
              buyerName: "Ada Lovelace",
              buyerEmail: "ada@lax.test",
              createdAt: "2026-11-01T10:00:00.000Z",
              paidAt: "2026-11-01T10:05:00.000Z",
            },
          ],
          nextCursor: null,
          counts: { paid: 1 },
        }}
        now="2026-11-14T10:00:00.000Z"
      />,
    );
    const row = tableRowOf("LAX-S-1001");
    // One behaviour on the row: no quick view to open, from the row or its menu.
    expect(within(row).queryByRole("menuitem", { name: "Quick view" })).toBeNull();
    expectRowOpens(row, `/orders/${ORDER}?${listParam("status=paid&sort=total")}`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Orders: sorting is in the address, so Back finds the list in the same order", () => {
    asStaff(
      <OrderList
        query={parseOrderListQuery({ sort: "total" })}
        page={{
          items: [
            {
              orderId: ORDER,
              reference: "LAX-S-1001",
              status: "paid",
              totalPence: 900,
              fulfilment: "none",
              buyerSubjectId: "b",
              buyerName: "Ada",
              buyerEmail: null,
              createdAt: "2026-11-02T10:00:00.000Z",
              paidAt: null,
            },
            {
              orderId: ID,
              reference: "LAX-S-1002",
              status: "paid",
              totalPence: 100,
              fulfilment: "none",
              buyerSubjectId: "b",
              buyerName: "Bea",
              buyerEmail: null,
              createdAt: "2026-11-01T10:00:00.000Z",
              paidAt: null,
            },
          ],
          nextCursor: null,
          counts: { paid: 2 },
        }}
        now="2026-11-14T10:00:00.000Z"
      />,
    );
    const references = [...document.querySelectorAll("tbody tr")].map(
      (row) => row.textContent?.match(/LAX-S-\d+/)?.[0],
    );
    expect(references).toEqual(["LAX-S-1002", "LAX-S-1001"]);
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("Clients: the row opens the client's page", () => {
    asStaff(
      <ClientsList
        state={clientsList.parse({ q: "Ada" })}
        page={{
          items: [
            {
              partyId: ID,
              displayName: "Ada Lovelace",
              kind: "individual",
              identitySubjectId: null,
              createdAt: "2026-01-01T10:00:00.000Z",
              email: "ada@lax.test",
            },
          ],
          nextCursor: null,
        }}
        assignedOnly={false}
        bidPublicUrl={undefined}
      />,
    );
    const row = tableRowOf("Ada Lovelace");
    expect(within(row).queryByRole("menuitem", { name: "Open details" })).toBeNull();
    expectRowOpens(row, `/clients/${ID}?${listParam("q=Ada")}`);
  });

  it("Artists: the row opens the artist's page", () => {
    asStaff(
      <ArtistList
        state={artistList.parse({})}
        page={{
          items: [
            {
              artistId: ID,
              slug: "flora-powers",
              displayName: "Flora Powers",
              discipline: "Painting",
              createdAt: "2026-01-01T10:00:00.000Z",
              archived: false,
              artworkCount: 2,
            },
          ],
          nextCursor: null,
        }}
        canWrite
      />,
    );
    expectRowOpens(tableRowOf("Flora Powers"), `/artists/${ID}`);
  });

  it("Merchandise: the row opens the product's editor", () => {
    asStaff(
      <MerchandiseList
        state={merchandiseList.parse({ view: "archived" })}
        page={{
          items: [
            {
              id: ID,
              title: "Acceptance test cap",
              slug: "cap",
              status: "archived",
              variantCount: 1,
              fromPricePence: 2500,
              toPricePence: 2500,
              totalOnHand: 3,
            },
          ],
          nextCursor: null,
        }}
      />,
    );
    expectRowOpens(
      tableRowOf("Acceptance test cap"),
      `/merchandise/${ID}?${listParam("view=archived")}`,
    );
  });

  it("Artist applications: the row opens the application; assigning stays in the row menu", () => {
    asStaff(
      <ArtistApplicationsList
        state={parseArtistApplicationsState({})}
        page={{
          items: [
            {
              id: ID,
              reference: "APP-1",
              status: "submitted",
              artistName: "Mira Kent",
              location: "Leeds",
              applicant: { name: "Mira Kent", email: "mira@lax.test" },
              assignee: null,
              workCount: 4,
              coverImageUrl: null,
              submittedAt: "2026-11-01T10:00:00.000Z",
              version: 1,
            },
          ],
          nextCursor: null,
          counts: { all: 1, new: 1, in_review: 0, waiting: 0, decided: 0 },
        }}
        currentSubject="staff-1"
        reviewers={[]}
      />,
    );
    const row = tableRowOf("Mira Kent");
    expect(within(row).getByRole("menuitem", { name: "Assign to me" })).toBeInTheDocument();
    expectRowOpens(row, `/artist-applications/${ID}`);
  });
});

describe("more record lists", () => {
  it("Artworks: the row opens the artwork's editor, with the list's filters", () => {
    asStaff(
      <ArtworkList
        query={{ state: "live" }}
        page={{
          items: [
            {
              artworkId: ID,
              slug: "reed-study",
              title: "Reed Study",
              artistId: ORDER,
              artistName: "Flora Powers",
              thumbnailUrl: null,
              editionSize: 24,
              run: { spec: { type: "lax_standard" }, factsStatus: "confirmed", factsLocked: false },
              soldEditionCount: 2,
              printPricePence: 45_000,
              saleState: "for_sale",
              salesChannel: "shop",
              state: "live",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          ],
          nextCursor: null,
          counts: { live: 1, draft: 0, sold_out: 0, archived: 0 },
        }}
        selectedArtistName={null}
        permissions={{ write: true }}
      />,
    );
    const row = tableRowOf("Reed Study");
    expect(within(row).queryByRole("menuitem", { name: "Open details" })).toBeNull();
    expectRowOpens(row, `/artworks/${ID}?${listParam("state=live")}`);
  });

  it("Help questions: the row opens the question's editor", () => {
    asStaff(
      <HelpArticlesList
        state={parseHelpArticlesState({ view: "draft" })}
        rows={[
          {
            id: ID,
            question: "How do I buy an artwork?",
            slug: "how-to-buy",
            categoryId: ORDER,
            categoryTitle: "Buying",
            status: "draft",
            updatedAt: "2026-11-01T10:00:00.000Z",
            updatedByName: null,
          },
        ]}
        counts={{ draft: 1 }}
        categories={[{ id: ORDER, title: "Buying" }]}
      />,
    );
    expectRowOpens(
      tableRowOf("How do I buy an artwork?"),
      `/help/${ID}?${listParam("view=draft")}`,
    );
  });

  it("Enquiries: the row opens the conversation; assigning stays in the row menu", () => {
    asStaff(
      <EnquiriesList
        state={parseEnquiriesState({})}
        page={{
          items: [
            {
              kind: "general",
              id: ID,
              topic: "private_viewing",
              status: "new",
              assignee: null,
              sender: { type: "guest", name: "Sam Guest", email: "sam@lax.test" },
              artwork: null,
              excerpt: "Can I visit?",
              version: "1",
              createdAt: "2026-11-01T10:00:00.000Z",
            },
          ],
          nextCursor: null,
          counts: { new: 1, in_progress: 0, closed: 0 },
        }}
        currentSubject="staff-1"
        canWrite
      />,
    );
    const row = tableRowOf("Sam Guest");
    expect(within(row).getByRole("menuitem", { name: /Assign to me|Take/ })).toBeInTheDocument();
    expectRowOpens(row, `/enquiries/general/${ID}`);
  });

  it("Delivery quotes: the row opens the order; Quote stays on the row", () => {
    asStaff(
      <DeliveryQuotesView
        view="waiting"
        canWrite
        data={{
          items: [
            {
              id: ID,
              orderId: ORDER,
              orderReference: "LAX-S-10482",
              status: "requested",
              country: "DE",
              countryName: "Germany",
              regionName: "European Union",
              recipientName: "Anna Weber",
              address: ["Friedrichstrasse 12", "Berlin 10117", "Germany"],
              phone: null,
              items: ["Warm Basket"],
              beforeDeliveryPence: 42000,
              requestedAt: "2026-11-10T09:00:00.000Z",
              holdUntil: "2026-11-13T09:00:00.000Z",
              quote: null,
              endReason: null,
              declineNote: null,
            },
          ],
          waitingCount: 1,
          paymentOpen: true,
        }}
      />,
    );
    const row = tableRowOf("LAX-S-10482");
    expectRowOpens(row, `/orders/${ORDER}`);
    // The inline buttons are the row's actions: they open their dialog, not the order.
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.click(within(row).getByRole("button", { name: "Quote LAX-S-10482" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("lists whose panel is gone", () => {
  it("Disputes: the row opens the order the dispute was raised on, at its payment", () => {
    asStaff(
      <DisputesList
        state={disputesList.parse({})}
        page={{
          items: [
            {
              disputeId: ID,
              orderId: ORDER,
              stripeDisputeId: "dp_123",
              status: "opened",
              amountPence: 12000,
              openedAt: "2026-11-01T10:00:00.000Z",
              closedAt: null,
              orderReference: "LAX-S-1001",
            },
          ],
          nextCursor: null,
        }}
      />,
    );
    const row = tableRowOf("LAX-S-1001");
    expect(within(row).getByRole("menuitem", { name: "Copy dispute reference" })).toBeVisible();
    expectRowOpens(row, `/orders/${ORDER}#payment`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  const category = {
    id: ID,
    slug: "buying",
    title: "Buying",
    status: "published" as const,
    articleCount: 2,
    publishedArticleCount: 2,
    counts: "2 questions",
    updatedAt: "2026-11-01T10:00:00.000Z",
  };

  it("Help categories: an editor's row opens the edit dialog, as Framing does", () => {
    asStaff(
      <HelpCategoriesList
        state={parseHelpCategoriesState({})}
        rows={[category] as never}
        counts={{ published: 1 }}
      />,
    );
    const row = tableRowOf("Buying");
    expect(within(row).queryByRole("link", { name: /Buying/ })).toBeNull();
    fireEvent.click(within(row).getByText("2 questions"));
    expect(screen.getByRole("dialog", { name: "Edit “Buying”" })).toBeInTheDocument();
  });

  it("Help categories: an old panel link opens that category's edit dialog", () => {
    asStaff(
      <HelpCategoriesList
        state={parseHelpCategoriesState({ category: ID })}
        rows={[category] as never}
        counts={{ published: 1 }}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Edit “Buying”" })).toBeInTheDocument();
  });

  it("Help categories: a read-only row opens nothing", () => {
    asStaff(
      <HelpCategoriesList
        state={parseHelpCategoriesState({ category: ID })}
        rows={[category] as never}
        counts={{ published: 1 }}
      />,
      () => false,
    );
    fireEvent.click(within(tableRowOf("Buying")).getByText("2 questions"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
