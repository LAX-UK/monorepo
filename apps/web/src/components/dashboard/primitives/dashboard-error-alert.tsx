import {
  Alert,
  AlertDescription,
  AlertTitle,
  type AlertTitleLevel,
} from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export type DashboardErrorAlertProps = {
  /** What failed, in the surface's own words: "Your documents couldn't be loaded". */
  title: string;
  /**
   * The title's heading level where the alert sits: h2 directly under the page title (the
   * default), h3 inside a section that has its own h2. Never skip a level.
   */
  headingLevel?: AlertTitleLevel;
  message: string;
  /** Optional retry control (e.g. `<form action={...}>` or client button). */
  children?: ReactNode;
  role?: "alert" | "status";
  "aria-live"?: "polite" | "assertive" | "off";
};

/**
 * Inline recoverable error for dashboard slices (SSR + client), on the danger tokens the notices
 * use: a tinted card with a visible edge, the title in the danger text colour (AA on the tint in
 * both themes) and the explanation in body text.
 */
export function DashboardErrorAlert({
  title,
  headingLevel = "h2",
  message,
  children,
  role,
  "aria-live": ariaLive,
}: DashboardErrorAlertProps) {
  return (
    <Alert
      variant="destructive"
      className="border-lax-danger/30 bg-lax-danger-bg text-lax-danger-fg"
      {...(role ? { role } : {})}
      {...(ariaLive ? { "aria-live": ariaLive } : {})}
    >
      <AlertTitle as={headingLevel} className="font-semibold">
        {title}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-lax-fg">
        <span>{message}</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}
