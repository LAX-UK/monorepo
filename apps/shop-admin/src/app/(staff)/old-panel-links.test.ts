import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Lists that opened a record panel now open the record's page. A link to an old panel URL (a
 * bookmark, a link in a message) lands on the record, keeping the list it came from.
 */

const { fetchAdminJson, loadAdminSession, loadArtistListPage, loadArtworkListPage, redirect } =
  vi.hoisted(() => ({
    fetchAdminJson: vi.fn(),
    loadAdminSession: vi.fn(),
    loadArtistListPage: vi.fn(),
    loadArtworkListPage: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
  }));
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
vi.mock("@/server/application/load-artwork-pages", () => ({
  loadArtistListPage,
  loadArtworkListPage,
}));
vi.mock("@/server/container", () => ({
  getShopAdminContainer: () => ({
    config: { bidPublicUrl: "https://lax.bid", artPublicUrl: null },
  }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));
// The lists themselves are tested on their own; here only where the page sends the link.
const Nothing = () => null;
vi.mock("@/components/clients/clients-list.client", () => ({ ClientsList: Nothing }));
vi.mock("@/components/artists/artist-list.client", () => ({ ArtistList: Nothing }));
vi.mock("@/components/artworks/artwork-list.client", () => ({ ArtworkList: Nothing }));
vi.mock("@/components/merchandise/merchandise-list.client", () => ({ MerchandiseList: Nothing }));
vi.mock("@/components/help/help-articles-list.client", () => ({ HelpArticlesList: Nothing }));
vi.mock("@/components/artist-applications/artist-applications-list.client", () => ({
  ArtistApplicationsList: Nothing,
}));
vi.mock("@/components/enquiries/enquiries-list.client", () => ({ EnquiriesList: Nothing }));
vi.mock("@/components/staff/staff-list.client", () => ({ StaffList: Nothing }));
vi.mock("@/components/disputes/disputes-list.client", () => ({ DisputesList: Nothing }));
vi.mock("@/components/editorial/editorial-list.client", () => ({ EditorialList: Nothing }));

const ID = "5b1c2d3e-0000-4000-8000-000000000001";
const ORDER = "6c1c2d3e-0000-4000-8000-000000000002";
const list = (query: string) => `list=${encodeURIComponent(query)}`;

async function landsOn(
  page: (props: {
    searchParams: Promise<Record<string, string>>;
    params?: Promise<Record<string, string>>;
  }) => Promise<unknown>,
  searchParams: Record<string, string>,
  params?: Record<string, string>,
): Promise<string | null> {
  try {
    await page({
      searchParams: Promise.resolve(searchParams),
      ...(params ? { params: Promise.resolve(params) } : {}),
    });
    return null;
  } catch (error) {
    const match = /^redirect:(.*)$/.exec((error as Error).message);
    if (!match) throw error;
    return match[1] ?? null;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [], nextCursor: null } });
  loadAdminSession.mockResolvedValue({
    status: "ok",
    data: { subject: "staff-1", capabilities: [] },
  });
});

// The first page imported pulls in its whole list module graph, which takes a while cold.
describe("an old panel link opens the record's page", { timeout: 30_000 }, () => {
  it("Clients", async () => {
    const { default: page } = await import("./clients/page");
    expect(await landsOn(page, { client: ID, q: "Ada" })).toBe(`/clients/${ID}?${list("q=Ada")}`);
  });

  it("Artists", async () => {
    const { default: page } = await import("./artists/page");
    expect(await landsOn(page, { artist: ID })).toBe(`/artists/${ID}`);
  });

  it("Artworks", async () => {
    const { default: page } = await import("./artworks/page");
    expect(await landsOn(page, { artwork: ID, state: "draft" })).toBe(
      `/artworks/${ID}?${list("state=draft")}`,
    );
  });

  it("Merchandise", async () => {
    const { default: page } = await import("./merchandise/page");
    expect(await landsOn(page, { product: ID })).toBe(`/merchandise/${ID}`);
  });

  it("Editorial", async () => {
    // The route renders the list's server part, which reads the link.
    const { EditorialListPage } = await import("@/components/editorial/editorial-list-page");
    const { parseEditorialList } = await import("@/server/domain/editorial-list.vm");
    const page = ({ searchParams }: { searchParams: Promise<Record<string, string>> }) =>
      searchParams.then((params) =>
        EditorialListPage({ kind: "stories", state: parseEditorialList("stories", params) }),
      );
    expect(await landsOn(page, { item: ID })).toBe(`/editorial/stories/${ID}`);
  });

  it("Help questions", async () => {
    const { default: page } = await import("./help/page");
    expect(await landsOn(page, { article: ID })).toBe(`/help/${ID}`);
  });

  it("Artist applications", async () => {
    const { default: page } = await import("./artist-applications/page");
    expect(await landsOn(page, { application: ID, view: "all" })).toBe(
      `/artist-applications/${ID}?${list("view=all")}`,
    );
  });

  it("Enquiries, to the conversation", async () => {
    const { default: page } = await import("./enquiries/page");
    expect(await landsOn(page, { enquiry: `general:${ID}` })).toBe(`/enquiries/general/${ID}`);
  });

  it("Disputes, to the dispute's order at its payment", async () => {
    fetchAdminJson.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            disputeId: ID,
            orderId: ORDER,
            stripeDisputeId: "dp_1",
            status: "opened",
            amountPence: 100,
            openedAt: "2026-11-01T10:00:00.000Z",
            closedAt: null,
          },
        ],
        nextCursor: null,
      },
    });
    const { default: page } = await import("./disputes/page");
    expect(await landsOn(page, { dispute: ID })).toBe(`/orders/${ORDER}#payment`);
  });

  it("Disputes, showing the list when the dispute is not found", async () => {
    const { default: page } = await import("./disputes/page");
    expect(await landsOn(page, { dispute: ID })).toBeNull();
  });

  it("Staff, with no panel any more, to the list as it was", async () => {
    const { default: page } = await import("./staff/page");
    expect(await landsOn(page, { staff: ID, q: "Sam" })).toBe("/staff?q=Sam");
  });

  it("leaves a list without an old panel link alone", async () => {
    const { default: page } = await import("./clients/page");
    expect(await landsOn(page, { q: "Ada" })).toBeNull();
  });
});
