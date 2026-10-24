// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveRailSlugs = vi.fn();
const searchEditorialLinkCandidates = vi.fn();

vi.mock("@/server/application/admin-editorial-links-actions.server", () => ({
  resolveRailSlugs,
  searchEditorialLinkCandidates,
}));

// Radix popovers run positioning loops jsdom cannot settle. This stand-in keeps the open and
// close contract, so the rail's own behaviour is what is tested.
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

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const { RailRelationFields } = await import("./rail-relation-fields.client");

const item = (slug: string, title: string) => ({
  id: `id-${slug}`,
  title,
  slug,
  thumbnailUrl: null,
  published: true,
});

function Harness({
  initial,
  kind = "artwork",
  onChange,
}: {
  initial: string[];
  kind?: "artwork" | "artist";
  onChange: (next: { headline: string; slugs: string[] }) => void;
}) {
  const [slugs, setSlugs] = React.useState(initial);
  return (
    <RailRelationFields
      kind={kind}
      headline=""
      slugs={slugs}
      disabled={false}
      onChange={(next) => {
        setSlugs(next.slugs);
        onChange(next);
      }}
    />
  );
}

const list = () => screen.getByRole("list", { name: "artworks in this rail" });
const titles = () =>
  within(list())
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span.truncate")?.textContent);

beforeEach(() => {
  resolveRailSlugs.mockReset();
  searchEditorialLinkCandidates.mockReset();
  resolveRailSlugs.mockResolvedValue({
    ok: true,
    data: [item("paper-rooms", "Paper Rooms"), item("tides", "Tides")],
  });
  searchEditorialLinkCandidates.mockResolvedValue({
    ok: true,
    data: { items: [item("embers", "Embers")], nextCursor: null },
  });
});

describe("RailRelationFields", () => {
  it("shows the names of the records a rail stores by address", async () => {
    render(<Harness initial={["paper-rooms", "tides"]} onChange={vi.fn()} />);

    await waitFor(() => expect(titles()).toEqual(["Paper Rooms", "Tides"]));
    expect(resolveRailSlugs).toHaveBeenCalledWith({
      kind: "artwork",
      slugs: ["paper-rooms", "tides"],
    });
    expect(screen.queryByRole("textbox", { name: /slugs/i })).not.toBeInTheDocument();
  });

  it("stores the addresses again, in the new order, when a record moves or goes", async () => {
    const onChange = vi.fn();
    render(<Harness initial={["paper-rooms", "tides"]} onChange={onChange} />);
    await waitFor(() => expect(titles()).toEqual(["Paper Rooms", "Tides"]));

    fireEvent.click(screen.getByRole("button", { name: "Move Tides up" }));
    expect(onChange).toHaveBeenLastCalledWith({ headline: "", slugs: ["tides", "paper-rooms"] });

    fireEvent.click(screen.getByRole("button", { name: "Remove Paper Rooms" }));
    expect(onChange).toHaveBeenLastCalledWith({ headline: "", slugs: ["tides"] });
  });

  it("adds a record picked by name and stores its address", async () => {
    const onChange = vi.fn();
    render(<Harness initial={["tides"]} onChange={onChange} />);
    await waitFor(() => expect(titles()).toEqual(["Tides"]));

    fireEvent.click(screen.getByRole("combobox", { name: "Add artwork" }));
    fireEvent.click(await screen.findByRole("option", { name: /Embers/ }));

    expect(onChange).toHaveBeenLastCalledWith({ headline: "", slugs: ["tides", "embers"] });
    await waitFor(() => expect(titles()).toEqual(["Tides", "Embers"]));
    expect(searchEditorialLinkCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "artwork" }),
    );
  });

  it("flags an address no record has any more, so it can be removed", async () => {
    resolveRailSlugs.mockResolvedValue({ ok: true, data: [item("tides", "Tides")] });
    render(<Harness initial={["tides", "retired-work"]} onChange={vi.fn()} />);

    expect(
      await screen.findByText("No record has this address any more. Remove it or replace it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove retired-work" })).toBeInTheDocument();
  });

  it("looks up each address only once as the rail changes", async () => {
    render(<Harness initial={["paper-rooms", "tides"]} onChange={vi.fn()} />);
    await waitFor(() => expect(titles()).toEqual(["Paper Rooms", "Tides"]));
    fireEvent.click(screen.getByRole("button", { name: "Move Tides up" }));
    expect(resolveRailSlugs).toHaveBeenCalledTimes(1);
  });

  it("stops at the 24 records a rail can show", async () => {
    const many = Array.from({ length: 24 }, (_, index) => `work-${index + 1}`);
    resolveRailSlugs.mockResolvedValue({ ok: true, data: many.map((slug) => item(slug, slug)) });
    render(<Harness initial={many} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Add artwork" })).toBeDisabled();
    expect(screen.getByText(/The list is full at 24 artworks/)).toBeInTheDocument();
  });
});
