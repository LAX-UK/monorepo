"use client";

import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SecurityAlertState = {
  changed: boolean;
  linked: string | null;
  passwordSet: boolean;
};

/** Success alerts from OAuth link / password setup redirects; strips query params after capture. */
export function SecuritySettingsAlerts() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stripped = useRef(false);
  const [alerts, setAlerts] = useState<SecurityAlertState | null>(null);

  useEffect(() => {
    if (stripped.current) return;

    const changed = searchParams.get("changed") === "1";
    const linked = searchParams.get("linked");
    const passwordSet = searchParams.get("password") === "set";

    if (!changed && !linked && !passwordSet) return;

    stripped.current = true;
    setAlerts({ changed, linked, passwordSet });

    const next = new URLSearchParams(searchParams.toString());
    next.delete("changed");
    next.delete("linked");
    next.delete("password");
    const qs = next.toString();
    router.replace(qs ? `/dashboard/settings/security?${qs}` : "/dashboard/settings/security", {
      scroll: false,
    });
  }, [router, searchParams]);

  if (!alerts) return null;

  return (
    <div className="space-y-3" aria-live="polite">
      {alerts.changed ? (
        <Alert>
          <AlertTitle>Security settings updated</AlertTitle>
          <AlertDescription>Your security preferences were saved successfully.</AlertDescription>
        </Alert>
      ) : null}
      {alerts.linked ? (
        <Alert>
          <AlertTitle>Account linked</AlertTitle>
          <AlertDescription>
            Your{" "}
            {alerts.linked === "google"
              ? "Google"
              : alerts.linked === "apple"
                ? "Apple"
                : alerts.linked}{" "}
            account is now linked to LAX.
          </AlertDescription>
        </Alert>
      ) : null}
      {alerts.passwordSet ? (
        <Alert>
          <AlertTitle>Password set</AlertTitle>
          <AlertDescription>
            You can now sign in with email and password as well as your linked accounts.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
