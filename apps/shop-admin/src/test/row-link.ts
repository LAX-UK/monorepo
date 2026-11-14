import { fireEvent, within } from "@testing-library/react";
import { expect, vi } from "vitest";

/** A cell of the row with nothing to click in it, so a click there is a click on the row. */
function plainCell(row: HTMLElement): HTMLElement {
  const cell = [...row.querySelectorAll<HTMLElement>("td")].find(
    (candidate) =>
      !candidate.hasAttribute("data-staff-select-cell") &&
      !candidate.querySelector("a,button,input,[role=menuitem]"),
  );
  if (!cell) throw new Error("The row has no plain cell to click");
  return cell;
}

/** The table row (not the phone card) whose text includes `text`. */
export function tableRowOf(text: string): HTMLElement {
  const row = [...document.querySelectorAll<HTMLElement>("tr")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!row) throw new Error(`No table row with “${text}”`);
  return row;
}

/**
 * The row opens `href`, the record's page, the way every list does (staff design standard
 * TBL-8): its title is a real link to it, a click anywhere on the row follows that link, and
 * Cmd-click, Ctrl-click and the middle button open it in a new tab instead.
 */
export function expectRowOpens(row: HTMLElement, href: string): void {
  const link = within(row)
    .getAllByRole("link")
    .find((anchor) => anchor.getAttribute("href") === href);
  expect(link, `a link to ${href} in the row`).toBeDefined();

  const followed: string[] = [];
  link?.addEventListener("click", (event) => {
    event.preventDefault();
    followed.push((event.currentTarget as HTMLAnchorElement).getAttribute("href") ?? "");
  });
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  try {
    const cell = plainCell(row);
    fireEvent.click(cell);
    expect(followed).toEqual([href]);

    fireEvent.click(cell, { metaKey: true });
    fireEvent.click(cell, { ctrlKey: true });
    fireEvent(cell, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(open.mock.calls).toEqual([
      [href, "_blank", "noopener"],
      [href, "_blank", "noopener"],
      [href, "_blank", "noopener"],
    ]);
    // A new tab leaves the list where it is.
    expect(followed).toEqual([href]);
  } finally {
    open.mockRestore();
  }
}
