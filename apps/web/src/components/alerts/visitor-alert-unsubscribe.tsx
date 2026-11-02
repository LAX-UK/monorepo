"use client";

import { unsubscribeVisitorAlerts } from "@/lib/data/http/sale-alerts.client";
import { Button, ButtonLink, EmptyState, Notice } from "@auction/ui/lax";
import Link from "next/link";
import { useState } from "react";

/**
 * Confirms the unsubscribe. Opening the link alone changes nothing, so a mail scanner that
 * follows it cannot unsubscribe anyone.
 */
export function VisitorAlertUnsubscribe({
  token,
  maskedEmail,
}: {
  token: string;
  maskedEmail: string;
}) {
  const [phase, setPhase] = useState<"ready" | "working" | "done">("ready");
  const [error, setError] = useState<string | null>(null);

  if (phase === "done") {
    return (
      <EmptyState
        layout="page"
        className="pt-[var(--header-height)]"
        illustration="ticket"
        title="You're unsubscribed"
        description={`We won't email ${maskedEmail} about new sales. You can sign up again at any time.`}
        actions={
          <ButtonLink Link={Link} variant="primary" href="/">
            Back to LAX Bid
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      layout="page"
      className="pt-[var(--header-height)]"
      illustration="ticket"
      title="Unsubscribe from sale alerts"
      description={`You'll stop getting emails about new sales at ${maskedEmail}.`}
      control={error ? <Notice tone="danger" alert title={error} /> : null}
      actions={
        <Button
          type="button"
          variant="primary"
          loading={phase === "working"}
          onClick={async () => {
            setError(null);
            setPhase("working");
            const result = await unsubscribeVisitorAlerts(token);
            if (result.ok) {
              setPhase("done");
              return;
            }
            setPhase("ready");
            setError(result.error);
          }}
        >
          Unsubscribe
        </Button>
      }
    />
  );
}
