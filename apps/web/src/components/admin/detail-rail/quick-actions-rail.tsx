"use client";

import { RailSection } from "@/components/admin/detail-rail/rail-section";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";

export type QuickActionItem = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  icon?: ReactNode;
};

type Props = {
  actions: readonly QuickActionItem[];
  title?: string;
};

/** Primary / secondary / destructive quick actions stacked for the detail rail. */
export function QuickActionsRail({ actions, title = "Quick actions" }: Props) {
  if (actions.length === 0) return null;

  const primary = actions.filter((a) => a.variant === "default" || !a.variant);
  const secondary = actions.filter(
    (a) => a.variant === "secondary" || a.variant === "outline" || a.variant === "ghost",
  );
  const destructive = actions.filter((a) => a.variant === "destructive");

  const renderButton = (action: QuickActionItem) => {
    const variant = action.variant ?? "outline";
    if (action.href) {
      return (
        <Button
          key={action.id}
          variant={variant}
          size="sm"
          className="w-full justify-start"
          asChild
          disabled={action.disabled}
        >
          <a href={action.href}>
            {action.icon}
            {action.label}
          </a>
        </Button>
      );
    }
    return (
      <Button
        key={action.id}
        type="button"
        variant={variant}
        size="sm"
        className="w-full justify-start"
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.icon}
        {action.label}
      </Button>
    );
  };

  return (
    <RailSection title={title}>
      <div className="flex flex-col gap-2">
        {primary.map(renderButton)}
        {secondary.map(renderButton)}
        {destructive.length > 0 ? (
          <div className="border-t border-border-hairline pt-2">
            {destructive.map(renderButton)}
          </div>
        ) : null}
      </div>
    </RailSection>
  );
}
