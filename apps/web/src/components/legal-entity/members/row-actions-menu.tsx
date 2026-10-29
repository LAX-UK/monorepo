"use client";

import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Fragment } from "react";

export type RowAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Ends something; drawn in the error colour after a separator. */
  destructive?: boolean;
};

type Props = {
  /** "More for Lena Fischer". */
  label: string;
  actions: readonly RowAction[];
};

/**
 * The "…" menu at the end of a team row. Choosing an item closes the menu first and then runs
 * the action on the next frame, so a dialog it opens takes focus cleanly and hands it back to
 * this trigger when it closes. Destructive items come last, after a separator.
 *
 * Temporary: this stands in for the kit's `InlineActionMenu`, which keeps its menu open after a
 * choice and draws destructive items in a red that fails contrast. Replace it with
 * `InlineActionMenu` once the kit menu closes on select and uses the error token.
 */
export function RowActionsMenu({ label, actions }: Props) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label} className="md:size-10">
          <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action, index) => (
          <Fragment key={action.label}>
            {action.destructive && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              {...(action.disabled ? { disabled: true } : {})}
              className={action.destructive ? "text-error focus:text-error" : undefined}
              onSelect={() => requestAnimationFrame(action.onSelect)}
            >
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
