import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export type DashboardErrorAlertProps = {
  title?: string;
  message: string;
  /** Optional retry control (e.g. `<form action={...}>` or client button). */
  children?: ReactNode;
  role?: "alert" | "status";
  "aria-live"?: "polite" | "assertive" | "off";
};

/** Inline recoverable error for dashboard slices (SSR + client). */
export function DashboardErrorAlert({
  title = "Something went wrong",
  message,
  children,
  role,
  "aria-live": ariaLive,
}: DashboardErrorAlertProps) {
  return (
    <Alert
      variant="destructive"
      className="border-destructive/40 bg-destructive/5"
      {...(role ? { role } : {})}
      {...(ariaLive ? { "aria-live": ariaLive } : {})}
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-on-surface">
        <span>{message}</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}
