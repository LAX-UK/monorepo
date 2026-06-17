"use client";

import { partitionClerkConsoleAlerts } from "@/features/saleroom/lib/clerk-console-alerts";
import type { ClerkAlertDefinition } from "@/features/saleroom/types/clerk-console.types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useState } from "react";

type Props = {
  alerts: ClerkAlertDefinition[];
  registrationsHref?: string;
};

function renderAlertBody(alert: ClerkAlertDefinition, registrationsHref?: string) {
  if (alert.key === "paddles" && registrationsHref) {
    return (
      <>
        No paddles assigned yet.{" "}
        <Link href={registrationsHref} className="font-medium text-link underline">
          Check in bidders
        </Link>{" "}
        so clerks can place in-room bids.
      </>
    );
  }
  return alert.body;
}

export function ClerkConsoleAlertsPanel({ alerts, registrationsHref }: Props) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const { visible, hiddenCount } = partitionClerkConsoleAlerts(alerts, showAllAlerts);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((alert) => (
        <Alert key={alert.key} variant={alert.variant}>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{renderAlertBody(alert, registrationsHref)}</AlertDescription>
        </Alert>
      ))}
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 font-body text-sm text-secondary"
          onClick={() => setShowAllAlerts(true)}
        >
          +{hiddenCount} more alert{hiddenCount === 1 ? "" : "s"}
        </Button>
      ) : null}
    </div>
  );
}
