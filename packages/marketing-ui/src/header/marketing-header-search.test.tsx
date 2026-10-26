import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingHeaderSearch } from "./marketing-header-search.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const KEY = "test:recent-searches";

function renderSearch() {
  render(
    <MarketingHeaderSearch
      action="/search"
      recentStorageKey={KEY}
      suggestions={[
        { label: "Frida Kahlo", href: "/artists/frida-kahlo" },
        { label: "Pablo Picasso", href: "/artists/pablo-picasso" },
      ]}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Search" });
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: "Search" }) };
}

// Node's own Web Storage shadows jsdom's, so tests use an in-memory store.
function stubStorage(setItem?: () => void) {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem:
      setItem ??
      ((key: string, value: string) => {
        store.set(key, value);
      }),
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
}

describe("MarketingHeaderSearch", () => {
  beforeEach(() => {
    stubStorage();
    push.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the shelf opening and closing so the header can turn solid", () => {
    const onOpenChange = vi.fn();
    render(
      <MarketingHeaderSearch action="/search" recentStorageKey={KEY} onOpenChange={onOpenChange} />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("lightens the placeholder on the on-dark tone so it reads over a hero", () => {
    render(<MarketingHeaderSearch action="/search" recentStorageKey={KEY} headerTone="on-dark" />);
    expect(screen.getByText("Search")).toHaveClass("text-hero-foreground");
  });

  it("opens a search shelf with the input focused and closes on Escape, restoring focus", () => {
    const { trigger, dialog } = renderSearch();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("textbox", { name: "Search" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("submits to the results route and remembers the query first, capped at five", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["a", "b", "c", "d", "e"]));
    const { dialog } = renderSearch();
    const input = within(dialog).getByRole("textbox", { name: "Search" });
    fireEvent.change(input, { target: { value: "  Rothko " } });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Search" }));

    expect(push).toHaveBeenCalledWith("/search?q=Rothko");
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toEqual([
      "Rothko",
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not submit an empty query", () => {
    const { dialog } = renderSearch();
    fireEvent.submit(within(dialog).getByRole("form", { name: "Search" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("lists recent searches before suggestions, with remove and clear all", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["Hockney", "Kusama"]));
    const { dialog } = renderSearch();
    const titles = within(dialog)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Recent searches", "Suggested"]);
    expect(within(dialog).getByRole("link", { name: "Hockney" })).toHaveAttribute(
      "href",
      "/search?q=Hockney",
    );
    expect(within(dialog).getByRole("link", { name: "Frida Kahlo" })).toHaveAttribute(
      "href",
      "/artists/frida-kahlo",
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Hockney from recent searches" }),
    );
    expect(within(dialog).queryByRole("link", { name: "Hockney" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toEqual(["Kusama"]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(within(dialog).queryByRole("heading", { name: "Recent searches" })).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("filters suggestions as the user types and clears the field before closing", () => {
    const { dialog } = renderSearch();
    const input = within(dialog).getByRole("textbox", { name: "Search" });
    fireEvent.change(input, { target: { value: "frida" } });
    expect(within(dialog).getByRole("link", { name: "Frida Kahlo" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Pablo Picasso" })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still works when storage throws or holds junk", () => {
    window.localStorage.setItem(KEY, "{not json");
    const { dialog } = renderSearch();
    expect(within(dialog).queryByRole("heading", { name: "Recent searches" })).toBeNull();

    stubStorage(() => {
      throw new Error("quota");
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "Bacon" },
    });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/search?q=Bacon");
  });
});

describe("MarketingHeaderSearch live results", () => {
  const groups = [
    {
      id: "editions",
      title: "Editions",
      items: [
        {
          id: "a",
          label: "Warm Basket",
          detail: "Emmett King",
          href: "/artworks/a",
          imageUrl: null,
        },
        { id: "b", label: "Blue Hour", detail: "Emmett King", href: "/artworks/b", imageUrl: null },
      ],
    },
    {
      id: "artists",
      title: "Artists",
      items: [{ id: "c", label: "Emmett King", href: "/artists/c" }],
    },
  ];

  beforeEach(() => {
    stubStorage();
    push.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openWithResults(loadResults = vi.fn().mockResolvedValue(groups)) {
    render(
      <MarketingHeaderSearch
        action="/artworks"
        recentStorageKey={KEY}
        placeholder="Search editions and artists"
        loadResults={loadResults}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Search editions and artists" }));
    const input = screen.getByRole("combobox", { name: "Search editions and artists" });
    fireEvent.change(input, { target: { value: "em" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    return { input, loadResults };
  }

  it("waits for two characters, then lists results grouped by kind with a search-all option", async () => {
    const { input, loadResults } = await openWithResults();
    expect(loadResults).toHaveBeenCalledTimes(1);
    expect(loadResults.mock.calls[0]?.[0]).toBe("em");
    expect(input).toHaveAttribute("aria-expanded", "true");

    const listbox = screen.getByRole("listbox", { name: "Search suggestions" });
    const groupNames = within(listbox)
      .getAllByRole("group")
      .map((group) => document.getElementById(group.getAttribute("aria-labelledby") ?? ""))
      .map((title) => title?.textContent);
    expect(groupNames).toEqual(["Editions", "Artists"]);
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual([
      "Warm Basket, Emmett King",
      "Blue Hour, Emmett King",
      "Emmett King",
      "See all results for “em”",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("2 editions and 1 artist");
  });

  it("moves through the options with the arrow keys and opens the active one on Enter", async () => {
    const { input } = await openWithResults();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getByRole("option", { name: "Blue Hour, Emmett King" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", active.id);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "See all results for “em”" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/artworks/a");
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toEqual(["em"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a result on click, and Enter with no option chosen runs the full search", async () => {
    await openWithResults();
    fireEvent.click(screen.getByRole("option", { name: "Emmett King" }));
    expect(push).toHaveBeenCalledWith("/artists/c");

    push.mockReset();
    fireEvent.click(screen.getByRole("button", { name: "Search editions and artists" }));
    const input = screen.getByRole("combobox", { name: "Search editions and artists" });
    fireEvent.change(input, { target: { value: "em" } });
    fireEvent.submit(screen.getByRole("form", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/artworks?q=em");
  });

  it("says when nothing matches or suggestions fail, and still offers the full search", async () => {
    await openWithResults(
      vi.fn().mockResolvedValue([{ id: "editions", title: "Editions", items: [] }]),
    );
    expect(screen.getByRole("status")).toHaveTextContent("No matches for “em”.");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    cleanup();

    await openWithResults(vi.fn().mockRejectedValue(new Error("offline")));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Suggestions are unavailable. Press Enter to search.",
    );
    expect(screen.getByRole("option", { name: "See all results for “em”" })).toBeInTheDocument();
  });

  it("on phones opens from an icon as a modal sheet that keeps focus inside", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    render(
      <MarketingHeaderSearch
        action="/artworks"
        recentStorageKey={KEY}
        placeholder="Search editions and artists"
        loadResults={vi.fn().mockResolvedValue([])}
        compactBelowDesktop
      />,
    );
    const icon = screen.getByRole("button", { name: "Search" });
    fireEvent.click(icon);
    const dialog = screen.getByRole("dialog", { name: "Search" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-search-layout", "sheet");
    expect(document.documentElement.style.overflow).toBe("hidden");

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(within(dialog).getByRole("combobox")).toHaveFocus();

    fireEvent.click(cancel);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(icon).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });
});
