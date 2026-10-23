import { fireEvent, render, screen, within } from "@testing-library/react";
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
