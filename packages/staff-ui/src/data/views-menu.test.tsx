import { TooltipProvider } from "@auction/ui/components/tooltip";
import { PlainLink } from "@auction/ui/lax";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real toaster injects a large stylesheet into the page, which makes every style lookup the
// test runtime does for focus and role queries slow. Toasts are not what these tests are about.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix's popover keeps repositioning itself in the test runtime, which makes every query take
// seconds. A plain open/close panel exercises the same menu code; positioning is not under test.
vi.mock("@auction/ui/components/popover", async () => {
  const React = await import("react");
  const Context = React.createContext<{ open: boolean; set: (open: boolean) => void }>({
    open: false,
    set: () => {},
  });
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
      <Context.Provider value={{ open, set: onOpenChange }}>{children}</Context.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const { open, set } = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => set(!open) });
    },
    PopoverContent: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => {
      const { open } = React.useContext(Context);
      const {
        align: _a,
        sideOffset: _s,
        onEscapeKeyDown: _e,
        ...rest
      } = props as Record<string, unknown>;
      return open ? (
        <dialog open {...(rest as React.HTMLAttributes<HTMLDialogElement>)}>
          {children}
        </dialog>
      ) : null;
    },
  };
});
import {
  type SavedView,
  SavedViewsError,
  type SavedViewsPort,
  useSavedViews,
} from "./saved-views.js";
import { DataViews } from "./toolbar.js";
import type { TeamView } from "./views-menu.js";

const team: TeamView[] = [
  {
    id: "team-paid",
    label: "Paid this week",
    query: "status=paid&from=2026-03-03",
    href: "/orders?status=paid&from=2026-03-03",
  },
  {
    id: "team-refunded",
    label: "Refunded",
    query: "status=refunded",
    href: "/orders?status=refunded",
  },
];

const view = (id: string, label: string, query = `q=${id}`): SavedView => ({ id, label, query });

function fakePort(initial: SavedView[] = []): SavedViewsPort & {
  [K in keyof SavedViewsPort]: ReturnType<typeof vi.fn>;
} {
  const server = [...initial];
  return {
    load: vi.fn(async () => server.map((item) => ({ ...item }))),
    create: vi.fn(async (input: { label: string; query: string }) => {
      const created = { id: `server-${server.length + 1}`, ...input };
      server.push(created);
      return created;
    }),
    rename: vi.fn(async (id: string, label: string) => {
      const found = server.find((item) => item.id === id) as SavedView;
      found.label = label;
      return { ...found };
    }),
    reorder: vi.fn(async (ids: readonly string[]) => {
      const sorted = ids.map((id) => server.find((item) => item.id === id) as SavedView);
      server.splice(0, server.length, ...sorted);
    }),
    remove: vi.fn(async (id: string) => {
      server.splice(
        server.findIndex((item) => item.id === id),
        1,
      );
    }),
  };
}

function Harness({
  port,
  currentQuery = "",
  teamViews = team,
}: {
  port: SavedViewsPort;
  currentQuery?: string;
  teamViews?: TeamView[];
}) {
  const saved = useSavedViews("test.orders", port);
  return (
    <TooltipProvider>
      <DataViews
        views={[{ id: "all", label: "All", href: "/orders" }]}
        activeId="all"
        Link={PlainLink}
        team={teamViews}
        saved={saved}
        savedHref={(item) => `/orders?${item.query}`}
        currentQuery={currentQuery}
      />
    </TooltipProvider>
  );
}

/**
 * Lets pending promises and effects finish. The testing library's polling queries (`findBy*`,
 * `waitFor`) re-run on every page mutation, and an open Radix panel mutates the page constantly,
 * which makes them take seconds here; flushing once and querying once is exact and fast.
 */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function settle<T>(query: () => T): Promise<T> {
  await flush();
  return query();
}

async function openMenu(ui: React.ReactElement) {
  render(ui);
  fireEvent.click(screen.getByRole("button", { name: /^Views/ }));
  return settle(() => screen.getByRole("dialog", { name: "Views" }));
}

const myViews = (panel: HTMLElement) =>
  within(within(panel).getByRole("region", { name: "My views" })).queryAllByRole("listitem");

beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    },
  });
});

describe("the Views menu", () => {
  it("lists team views first, then the person's own", async () => {
    const panel = await openMenu(<Harness port={fakePort([view("a", "Mine")])} />);

    await settle(() => within(panel).getByText("Mine"));
    const headings = within(panel)
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(headings[0]).toBe("Team views");
    expect(headings[1]).toMatch(/^My views/);
    const links = within(within(panel).getByRole("region", { name: "Team views" })).getAllByRole(
      "link",
    );
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Paid this week", "/orders?status=paid&from=2026-03-03"],
      ["Refunded", "/orders?status=refunded"],
    ]);
  });

  it("gives team views no way to rename, move or delete them", async () => {
    const panel = await openMenu(<Harness port={fakePort([view("a", "Mine")])} />);
    await settle(() => within(panel).getByText("Mine"));

    const teamRegion = within(panel).getByRole("region", { name: "Team views" });

    expect(within(teamRegion).queryAllByRole("button")).toHaveLength(0);
  });

  it("explains an empty list of saved views", async () => {
    const panel = await openMenu(<Harness port={fakePort()} />);

    expect(await settle(() => within(panel).getByText(/Nothing saved yet/))).toBeInTheDocument();
  });

  it("says when the views did not load, and loads them again", async () => {
    const port = fakePort([view("a", "Mine")]);
    port.load.mockRejectedValueOnce(new Error("offline"));
    const panel = await openMenu(<Harness port={port} />);

    expect(await settle(() => within(panel).getByRole("alert"))).toHaveTextContent(
      "Your views did not load.",
    );
    fireEvent.click(within(panel).getByRole("button", { name: "Try again" }));

    expect(await settle(() => within(panel).getByText("Mine"))).toBeInTheDocument();
  });

  it("marks the team or saved view the list is showing", async () => {
    render(
      <Harness port={fakePort([view("a", "Mine", "q=mine")])} currentQuery="status=refunded" />,
    );

    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(within(nav).getByRole("link", { name: "Refunded" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  describe("renaming from the keyboard", () => {
    it("saves on Enter and shows the new name", async () => {
      const port = fakePort([view("a", "Mine")]);
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Rename Mine" })),
      );

      const input = within(panel).getByRole("textbox", { name: "Rename Mine" });
      expect(input).toHaveFocus();
      fireEvent.change(input, { target: { value: "Mine, renamed" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);

      expect(
        await settle(() => within(panel).getByRole("link", { name: "Mine, renamed" })),
      ).toBeInTheDocument();
      expect(port.rename).toHaveBeenCalledWith("a", "Mine, renamed");
    });

    it("cancels on Escape without closing the panel", async () => {
      const port = fakePort([view("a", "Mine")]);
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Rename Mine" })),
      );

      fireEvent.keyDown(within(panel).getByRole("textbox", { name: "Rename Mine" }), {
        key: "Escape",
      });

      expect(within(panel).getByRole("link", { name: "Mine" })).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Views" })).toBeInTheDocument();
      expect(port.rename).not.toHaveBeenCalled();
    });

    it("reopens the field with the reason when the name is taken, and keeps the old name", async () => {
      const port = fakePort([view("a", "Mine"), view("b", "Other")]);
      port.rename.mockRejectedValueOnce(
        new SavedViewsError("duplicate", "You already have a view with that name."),
      );
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Rename Mine" })),
      );
      const input = within(panel).getByRole("textbox", { name: "Rename Mine" });
      fireEvent.change(input, { target: { value: "Other" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);

      expect(await settle(() => within(panel).getByRole("alert"))).toHaveTextContent(
        "You already have a view with that name.",
      );
      expect(within(panel).getByRole("textbox", { name: "Rename Mine" })).toHaveValue("Other");
      fireEvent.keyDown(within(panel).getByRole("textbox", { name: "Rename Mine" }), {
        key: "Escape",
      });
      expect(within(panel).getByRole("link", { name: "Mine" })).toBeInTheDocument();
    });
  });

  describe("reordering", () => {
    it("moves a view up and down with buttons, and keeps focus on the one used", async () => {
      const port = fakePort([view("a", "First"), view("b", "Second"), view("c", "Third")]);
      const panel = await openMenu(<Harness port={port} />);
      await settle(() => within(panel).getByText("Third"));

      fireEvent.click(within(panel).getByRole("button", { name: "Move Third up" }));

      await flush();
      expect(port.reorder).toHaveBeenCalledWith(["a", "c", "b"]);
      await flush();
      expect(myViews(panel).map((item) => within(item).getByRole("link").textContent)).toEqual([
        "First",
        "Third",
        "Second",
      ]);
      expect(within(panel).getByRole("button", { name: "Move Third up" })).toHaveFocus();
    });

    it("cannot move the first view up or the last view down", async () => {
      const panel = await openMenu(
        <Harness port={fakePort([view("a", "First"), view("b", "Second")])} />,
      );
      await settle(() => within(panel).getByText("Second"));

      expect(within(panel).getByRole("button", { name: "Move First up" })).toBeDisabled();
      expect(within(panel).getByRole("button", { name: "Move Second down" })).toBeDisabled();
      expect(within(panel).getByRole("button", { name: "Move First down" })).toBeEnabled();
    });

    it("puts the order back and says why when the server refuses", async () => {
      const port = fakePort([view("a", "First"), view("b", "Second")]);
      port.reorder.mockRejectedValueOnce(new Error("offline"));
      const panel = await openMenu(<Harness port={port} />);
      await settle(() => within(panel).getByText("Second"));

      fireEvent.click(within(panel).getByRole("button", { name: "Move Second up" }));

      expect(await settle(() => within(panel).getByRole("alert"))).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      expect(myViews(panel).map((item) => within(item).getByRole("link").textContent)).toEqual([
        "First",
        "Second",
      ]);
    });
  });

  describe("deleting", () => {
    it("asks first, and removes the view on confirm", async () => {
      const port = fakePort([view("a", "Mine"), view("b", "Other")]);
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Delete Mine" })),
      );

      expect(port.remove).not.toHaveBeenCalled();
      expect(within(panel).getByText("Delete “Mine”?")).toBeInTheDocument();
      fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));

      await flush();
      expect(within(panel).queryByRole("link", { name: "Mine" })).toBeNull();
      expect(port.remove).toHaveBeenCalledWith("a");
    });

    it("keeps the view when staff change their mind", async () => {
      const port = fakePort([view("a", "Mine")]);
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Delete Mine" })),
      );

      fireEvent.click(within(panel).getByRole("button", { name: "Keep" }));

      expect(within(panel).getByRole("link", { name: "Mine" })).toBeInTheDocument();
      expect(port.remove).not.toHaveBeenCalled();
    });

    it("brings the view back and says why when the server refuses", async () => {
      const port = fakePort([view("a", "Mine")]);
      port.remove.mockRejectedValueOnce(new Error("offline"));
      const panel = await openMenu(<Harness port={port} />);
      fireEvent.click(
        await settle(() => within(panel).getByRole("button", { name: "Delete Mine" })),
      );

      fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));

      expect(await settle(() => within(panel).getByRole("alert"))).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      expect(within(panel).getByRole("link", { name: "Mine" })).toBeInTheDocument();
    });
  });
});

describe("recognising the view on show", () => {
  it("matches a team view whatever the order of params or the page", () => {
    render(<Harness port={fakePort()} currentQuery="from=2026-03-03&offset=0&status=paid" />);

    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(within(nav).getByRole("link", { name: "Paid this week" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();
  });

  it("offers no Save view when only the page differs from an unfiltered list", () => {
    render(<Harness port={fakePort()} currentQuery="offset=0" />);

    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();
  });

  it("saves the filters without the page", async () => {
    const port = fakePort();
    render(<Harness port={port} currentQuery="status=draft&offset=50" />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    const dialog = await settle(() => screen.getByRole("dialog", { name: "Save view" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Drafts" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save view" }));
    await flush();

    expect(port.create).toHaveBeenCalledWith({ label: "Drafts", query: "status=draft" });
  });
});

describe("saving a view", () => {
  it("offers Save view only when the list is filtered and the filters are not already a view", () => {
    const { rerender } = render(<Harness port={fakePort()} currentQuery="" />);
    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();

    rerender(<Harness port={fakePort()} currentQuery="status=paid" />);
    expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();

    rerender(<Harness port={fakePort()} currentQuery="status=refunded" />);
    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();
  });

  it("saves the current filters under the name given", async () => {
    const port = fakePort();
    render(<Harness port={port} currentQuery="status=paid&q=ada" />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    const dialog = await settle(() => screen.getByRole("dialog", { name: "Save view" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Ada's orders" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save view" }));

    await flush();
    expect(port.create).toHaveBeenCalledWith({
      label: "Ada's orders",
      query: "status=paid&q=ada",
    });
    // The saved view is now the one on show, so it is the active tab and Save view goes away.
    expect(
      within(screen.getByRole("navigation", { name: "Views" })).getByRole("link", {
        name: "Ada's orders",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();
  });

  it("will not save without a name", async () => {
    render(<Harness port={fakePort()} currentQuery="status=paid" />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    const dialog = await settle(() => screen.getByRole("dialog", { name: "Save view" }));

    expect(within(dialog).getByRole("button", { name: "Save view" })).toBeDisabled();
  });

  it("reopens the dialog with the reason and the name kept when the server refuses", async () => {
    const port = fakePort([view("a", "Paid")]);
    port.create.mockRejectedValueOnce(
      new SavedViewsError("duplicate", "You already have a view with that name."),
    );
    render(<Harness port={port} currentQuery="status=paid&q=ada" />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    const dialog = await settle(() => screen.getByRole("dialog", { name: "Save view" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Paid" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save view" }));

    const again = await settle(() => screen.getByText("You already have a view with that name."));
    expect(again).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Paid");
  });
});
