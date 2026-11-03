"use client";

import { loadAccountAlerts, setAlertTopic } from "@/lib/data/http/alerts.client";
import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { notify } from "@/lib/ui/notify";
import { Button, ButtonLink, Skeleton } from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useState } from "react";

type View = "checking" | "off" | "on";

const COPY: Record<View, { heading: string; body: string }> = {
  checking: {
    heading: "Hear about new sales first",
    body: "We'll email you when a sale is announced, and tell you in the app.",
  },
  off: {
    heading: "Hear about new sales first",
    body: "We'll email you when a sale is announced, and tell you in the app.",
  },
  on: {
    heading: "Your sale alerts are on",
    body: "New sales reach you by email at 08:00 and in the app. Artists and searches are in Watching.",
  },
};

/**
 * The alerts band for a signed-in client. The home page is cached for everyone, so what this
 * person has chosen is read here, in the browser. Turning alerts on takes one press and no
 * confirmation email: their address is already verified.
 */
export function HomeAlertsSignedIn() {
  const [view, setView] = useState<View>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void loadAccountAlerts().then((mine) => {
      if (!live) return;
      const on =
        mine?.state === "confirmed" &&
        mine.topics.some((t) => t.topic === "bid.new_sales" && t.emailOn);
      setView(on ? "on" : "off");
    });
    return () => {
      live = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    const result = await setAlertTopic("bid.new_sales", true);
    setBusy(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setView("on");
    notify.success("Sale alerts are on");
  };

  const copy = COPY[view];
  return (
    <>
      <div className="min-w-0">
        <h2
          id="home-alerts-heading"
          className="m-0 font-headline text-xl font-medium leading-7 text-on-surface md:text-2xl md:leading-8"
        >
          {copy.heading}
        </h2>
        <p className="m-0 mt-1.5 font-body text-sm leading-[22px] text-on-surface-variant">
          {copy.body}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
        {view === "checking" ? (
          <Skeleton className="h-lax-control-md w-44 rounded-lax-control" />
        ) : (
          <>
            {view === "off" ? (
              <Button type="button" variant="primary" loading={busy} onClick={() => void turnOn()}>
                Turn on sale alerts
              </Button>
            ) : null}
            <ButtonLink
              Link={Link}
              href={bidSettingsHref("alerts")}
              variant={view === "on" ? "primary" : "secondary"}
            >
              Alert settings
            </ButtonLink>
          </>
        )}
      </div>
    </>
  );
}
