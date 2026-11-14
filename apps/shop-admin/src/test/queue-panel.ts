import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, vi } from "vitest";

/** One row of a queue as the test sees it: its title link's name, panel title and record id. */
export type QueueRecord = { link: string | RegExp; panel: string | RegExp; id: string };

const address = () => `${window.location.pathname}${window.location.search}`;

function titleLink(grid: string, link: string | RegExp): HTMLElement {
  return within(screen.getByRole("grid", { name: grid })).getByRole("link", { name: link });
}

function positionOf(panel: HTMLElement): HTMLElement {
  const position = panel.querySelector<HTMLElement>("[data-staff-queue-position]");
  if (!position) throw new Error("The panel shows no place in the queue");
  return position;
}

/**
 * A work queue's panel, as every LAX Admin queue keeps it (staff design standard, PRD-7): a row
 * opens the panel with the record in the URL and a history entry, the panel shows its place,
 * J steps on and K back without closing or adding entries, Esc closes it by stepping back over
 * its entry and puts focus on the row of the record last shown, and Back closes it.
 *
 * Renders nothing itself: call it after rendering the list at `path` (no panel open).
 */
export async function expectQueuePanel({
  grid,
  path,
  param,
  first,
  second,
  total,
}: {
  /** The table's accessible name. */
  grid: string;
  /** The list's address before any panel opens, e.g. "/payouts". */
  path: string;
  param: string;
  /** Two records next to each other in the list, in its order. */
  first: QueueRecord;
  second: QueueRecord;
  /** How many rows the list shows. */
  total: number;
}): Promise<void> {
  const push = vi.spyOn(window.history, "pushState");
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  try {
    const link = titleLink(grid, first.link);
    link.focus();
    fireEvent.click(link);
    let panel = await screen.findByRole("dialog", { name: first.panel });
    expect(address()).toBe(`${path}${path.includes("?") ? "&" : "?"}${param}=${first.id}`);
    expect(push).toHaveBeenCalledTimes(1);
    const firstPlace = Number(positionOf(panel).textContent?.match(/^(\d+)/)?.[1]);
    expect(positionOf(panel)).toHaveTextContent(`${firstPlace} of ${total} in this queue`);

    // J: the next record, in place, with no new history entry.
    fireEvent.keyDown(panel, { key: "j" });
    panel = await screen.findByRole("dialog", { name: second.panel });
    expect(address()).toContain(`${param}=${second.id}`);
    expect(positionOf(panel)).toHaveTextContent(`${firstPlace + 1} of ${total}`);
    // K: back again.
    fireEvent.keyDown(panel, { key: "k" });
    panel = await screen.findByRole("dialog", { name: first.panel });
    fireEvent.keyDown(panel, { key: "j" });
    panel = await screen.findByRole("dialog", { name: second.panel });
    expect(push).toHaveBeenCalledTimes(1);

    // Esc: steps back over the panel's history entry; focus goes to the record last shown.
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(back).toHaveBeenCalledTimes(1);
    const row = titleLink(grid, second.link).closest("tr");
    await waitFor(() => expect(row).toHaveFocus());
  } finally {
    push.mockRestore();
    back.mockRestore();
  }
  // What the browser does on that step back, and on the phone's back gesture.
  act(() => {
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
}

/** Back (or the phone's back gesture) with a queue panel open closes the panel, not the list. */
export async function expectBackCloses({
  grid,
  path,
  record,
}: {
  grid: string;
  path: string;
  record: QueueRecord;
}): Promise<void> {
  fireEvent.click(titleLink(grid, record.link));
  await screen.findByRole("dialog", { name: record.panel });
  act(() => {
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(address()).toBe(path);
}
