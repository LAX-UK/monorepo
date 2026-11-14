import { fireEvent, screen, within } from "@testing-library/react";

/**
 * Reading a work queue's panel (`DetailPanel` with `queue`) in a list test: the panel, its title,
 * its place ("3 of 12") and a J or K press.
 */
export const queuePanel = {
  /** The open panel, or null. */
  get: (): HTMLElement | null => screen.queryByRole("dialog"),
  /** The open panel's title heading. */
  title: (name: string): HTMLElement =>
    within(screen.getByRole("dialog")).getByRole("heading", { name, level: 2 }),
  /** "3 of 12", without the screen-reader suffix. */
  position: (): string | undefined =>
    document
      .querySelector("[data-staff-queue-position]")
      ?.textContent?.replace(/\s*in this queue$/, "")
      .replace(/\s+/g, " ")
      .trim(),
  /** The row that has focus, by its text. */
  focusedRowText: (): string | undefined =>
    document.activeElement?.closest("tr")?.textContent ?? undefined,
  /** Opens the panel's `…` menu (the other records and actions) and returns it. */
  openMenu: (): ReturnType<typeof within> => {
    const trigger = within(screen.getByRole("dialog")).getByRole("button", {
      name: /^(More|Request) .*actions/,
    });
    fireEvent.keyDown(trigger, { key: "Enter" });
    return within(screen.getByRole("menu"));
  },
};
