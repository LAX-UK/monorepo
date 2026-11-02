"use client";

import { unsubscribeVisitorAlerts } from "@/lib/data/http/sale-alerts.client";
import { Button, ButtonLink, Notice } from "@auction/ui/lax";
import Link from "next/link";
import { useState } from "react";

/** Confirms the unsubscribe: opening the link alone changes nothing, so mail scanners are harmless. */
export function VisitorAlertUnsubscribeForm({
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
      <div className="flex flex-col gap-6">
        <Notice tone="success" title="You're unsubscribed">
          We won&apos;t email {maskedEmail} about new sales. You can sign up again at any time.
        </Notice>
        <ButtonLink Link={Link} variant="primary" href="/">
          Back to LAX Bid
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="danger" alert title={error} /> : null}
      <Notice tone="info" title="What will change">
        You&apos;ll stop getting emails about new sales at {maskedEmail}.
      </Notice>
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
    </div>
  );
}
