"use client";

import type { LinkComponent } from "@auction/ui/lax";
import type { LucideIcon } from "lucide-react";
import { Ellipsis } from "lucide-react";
import * as React from "react";
import { type StaffPermission, usePermittedItems } from "../access/staff-access.js";
import { useTableSelectionActive } from "../data/bulk-action-bar.js";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";

export type OverflowAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Disables the action and says why: "Refunds open once payment settles". */
  disabledReason?: string;
  /** Its keyboard shortcut, shown right-aligned: "e". */
  shortcut?: string;
  /** What the action needs; left out for people who may never take it. */
  requires?: StaffPermission;
};

/**
 * "More actions" for a page, a row or a panel: secondary and destructive actions out of the way
 * of the primary one. Destructive actions are listed last, after a separator. Inside a table
 * with rows selected, a row's menu steps aside so only the bulk actions are on offer.
 */
export function OverflowMenu({
  actions,
  label = "More actions",
  Link,
  size = "icon-md",
}: {
  actions: readonly OverflowAction[];
  label?: string;
  Link?: LinkComponent;
  size?: "icon-xs" | "icon-sm" | "icon-md";
}) {
  const selectionActive = useTableSelectionActive();
  const permitted = usePermittedItems(actions);
  if (permitted.length === 0) return null;
  const regular = permitted.filter((action) => action.tone !== "danger");
  const danger = permitted.filter((action) => action.tone === "danger");
  const render = (action: OverflowAction) => {
    const Icon = action.icon;
    const content = (
      <>
        {Icon ? <Icon aria-hidden /> : null}
        {action.label}
      </>
    );
    if (action.href && Link) {
      return (
        <StaffMenuItem
          key={action.id}
          asChild
          disabled={Boolean(action.disabled || action.disabledReason)}
        >
          <Link href={action.href}>{content}</Link>
        </StaffMenuItem>
      );
    }
    return (
      <StaffMenuItem
        key={action.id}
        tone={action.tone ?? "default"}
        disabled={action.disabled ?? false}
        {...(action.disabledReason ? { disabledReason: action.disabledReason } : {})}
        {...(action.shortcut ? { shortcut: action.shortcut } : {})}
        {...(action.onSelect ? { onSelect: action.onSelect } : {})}
      >
        {content}
      </StaffMenuItem>
    );
  };
  const variant = size === "icon-md" ? "secondary" : "ghost";
  if (selectionActive) {
    return (
      <StaffButton
        variant={variant}
        size={size}
        aria-label={label}
        disabledReason="Clear the selection to use this row's actions"
      >
        <Ellipsis aria-hidden />
      </StaffButton>
    );
  }
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton variant={variant} size={size} aria-label={label}>
          <Ellipsis aria-hidden />
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent>
        {regular.map(render)}
        {regular.length > 0 && danger.length > 0 ? <StaffMenuSeparator /> : null}
        {danger.map((action) => (
          <React.Fragment key={action.id}>{render(action)}</React.Fragment>
        ))}
      </StaffMenuContent>
    </StaffMenu>
  );
}
