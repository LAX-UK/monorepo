import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export type DashboardErrorAlertProps = {
  title?: string;
  message: string;
  /** Optional retry control (e.g. `<form action={...}>` or client button). */
  children?: ReactNode;
};

/** Inline recoverable error for dashboard slices (SSR + client). */
export function DashboardErrorAlert({
  title = "Something went wrong",
  message,
  children,
}: DashboardErrorAlertProps) {
  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-on-surface">
        <span>{message}</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}
