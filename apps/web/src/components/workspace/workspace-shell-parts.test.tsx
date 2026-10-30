import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/home",
}));

import {
  type ClientNavScope,
  getClientMobileTabs,
  getClientNavSections,
} from "@/lib/navigation/client-nav-model";
import type { AccountSearchResult } from "@/lib/workspace/account-search";
import type { RecentSearchStore } from "@/lib/workspace/recent-searches";
import { WorkspaceNavList } from "./workspace-nav-list";
import { WorkspaceSearch } from "./workspace-search";
import { currentTabId, moreSheetSections } from "./workspace-tab-bar";

const owner: ClientNavScope = {
  context: { kind: "organisation", id: "org-1", role: "owner" },
  hasSubmissions: false,
};
const consignor: ClientNavScope = {
  context: { kind: "organisation", id: "org-1", role: "consignor" },
  hasSubmissions: false,
};

describe("WorkspaceNavList", () => {
  it("marks the current page, shows work waiting as a count, and never shows a 0", () => {
    render(
      <WorkspaceNavList
        sections={getClientNavSections(owner)}
        pathname="/team"
        counts={{ needsYou: { bids: 2 }, unread: 0 }}
      />,
    );
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Bids/ })).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /^Purchases/ }).textContent).toBe("Purchases");
    expect(screen.getByRole("link", { name: /^Notifications/ }).textContent).toBe("Notifications");
  });

  it("labels each group by its heading, and opens LAX Account as another product", () => {
    render(
      <WorkspaceNavList
        sections={getClientNavSections(owner)}
        pathname="/home"
        counts={{ needsYou: {}, unread: 3 }}
      />,
    );
    expect(screen.getByRole("list", { name: "Collection" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Organisation" })).getAllByRole("link"),
    ).toHaveLength(2);
    expect(screen.getByRole("link", { name: /LAX Account/ })).toHaveAccessibleName(
      /opens LAX Account/,
    );
    expect(screen.getByRole("link", { name: /^Notifications/ })).toHaveTextContent("3");
  });
});

describe("phone tabs and More", () => {
  const tabs = getClientMobileTabs(owner);

  it("marks the tab whose page or parent is open, and More for any other page", () => {
    expect(currentTabId(tabs, "/bids/telephone/1")).toBe("bids");
    expect(currentTabId(tabs, "/watching")).toBe("more");
    expect(currentTabId(tabs, "/team")).toBe("more");
  });

  it("lists in More only what is not a tab, with the account entries last", () => {
    const more = moreSheetSections(getClientNavSections(owner), tabs);
    const ids = more.flatMap((section) => section.items.map((item) => item.id));
    expect(ids).toEqual([
      "watchlist",
      "payouts",
      "works",
      "team",
      "organisation",
      "notifications",
      "settings",
      "lax-account",
    ]);
    expect(more.at(-1)?.id).toBe("account");
  });
});

describe("WorkspaceSearch", () => {
  const memory = (): RecentSearchStore & { rows: Map<string, unknown[]> } => {
    const rows = new Map<string, unknown[]>();
    return {
      rows,
      read: (id) => (rows.get(id) ?? []) as never,
      remember: (id, row) => void rows.set(id, [row, ...(rows.get(id) ?? [])]),
    };
  };
  const result: AccountSearchResult = {
    searchable: ["consignments", "bids"],
    groups: [
      {
        group: "consignments",
        items: [{ submissionId: "s-1", title: "Night harbour", status: "unsold" }],
      },
    ],
  };
  const pages = getClientNavSections(consignor).flatMap((s) =>
    s.items.filter((i) => !i.external).map((i) => ({ id: i.id, label: i.label, href: i.href })),
  );

  beforeEach(() => push.mockReset());

  it("opens from the field and from ⌘K, offering the role's pages before typing", () => {
    render(
      <WorkspaceSearch
        accountId="org-1"
        accountName="Northbank Gallery"
        roleLabel="Consignor"
        pages={pages}
        search={vi.fn()}
        recentStore={memory()}
      />,
    );
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = screen.getByRole("dialog", { name: "Search Northbank Gallery" });
    expect(within(dialog).getByRole("group", { name: "Go to" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: /Team/ })).not.toBeInTheDocument();
  });

  it("searches only through the port, says what a narrower role leaves out, and remembers the pick", async () => {
    const store = memory();
    const search = vi.fn().mockResolvedValue(result);
    render(
      <WorkspaceSearch
        accountId="org-1"
        accountName="Northbank Gallery"
        roleLabel="Consignor"
        pages={pages}
        search={search}
        recentStore={store}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Search Northbank Gallery/ })[0] as HTMLElement,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "harb" } });
    const option = await screen.findByRole("option", { name: /Night harbour/ });
    expect(search).toHaveBeenCalledWith("harb", expect.any(AbortSignal));
    expect(
      screen.getByText(
        /Showing what a consignor can open\. Purchases, works, invoices and people aren't searched\./,
      ),
    ).toBeInTheDocument();
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith("/selling/consignments/s-1");
    expect(store.rows.get("org-1")).toHaveLength(1);
  });

  it("says when search is unavailable instead of showing nothing", async () => {
    render(
      <WorkspaceSearch
        accountId="org-1"
        accountName="Northbank Gallery"
        roleLabel="Owner"
        pages={[]}
        search={vi.fn().mockResolvedValue(null)}
        recentStore={memory()}
      />,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Hockney" } });
    expect(await screen.findByText("Search isn't available right now")).toBeInTheDocument();
  });
});
