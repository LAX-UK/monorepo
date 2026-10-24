// @vitest-environment jsdom
import type { RelationRow } from "@/server/domain/editorial-links.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Radix popovers run positioning loops jsdom cannot settle. This stand-in keeps the open and
// close contract, so the list's own behaviour is what is tested.
vi.mock("@auction/ui/components/popover", async () => {
  const Context = React.createContext<{ open: boolean; set: (open: boolean) => void }>({
    open: false,
    set: () => {},
  });
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <Context.Provider value={{ open: Boolean(open), set: onOpenChange ?? (() => {}) }}>
        {children}
      </Context.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const context = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => context.set(!context.open) });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      React.useContext(Context).open ? <div>{children}</div> : null,
  };
});
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));

// The search list measures itself, which jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const { RelationListEditor } = await import("./relation-list-editor.client");

const rooms: RelationRow = { id: "a", title: "Paper Rooms", subtitle: "/paper-rooms" };
const tides: RelationRow = { id: "b", title: "Tides", subtitle: "/tides" };
const embers: RelationRow = {
  id: "c",
  title: "Embers",
  subtitle: "/embers",
  notPublic: true,
};
const catalogue = [rooms, tides, embers];

function Harness({
  initial = [],
  ordered = true,
  max,
  search = async () => catalogue,
}: {
  initial?: RelationRow[];
  ordered?: boolean;
  max?: number;
  search?: (query: string) => Promise<readonly RelationRow[]>;
}) {
  const [items, setItems] = React.useState(initial);
  return (
    <RelationListEditor
      label="Artworks in this exhibition"
      plural="artworks"
      items={items}
      onChange={setItems}
      search={search}
      ordered={ordered}
      emptyText="No artworks linked yet."
      addLabel="Add artwork"
      {...(max === undefined ? {} : { max })}
    />
  );
}

const titles = () =>
  within(screen.getByRole("list", { name: "Artworks in this exhibition" }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span.truncate")?.textContent);

async function openPicker() {
  fireEvent.click(screen.getByRole("combobox", { name: "Add artwork" }));
}

describe("RelationListEditor", () => {
  it("says so when nothing is linked yet", () => {
    render(<Harness />);
    expect(screen.getByText("No artworks linked yet.")).toBeInTheDocument();
  });

  it("lists the linked records in order and moves, then removes, one by name", () => {
    render(<Harness initial={[rooms, tides, embers]} />);
    expect(titles()).toEqual(["Paper Rooms", "Tides", "Embers"]);

    fireEvent.click(screen.getByRole("button", { name: "Move Tides up" }));
    expect(titles()).toEqual(["Tides", "Paper Rooms", "Embers"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Paper Rooms" }));
    expect(titles()).toEqual(["Tides", "Embers"]);
  });

  it("cannot move the first record up or the last record down", () => {
    render(<Harness initial={[rooms, tides]} />);
    expect(screen.getByRole("button", { name: "Move Paper Rooms up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Tides down" })).toBeDisabled();
  });

  it("offers no reordering where the order is not stored", () => {
    render(<Harness initial={[rooms, tides]} ordered={false} />);
    expect(screen.queryByRole("button", { name: /Move/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Tides" })).toBeInTheDocument();
  });

  it("flags a record the public site cannot show", () => {
    render(<Harness initial={[embers]} />);
    expect(within(screen.getByRole("listitem")).getByText("Not public")).toBeInTheDocument();
  });

  it("adds a record found by name, with its address to tell it apart", async () => {
    const search = vi.fn(async () => catalogue);
    render(<Harness search={search} />);

    await openPicker();
    const option = await screen.findByRole("option", { name: /Tides/ });
    expect(option).toHaveTextContent("/tides");
    expect(search).toHaveBeenCalledWith("");

    fireEvent.click(option);
    await waitFor(() => expect(titles()).toEqual(["Tides"]));
  });

  it("shows a record already in the list as added and will not add it twice", async () => {
    render(<Harness initial={[rooms]} />);
    await openPicker();
    const added = await screen.findByRole("option", { name: /Paper Rooms/ });
    expect(added).toHaveAttribute("aria-disabled", "true");
    expect(added).toHaveTextContent("Added");

    fireEvent.click(added);
    expect(titles()).toEqual(["Paper Rooms"]);
  });

  it("stops adding once the list is full and says why", () => {
    render(<Harness initial={[rooms, tides]} max={2} />);
    expect(screen.getByRole("combobox", { name: "Add artwork" })).toBeDisabled();
    expect(
      screen.getByText("The list is full at 2 artworks. Remove one to add another."),
    ).toBeInTheDocument();
  });
});
