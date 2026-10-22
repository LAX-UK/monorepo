import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { type RelationItem, RelationPicker, type RelationPickerProps } from "./relation-picker.js";

const rooms: RelationItem = { id: "a", title: "Paper Rooms", subtitle: "Ada Lee" };
const tides: RelationItem = { id: "b", title: "Tides", thumbnailUrl: "/tides.jpg" };
const embers: RelationItem = { id: "c", title: "Embers", draft: true };
const catalogue = [rooms, tides, embers];

type Search = RelationPickerProps<RelationItem>["search"];

function Harness({
  initial = [],
  search,
  ordered,
}: {
  initial?: RelationItem[];
  search?: Search;
  ordered?: boolean;
}) {
  const [items, setItems] = React.useState(initial);
  const lookup: Search = search ?? (async () => ({ items: catalogue, nextCursor: null }));
  return (
    <RelationPicker
      label="Artworks"
      items={items}
      onChange={setItems}
      search={lookup}
      {...(ordered === undefined ? {} : { ordered })}
    />
  );
}

const rowTitles = () =>
  within(screen.getByRole("list", { name: "Artworks" }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span.truncate")?.textContent);

describe("RelationPicker", () => {
  it("adds a result from the keyboard and keeps the search open for the next one", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search to add: Artworks" });
    fireEvent.focus(input);
    await screen.findByRole("option", { name: /Paper Rooms/ });

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("Added");
    expect(screen.getByRole("option", { name: /Tides/ })).toBeInTheDocument();
  });

  it("marks linked results and does not add them twice", async () => {
    render(<Harness initial={[rooms]} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /Search to add/ }));
    const linked = await screen.findByRole("option", { name: /Paper Rooms/ });

    expect(linked).toHaveAttribute("aria-disabled", "true");
    expect(linked).toHaveTextContent("Added");
    fireEvent.click(linked);
    expect(rowTitles()).toEqual(["Paper Rooms"]);
  });

  it("shows a draft badge on draft results", async () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole("combobox", { name: /Search to add/ }));
    const option = await screen.findByRole("option", { name: /Embers/ });
    expect(option).toHaveTextContent("Draft");
  });

  it("moves an item down and up, announces it and keeps focus on the pressed control", () => {
    render(<Harness initial={[rooms, tides, embers]} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Paper Rooms down" }));
    expect(rowTitles()).toEqual(["Tides", "Paper Rooms", "Embers"]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved Paper Rooms to position 2 of 3");
    expect(screen.getByRole("button", { name: "Move Paper Rooms down" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Move Paper Rooms up" }));
    expect(rowTitles()).toEqual(["Paper Rooms", "Tides", "Embers"]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved Paper Rooms to position 1 of 3");
  });

  it("moves focus to another control when the pressed one becomes disabled", () => {
    render(<Harness initial={[rooms, tides]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Tides up" }));
    expect(rowTitles()).toEqual(["Tides", "Paper Rooms"]);
    expect(screen.getByRole("button", { name: "Move Tides up" })).toBeDisabled();
    expect(screen.getByLabelText("Move Tides to position")).toHaveFocus();
  });

  it("moves to a chosen position", () => {
    render(<Harness initial={[rooms, tides, embers]} />);
    fireEvent.change(screen.getByLabelText("Move Embers to position"), { target: { value: "0" } });
    expect(rowTitles()).toEqual(["Embers", "Paper Rooms", "Tides"]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved Embers to position 1 of 3");
    expect(screen.getByLabelText("Move Embers to position")).toHaveFocus();
  });

  it("disables the edge moves", () => {
    render(<Harness initial={[rooms, tides]} />);
    expect(screen.getByRole("button", { name: "Move Paper Rooms up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Tides down" })).toBeDisabled();
  });

  it("removes an item, announces it and focuses the next row", () => {
    render(<Harness initial={[rooms, tides]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Paper Rooms" }));

    expect(rowTitles()).toEqual(["Tides"]);
    expect(screen.getByRole("status")).toHaveTextContent("Removed Paper Rooms. 1 linked.");
    expect(screen.getByRole("button", { name: "Remove Tides" })).toHaveFocus();
  });

  it("returns focus to the search box when the last item is removed", () => {
    render(<Harness initial={[rooms]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Paper Rooms" }));
    expect(screen.getByRole("combobox", { name: /Search to add/ })).toHaveFocus();
    expect(screen.getByText("Nothing linked yet.")).toBeInTheDocument();
  });

  it("hides the reorder controls when unordered", () => {
    render(<Harness initial={[rooms, tides]} ordered={false} />);
    expect(screen.queryByRole("button", { name: /Move .* (up|down)/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/to position/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Tides" })).toBeInTheDocument();
  });

  it("searches once after typing pauses, with the final text", async () => {
    const search = vi.fn<Search>(async () => ({ items: catalogue, nextCursor: null }));
    render(<Harness search={search} />);
    const input = screen.getByRole("combobox", { name: /Search to add/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "pa" } });
    fireEvent.change(input, { target: { value: "pap" } });

    await waitFor(() => expect(search).toHaveBeenCalledWith("pap", null, expect.any(AbortSignal)));
    expect(search).not.toHaveBeenCalledWith("pa", null, expect.anything());
  });

  it("aborts a search still in flight when the query changes", async () => {
    const signals: AbortSignal[] = [];
    const search: Search = (_q, _cursor, signal) => {
      signals.push(signal);
      return new Promise(() => {});
    };
    render(<Harness search={search} />);
    const input = screen.getByRole("combobox", { name: /Search to add/ });
    fireEvent.focus(input);
    await waitFor(() => expect(signals).toHaveLength(1));
    fireEvent.change(input, { target: { value: "x" } });
    expect(signals[0]?.aborted).toBe(true);
  });

  it("loads the next page", async () => {
    const search = vi.fn<Search>(async (_q, cursor) =>
      cursor ? { items: [embers], nextCursor: null } : { items: [rooms], nextCursor: "page-2" },
    );
    render(<Harness search={search} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /Search to add/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Show more results" }));

    expect(await screen.findByRole("option", { name: /Embers/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Paper Rooms/ })).toBeInTheDocument();
  });

  it("says so when the search fails", async () => {
    render(<Harness search={async () => Promise.reject(new Error("down"))} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /Search to add/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Search failed");
  });
});
