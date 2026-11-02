"use client";

import { linkVisitorAlerts, stopVisitorAlerts } from "@/lib/data/http/sale-alerts.client";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax";
import { useState } from "react";

type State = "on" | "linked" | "off";

/**
 * The email address on this account also signed up for new-sale emails before it had an account.
 * Offered only then: link it to the account to manage it here, or turn it off. Linking changes
 * nothing about what is sent.
 */
export function VisitorAlertsLink({ initial }: { initial: "on" | "linked" }) {
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState<"link" | "stop" | null>(null);

  const run = async (kind: "link" | "stop") => {
    setBusy(kind);
    const result = await (kind === "link" ? linkVisitorAlerts() : stopVisitorAlerts());
    setBusy(null);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setState(kind === "link" ? "linked" : "off");
    notify.success(kind === "link" ? "Sale announcements linked" : "Sale announcements are off");
  };

  return (
    <div>
      <p className="text-lax-14 font-semibold text-lax-fg">Sale announcements</p>
      <p className="mt-1 text-lax-13 text-lax-muted">
        {state === "off"
          ? "You won't get emails about new sales to this address."
          : state === "linked"
            ? "You get an email when new sales are announced. It is linked to your account."
            : "This address signed up for emails when new sales are announced, before you had an account. Link it to manage it here."}
      </p>
      {state === "off" ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "on" ? (
            <Button size="sm" loading={busy === "link"} onClick={() => void run("link")}>
              Link to my account
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "stop"}
            onClick={() => void run("stop")}
          >
            Turn off
          </Button>
        </div>
      )}
    </div>
  );
}
