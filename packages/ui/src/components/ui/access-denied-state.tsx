import type * as React from "react";
import { EmptyState } from "./empty-state.js";

export type AccessDeniedStateProps = {
  /**
   * What the person tried to open, as it reads in a sentence: "Payouts", "this consignment".
   * Leave it out when the page cannot be named.
   */
  page?: string | null;
  /**
   * Who can open it, from the product's capability table: "Owners, admins and finance". The
   * line then reads "Owners, admins and finance can open it."
   */
  openedBy?: string | null;
  /**
   * Why, when it is not about a role ("This page belongs to an account you aren't using.").
   * Replaces the line built from `openedBy`.
   */
  reason?: React.ReactNode;
  /** The way on: "Back to Home" first, then at most one more ("Switch account"). */
  actions?: React.ReactNode;
  /** `page` replaces the page's content; `panel` sits inside a page, under its tabs. */
  size?: "page" | "panel";
  headingLevel?: "h1" | "h2";
  className?: string;
};

/** "You don't have access to Payouts", or "You don't have access" when the page has no name. */
export function accessDeniedTitle(page?: string | null): string {
  return page ? `You don't have access to ${page}` : "You don't have access";
}

/** "Owners, admins and finance can open it. Ask one of them if you need something here." */
export function accessDeniedLine(openedBy: string): string {
  return `${openedBy} can open it. Ask one of them if you need something here.`;
}

/**
 * The page a person reaches without the right to open it. It names the page and who can open
 * it, and offers a way back, so a refused link is never a dead end, a 404 or a raw error.
 */
export function AccessDeniedState({
  page,
  openedBy,
  reason,
  actions,
  size = "page",
  headingLevel = size === "page" ? "h1" : "h2",
  className,
}: AccessDeniedStateProps) {
  const description = reason ?? (openedBy ? accessDeniedLine(openedBy) : undefined);
  return (
    <EmptyState
      size={size}
      variant="plain"
      headingLevel={headingLevel}
      illustration="lock"
      title={accessDeniedTitle(page)}
      {...(description ? { description } : {})}
      {...(actions
        ? {
            action: (
              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                {actions}
              </div>
            ),
          }
        : {})}
      {...(className ? { className } : {})}
    />
  );
}
