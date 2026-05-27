"use client";

import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { usePersonalProfileForSubmissions } from "@/lib/legal-entity/submissions-access-actions";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type DashboardSliceErrorAlertProps = {
  failure: DashboardSliceFailure;
};

/** Actionable inline error for dashboard slice load failures (SSR + client). */
export function DashboardSliceErrorAlert({ failure }: DashboardSliceErrorAlertProps) {
  return (
    <DashboardErrorAlert title={failure.title} message={failure.message}>
      <div className="flex flex-wrap gap-3">
        {failure.actions.map((action) => {
          if (action.kind === "use_personal_profile") {
            return (
              <form key={action.kind} action={usePersonalProfileForSubmissions}>
                <Button type="submit" variant="primary">
                  {action.label}
                </Button>
              </form>
            );
          }
          if (action.href) {
            const variant =
              action.kind === "support" || action.kind === "navigate" ? "secondary" : "primary";
            return (
              <Button key={`${action.kind}-${action.href}`} variant={variant} asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            );
          }
          return null;
        })}
      </div>
    </DashboardErrorAlert>
  );
}
