/*
 * Test helpers for lists whose rows open their record's page (DataTable `rowHref`): a stand-in
 * for `next/link` that records visits, and checks for what a row click, a modified click, the
 * middle button and Enter do. Use with
 *
 *     vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
 */
import { fireEvent, screen, within } from "@testing-library/react";
import type * as React from "react";
import { expect, vi } from "vitest";

/** Every client-side visit a `next/link` made in this test file. */
export const visits = vi.fn<(href: string) => void>();

/** Before each test: no visits yet, and no row marked in history from an earlier test. */
export function resetRowLinks() {
  visits.mockClear();
  window.history.replaceState(null, "");
}

/** `next/link` as a plain anchor: a plain left click is a visit; the rest stays the browser's. */
export function nextLinkMock() {
  function Link({
    href,
    onClick,
    children,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    ...rest
  }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string | { pathname?: string };
    prefetch?: unknown;
    replace?: unknown;
    scroll?: unknown;
  }) {
    const target = typeof href === "string" ? href : (href.pathname ?? "");
    return (
      <a
        href={target}
        {...rest}
        onClick={(event) => {
          onClick?.(event);
          const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
          if (event.defaultPrevented || modified || event.button !== 0) return;
          event.preventDefault();
          visits(target);
        }}
      >
        {children}
      </a>
    );
  }
  return { __esModule: true, default: Link };
}

/** The table row (or phone card) that holds a link with this name. */
export function rowOf(name: string | RegExp): HTMLElement {
  const link = screen.getAllByRole("link", { name })[0];
  const row = link?.closest("tr, li");
  if (!row) throw new Error(`No row for ${String(name)}`);
  return row as HTMLElement;
}

/**
 * The row behaves as a link to `href`: its title is a real link, a click on the row (outside its
 * other links and buttons) visits it, Enter visits it, and Cmd- or Ctrl-click and the middle
 * button open it in a new tab without leaving the list.
 */
export function expectRowOpensPage({
  title,
  href,
  background,
}: {
  /** The title link's accessible name. */
  title: string | RegExp;
  href: string;
  /** Text in a cell that is not a link: where a click on the row's background lands. */
  background: string | RegExp;
}) {
  const row = rowOf(title);
  const link = within(row).getAllByRole("link", { name: title })[0] as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe(href);

  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  try {
    visits.mockClear();
    fireEvent.click(within(row).getByText(background));
    expect(visits).toHaveBeenLastCalledWith(href);

    visits.mockClear();
    fireEvent.click(link);
    expect(visits).toHaveBeenLastCalledWith(href);

    visits.mockClear();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(visits).toHaveBeenLastCalledWith(href);

    visits.mockClear();
    fireEvent.click(within(row).getByText(background), { metaKey: true });
    fireEvent.click(within(row).getByText(background), { ctrlKey: true });
    fireEvent(
      within(row).getByText(background),
      new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }),
    );
    expect(open).toHaveBeenCalledTimes(3);
    for (const call of open.mock.calls) expect(call.slice(0, 2)).toEqual([href, "_blank"]);
    expect(visits).not.toHaveBeenCalled();

    // A modified click on the title link itself is the browser's: no visit in this tab. (The
    // browser's own new tab is stopped here, after the app has seen the click: jsdom has none.)
    const noBrowserNavigation = (event: Event) => event.preventDefault();
    window.addEventListener("click", noBrowserNavigation);
    try {
      fireEvent.click(link, { metaKey: true });
    } finally {
      window.removeEventListener("click", noBrowserNavigation);
    }
    expect(visits).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
    window.history.replaceState(null, "");
  }
}
