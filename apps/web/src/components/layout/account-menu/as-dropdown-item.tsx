import type { WrapItem } from "@/components/layout/account-switcher/account-switcher-list";
import { DropdownMenuItem } from "@auction/ui/components/dropdown-menu";

const ITEM_CLASS = "block cursor-pointer rounded-md p-0 focus:bg-transparent";

/**
 * Each row of the account dropdown becomes a Radix item, so arrow keys and typeahead work. A row
 * that asks to `keepOpen` (choosing an account) holds the menu open, so "Switching…" and a
 * failure with "Try again" stay in view instead of vanishing with the menu.
 */
export const asDropdownItem: WrapItem = (row, options) => (
  <DropdownMenuItem
    asChild
    className={ITEM_CLASS}
    {...(options?.keepOpen ? { onSelect: (event: Event) => event.preventDefault() } : {})}
  >
    {row}
  </DropdownMenuItem>
);
