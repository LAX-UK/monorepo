// @vitest-environment jsdom
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
import type { ExhibitionDetail } from "@/lib/editorial-entity-forms";
import { capabilitiesForRole } from "@auction/shop-domain";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { cleanup, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  saveEditorialEntity: vi.fn(),
  getEditorialEntityDetail: vi.fn(),
  setEditorialPublication: vi.fn(),
  issueEditorialPreviewToken: vi.fn(),
  replaceEditorialPlacementSlot: vi.fn(),
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
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { EditorialList } = await import("./editorial-list.client");
const { ExhibitionEditor } = await import("./editorial-editors.client");
const { EditorialPlacementsTab } = await import("@/components/editorial-placements-tab.client");
const { LaxStaffAccessProvider } = await import("@/components/lax-staff-access-provider.client");
const { editorialListPage, parseEditorialList, toEditorialListRow } = await import(
  "@/server/domain/editorial-list.vm"
);

const ID = "5b1c2d3e-0000-4000-8000-000000000001";

function as(role: "read_only" | "editor", ui: React.ReactNode) {
  return render(
    <LaxStaffAccessProvider
      capabilities={[...capabilitiesForRole(role)]}
      roleLabel={role === "editor" ? "Editor" : "Read-only"}
    >
      <StaffTooltipProvider>{ui}</StaffTooltipProvider>
    </LaxStaffAccessProvider>,
  );
}

const rows = [
  toEditorialListRow("exhibitions", {
    id: ID,
    slug: "summer-show",
    label: "Summer Show",
    status: "published",
    updatedAt: "2026-10-20T09:00:00.000Z",
    kind: "exhibition",
    startsOn: null,
    endsOn: null,
  }),
];

function list() {
  const state = parseEditorialList("exhibitions", { item: ID });
  return (
    <EditorialList
      kind="exhibitions"
      entity={EDITORIAL_ENTITIES.exhibitions}
      state={state}
      page={editorialListPage("exhibitions", rows, state)}
      totalRows={rows.length}
      initialOpened={rows[0] ?? null}
      artPublicUrl="https://lax.test"
    />
  );
}

const detail: ExhibitionDetail = {
  id: ID,
  slug: "summer-show",
  status: "published",
  label: "Summer show",
  updatedAt: "2026-03-01T10:00:00.000Z",
  kind: "exhibition",
  title: "Summer show",
  subtitle: null,
  summary: null,
  venueId: null,
  startsOn: null,
  endsOn: null,
  timesNote: null,
  coverMediaKey: null,
  featured: false,
  contactName: null,
  contactRole: null,
  contactEmail: null,
  contactPhone: null,
  contactAvatarMediaKey: null,
  body: [],
};

afterEach(cleanup);

describe("editorial lists for Read-only", () => {
  it("shows the list with the View only marker and no way to create, publish or edit", async () => {
    as("read_only", list());
    const panel = await screen.findByRole("dialog", { name: /Summer Show/ });
    expect(screen.getByText(/View only · Read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New exhibition/i, hidden: true })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Unpublish" })).toBeNull();
    expect(within(panel).queryByRole("link", { name: /^Edit/ })).toBeNull();
    expect(within(panel).getByRole("link", { name: "View exhibition" })).toHaveAttribute(
      "href",
      `/editorial/exhibitions/${ID}`,
    );
  });

  it("keeps the create, publish and edit controls for an Editor", async () => {
    as("editor", list());
    const panel = await screen.findByRole("dialog", { name: /Summer Show/ });
    expect(screen.queryByText(/View only/)).toBeNull();
    expect(screen.getByRole("link", { name: /New exhibition/i, hidden: true })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Edit exhibition" })).toBeInTheDocument();
  });
});

describe("the exhibition editor for Read-only", () => {
  it("opens as a view: marker, locked fields, no save, publish or preview", () => {
    as(
      "read_only",
      <ExhibitionEditor detail={detail} venues={[]} artPublicUrl="https://lax.test" />,
    );
    expect(screen.getByText(/View only · Read-only/)).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Save|^Saved/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Unpublish|^Publish/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create preview link" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to list" })).toBeInTheDocument();
  });

  it("stays editable for an Editor", () => {
    as("editor", <ExhibitionEditor detail={detail} venues={[]} artPublicUrl="https://lax.test" />);
    expect(screen.queryByText(/View only/)).toBeNull();
    expect(screen.getByLabelText("Title")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });
});

describe("the lax.art home slots for Read-only", () => {
  const placements = [
    {
      id: "p1",
      slot: "home_hero" as const,
      position: 0,
      refKind: "story" as const,
      refId: ID,
      headline: "Read this",
      mediaKey: null,
      linkUrl: null,
      publishedAt: null,
    },
  ];
  const refLists = {
    exhibition: [],
    story: [{ id: ID, label: "A story", status: "published" }] as never,
    page: [],
    venue: [],
  };

  it("shows the rows without save, add, remove or reorder controls", () => {
    as("read_only", <EditorialPlacementsTab placements={placements} refLists={refLists} />);
    expect(screen.getAllByRole("region").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Save slot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Move/ })).toBeNull();
  });

  it("offers them to an Editor", () => {
    as("editor", <EditorialPlacementsTab placements={placements} refLists={refLists} />);
    expect(screen.getAllByRole("button", { name: "Save slot" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Add row" }).length).toBeGreaterThan(0);
  });
});
