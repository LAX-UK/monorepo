"use client";

import type { LucideIcon } from "lucide-react";
import { Ellipsis } from "lucide-react";
import * as React from "react";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import type { StaffLinkComponent } from "./link.js";

export type OverflowAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

/**
 * "More actions" for a page, a row or a panel: secondary and destructive actions out of the way
 * of the primary one. Destructive actions are listed last, after a separator.
 */
export function OverflowMenu({
  actions,
  label = "More actions",
  Link,
  size = "icon-md",
}: {
  actions: readonly OverflowAction[];
  label?: string;
  Link?: StaffLinkComponent;
  size?: "icon-xs" | "icon-sm" | "icon-md";
}) {
  if (actions.length === 0) return null;
  const regular = actions.filter((action) => action.tone !== "danger");
  const danger = actions.filter((action) => action.tone === "danger");
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
        <StaffMenuItem key={action.id} asChild disabled={action.disabled ?? false}>
          <Link href={action.href}>{content}</Link>
        </StaffMenuItem>
      );
    }
    return (
      <StaffMenuItem
        key={action.id}
        tone={action.tone ?? "default"}
        disabled={action.disabled ?? false}
        {...(action.onSelect ? { onSelect: action.onSelect } : {})}
      >
        {content}
      </StaffMenuItem>
    );
  };
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          variant={size === "icon-md" ? "secondary" : "ghost"}
          size={size}
          aria-label={label}
        >
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
