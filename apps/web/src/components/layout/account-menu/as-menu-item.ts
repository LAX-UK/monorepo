import type { WrapItem } from "@/components/layout/account-switcher/account-switcher-list";
import { cloneElement } from "react";

/**
 * Makes a row an item of a hand-built `role="menu"` (the workspace menu), as `asDropdownItem` does
 * for a Radix dropdown: the row gets the menu item role and the marker the menu's own arrow keys
 * look for. A row that asks to `keepOpen` needs nothing more, since this menu only closes when it
 * is told to.
 */
export const asMenuItem: WrapItem = (row) =>
  cloneElement(row, { role: "menuitem", "data-account-menu-item": "" } as Record<string, string>);
