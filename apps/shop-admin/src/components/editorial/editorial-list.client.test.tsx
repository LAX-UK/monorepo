// @vitest-environment jsdom
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setEditorialPublication = vi.fn();
const issueEditorialPreviewToken = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  setEditorialPublication,
  issueEditorialPreviewToken,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/editorial/exhibitions",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
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
const { EditorialList } = await import("./editorial-list.client");
const { editorialListPage, parseEditorialList, toEditorialListRow } = await import(
  "@/server/domain/editorial-list.vm"
);

const SUMMER = "5b1c2d3e-0000-4000-8000-000000000001";
const WINTER = "5b1c2d3e-0000-4000-8000-000000000002";

const apiRows = [
  {
    id: SUMMER,
    slug: "summer-show",
    label: "Summer Show",
    status: "published" as const,
    updatedAt: "2026-10-20T09:00:00.000Z",
    kind: "exhibition",
    startsOn: "2026-06-01",
    endsOn: "2026-06-30",
  },
  {
    id: WINTER,
    slug: "winter-film",
    label: "Winter Film",
    status: "draft" as const,
    updatedAt: "2026-10-22T09:00:00.000Z",
    kind: "film",
    startsOn: null,
    endsOn: null,
  },
];
const rows = apiRows.map((row) => toEditorialListRow("exhibitions", row));

function renderList(query: Record<string, string> = {}, all = rows) {
  const state = parseEditorialList("exhibitions", query);
  return render(
    <EditorialList
      kind="exhibitions"
      entity={EDITORIAL_ENTITIES.exhibitions}
      state={state}
      page={editorialListPage("exhibitions", all, state)}
      totalRows={all.length}
      initialOpened={all.find((row) => row.id === state.open) ?? null}
      artPublicUrl="https://lax.test"
    />,
  );
}

const rowOf = (text: string) =>
  within(screen.getByRole("grid")).getByText(text).closest("tr") as HTMLElement;

beforeEach(() => {
  setEditorialPublication.mockReset();
  issueEditorialPreviewToken.mockReset();
  toastSuccess.mockReset();
  setEditorialPublication.mockResolvedValue({ ok: true, data: { version: "v2" } });
});

describe("the exhibitions list", () => {
  it("shows a view per status with counts, and the newest edit first", () => {
    renderList();
    expect(screen.getByRole("link", { name: /^All\s*2/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Published\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Drafts\s*1/ })).toBeInTheDocument();
    const titles = within(screen.getByRole("grid"))
      .getAllByRole("row")
      .map((row) => row.textContent ?? "");
    expect(titles.findIndex((text) => text.includes("Winter Film"))).toBeLessThan(
      titles.findIndex((text) => text.includes("Summer Show")),
    );
  });

  it("marks the Updated column as the one the list is sorted by, newest first", () => {
    renderList();
    expect(screen.getByRole("columnheader", { name: /Updated/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: /Title/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
  });

  it("filters by kind and shows it as a removable chip", () => {
    renderList({ kind: "film" });
    expect(within(screen.getByRole("grid")).queryByText("Summer Show")).not.toBeInTheDocument();
    expect(within(screen.getByRole("grid")).getByText("Winter Film")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Applied filters" })).getByText("Film"),
    ).toBeInTheDocument();
  });

  it("says nothing matches, and offers to clear, when a search finds nothing", () => {
    renderList({ q: "zzz" });
    expect(screen.getByText("No exhibitions match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("explains an empty entity and offers the one way to start", () => {
    renderList({}, []);
    expect(screen.getByText("No exhibitions yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New exhibition" }).length).toBeGreaterThan(0);
  });

  it("puts open, edit, preview and the publishing action in every row's menu", () => {
    renderList();
    const published = within(rowOf("Summer Show"));
    expect(published.getByRole("menuitem", { name: "Open details" })).toBeInTheDocument();
    expect(published.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(published.getByRole("menuitem", { name: "Preview on lax.art" })).toBeInTheDocument();
    expect(published.getByRole("menuitem", { name: /Unpublish/ })).toBeInTheDocument();
    expect(within(rowOf("Winter Film")).getByRole("menuitem", { name: /^Publish/ })).toBeVisible();
  });

  it("asks before publishing, says what changes on lax.art, then publishes", async () => {
    renderList();
    fireEvent.click(within(rowOf("Winter Film")).getByRole("menuitem", { name: /^Publish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Publish “Winter Film”?" });
    expect(dialog).toHaveTextContent("lax.test/exhibitions/winter-film goes live on lax.art");
    expect(setEditorialPublication).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Publish exhibition" }));
    await waitFor(() => expect(setEditorialPublication).toHaveBeenCalledTimes(1));
    expect(setEditorialPublication).toHaveBeenCalledWith({
      kind: "exhibitions",
      id: WINTER,
      published: true,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("states that unpublishing takes the page off lax.art", async () => {
    renderList();
    fireEvent.click(within(rowOf("Summer Show")).getByRole("menuitem", { name: /Unpublish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Unpublish “Summer Show”?" });
    expect(dialog).toHaveTextContent("stops showing on lax.art");
    expect(within(dialog).getByRole("button", { name: "Unpublish exhibition" })).toBeVisible();
  });

  it("opens the record from ?item= with its facts once, and Edit and Publish in the footer", async () => {
    renderList({ item: SUMMER });
    const panel = await screen.findByRole("dialog", { name: /Summer Show/ });
    expect(within(panel).getByText("Published")).toBeInTheDocument();
    expect(within(panel).getByText("Exhibition")).toBeInTheDocument();
    expect(within(panel).getByText("1 Jun 2026 – 30 Jun 2026")).toBeInTheDocument();
    expect(within(panel).getByText("lax.test/exhibitions/summer-show")).toBeInTheDocument();
    expect(within(panel).getByText(SUMMER)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Edit exhibition" })).toHaveAttribute(
      "href",
      `/editorial/exhibitions/${SUMMER}`,
    );
    expect(within(panel).getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("shows a draft's panel with no public address yet", async () => {
    renderList({ item: WINTER });
    const panel = await screen.findByRole("dialog", { name: /Winter Film/ });
    expect(within(panel).getByText("Not public yet")).toBeInTheDocument();
  });
});

describe("a list that did not load", () => {
  it("keeps the frame and offers to try again", () => {
    const state = parseEditorialList("exhibitions", {});
    render(
      <EditorialList
        kind="exhibitions"
        entity={EDITORIAL_ENTITIES.exhibitions}
        state={state}
        page={editorialListPage("exhibitions", [], state)}
        totalRows={0}
        artPublicUrl={null}
        loadFailed
      />,
    );
    expect(screen.getByText("Exhibitions did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
