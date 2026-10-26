"use client";

import { partitionClerkConsoleAlerts } from "@/features/saleroom/lib/clerk-console-alerts";
import type { ClerkAlertDefinition } from "@/features/saleroom/types/clerk-console.types";
import { Notice, StaffButton, TextLink } from "@auction/staff-ui";
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
        <TextLink href={registrationsHref} Link={Link}>
          Check in bidders
        </TextLink>{" "}
        so clerks can place in-room bids.
      </>
    );
  }
  return alert.body;
}

/** What needs a clerk's attention before or during the sale, most important first. */
export function ClerkConsoleAlertsPanel({ alerts, registrationsHref }: Props) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const { visible, hiddenCount } = partitionClerkConsoleAlerts(alerts, showAllAlerts);

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {visible.map((alert) => (
        <Notice
          key={alert.key}
          tone={alert.variant === "destructive" ? "danger" : "warning"}
          alert={alert.variant === "destructive"}
          title={alert.title}
        >
          {renderAlertBody(alert, registrationsHref)}
        </Notice>
      ))}
      {hiddenCount > 0 ? (
        <div>
          <StaffButton variant="ghost" size="sm" onClick={() => setShowAllAlerts(true)}>
            Show {hiddenCount} more {hiddenCount === 1 ? "alert" : "alerts"}
          </StaffButton>
        </div>
      ) : null}
    </div>
  );
}
