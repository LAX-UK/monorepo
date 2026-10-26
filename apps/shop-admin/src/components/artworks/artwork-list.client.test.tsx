// @vitest-environment jsdom
import type { AdminArtworkList, AdminArtworkListItem } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkArtworkVisibility = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();

vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  bulkArtworkVisibility,
  getArtworkDetail: vi.fn(async () => ({ ok: false, kind: "failed", message: "Not in this test" })),
  setArtworkVisibility: vi.fn(),
  searchArtistOptions: vi.fn(async () => []),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh }),
  usePathname: () => "/artworks",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: toastWarning }),
  Toaster: () => null,
}));

// Radix sheets, dialogs, menus, popovers and checkboxes need layout jsdom does not have. These
// stand-ins keep the open and checked contracts, so the list's own behaviour is what is tested.
vi.mock("@auction/ui/components/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="panel">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetClose: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));
vi.mock("@auction/ui/components/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: () => null,
    DropdownMenuItem: Pass,
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
  };
});
vi.mock("@auction/ui/components/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    "aria-label": label,
  }: {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
    "aria-label"?: string;
  }) => (
    <span
      role="checkbox"
      tabIndex={0}
      aria-label={label}
      aria-checked={checked === true}
      onClick={() => onCheckedChange?.(checked !== true)}
      onKeyDown={() => onCheckedChange?.(checked !== true)}
    />
  ),
}));

const { ArtworkList } = await import("./artwork-list.client");

function item(index: number, patch: Partial<AdminArtworkListItem> = {}): AdminArtworkListItem {
  return {
    artworkId: `11111111-1111-4111-8111-00000000000${index}`,
    slug: `work-${index}`,
    title: `Work ${index}`,
    artistId: "22222222-2222-4222-8222-222222222222",
    artistName: "Ada Artist",
    thumbnailUrl: null,
    editionSize: 24,
    soldEditionCount: 2,
    printPricePence: 45_000,
    saleState: "for_sale",
    salesChannel: "shop",
    state: "live",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...patch,
  };
}

const page: AdminArtworkList = {
  items: [item(1, { state: "draft" }), item(2)],
  nextCursor: null,
  counts: { live: 7, draft: 2, sold_out: 1, archived: 3 },
};

function renderList(props: Partial<React.ComponentProps<typeof ArtworkList>> = {}) {
  return render(
    <ArtworkList
      query={{}}
      page={page}
      selectedArtistName={null}
      permissions={{ write: true }}
      {...props}
    />,
  );
}

describe("artwork list", () => {
  beforeEach(() => {
    for (const mock of [bulkArtworkVisibility, push, refresh, toastSuccess, toastWarning]) {
      mock.mockReset();
    }
  });

  it("shows every view with its count, All first", () => {
    renderList();
    for (const [name, count] of [
      ["All", "13"],
      ["Live", "7"],
      ["Draft", "2"],
      ["Sold out", "1"],
      ["Archived", "3"],
    ] as const) {
      expect(screen.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveTextContent(count);
    }
  });

  it("shows staff the edition counts and the edition price", () => {
    renderList();
    expect(screen.getAllByText("£450.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 of 24").length).toBeGreaterThan(0);
  });

  it("offers no selection to staff who cannot change the catalogue", () => {
    renderList({ permissions: { write: false } });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("confirms before publishing the selected drafts, then reports the result", async () => {
    bulkArtworkVisibility.mockResolvedValue({
      ok: true,
      data: { results: [{ artworkId: page.items[0]?.artworkId, outcome: "changed" }] },
    });
    renderList();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row 1" })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Publish…" }));
    expect(bulkArtworkVisibility).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("goes on LAX Shop now");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish artwork" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Published 1 artwork"));
    expect(bulkArtworkVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish", artworkIds: [page.items[0]?.artworkId] }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("confirms before archiving a selection, then reports refusals", async () => {
    bulkArtworkVisibility.mockResolvedValue({
      ok: true,
      data: {
        results: [{ artworkId: page.items[1]?.artworkId, outcome: "refused", message: "Locked" }],
      },
    });
    renderList();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row 2" })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Archive…" }));
    expect(bulkArtworkVisibility).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive artwork" }));
    await waitFor(() =>
      expect(toastWarning).toHaveBeenCalledWith(
        "No artworks were archived. 1 could not be changed.",
        { description: "Work 2: Locked" },
      ),
    );
  });

  it("explains an empty filtered list and offers to clear it", () => {
    renderList({ page: { ...page, items: [] }, query: { q: "nothing" } });
    expect(screen.getByText("No artworks match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenCalledWith("/artworks", { scroll: false });
  });
});
