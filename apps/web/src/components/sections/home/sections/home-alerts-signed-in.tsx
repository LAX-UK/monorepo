"use client";

import { loadAccountAlerts, setAlertTopic } from "@/lib/data/http/alerts.client";
import type { HomeAlertThumbnail } from "@/lib/home-sections/types";
import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { notify } from "@/lib/ui/notify";
import { Button, ButtonLink, Skeleton } from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeAlertsPanel } from "./home-alerts-panel";

type View = "checking" | "off" | "on";

const COPY: Record<View, { title: string; body: string }> = {
  checking: {
    title: "Hear about new sales first",
    body: "We'll email you when a sale is announced, and tell you in the app.",
  },
  off: {
    title: "Hear about new sales first",
    body: "We'll email you when a sale is announced, and tell you in the app.",
  },
  on: {
    title: "You'll hear about new sales",
    body: "New sales reach you by email at 08:00 and in the app. Artists and searches are in Watching.",
  },
};

/**
 * The alerts panel for a signed-in client. The home page is cached for everyone, so what this
 * person has chosen is read here, in the browser. Turning alerts on takes one press and no
 * confirmation email: their address is already verified. Once on, the panel only says so and
 * links to the settings; it never asks again.
 */
export function HomeAlertsSignedIn({
  thumbnails = [],
}: { thumbnails?: readonly HomeAlertThumbnail[] }) {
  const [view, setView] = useState<View>("checking");
  const [busy, setBusy] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);

  useEffect(() => {
    let live = true;
    void loadAccountAlerts().then((mine) => {
      if (!live) return;
      const on =
        mine?.state === "confirmed" &&
        mine.topics.some((t) => t.topic === "bid.new_sales" && t.emailOn);
      setView(on ? "on" : "off");
      setWasStopped(mine?.state === "stopped");
    });
    return () => {
      live = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    const result = await setAlertTopic("bid.new_sales", true, { restart: true });
    setBusy(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setView("on");
    // Starting again after stopping everything brings alerts back, with only this one switched on.
    notify.success(
      wasStopped ? "Your alerts are back on, with sale alerts switched on" : "Sale alerts are on",
    );
    setWasStopped(false);
  };

  const copy = COPY[view];
  return (
    <HomeAlertsPanel
      title={copy.title}
      body={copy.body}
      thumbnails={thumbnails}
      action={
        view === "checking" ? (
          <Skeleton className="h-lax-control-md w-44 rounded-lax-control" />
        ) : view === "off" ? (
          <>
            <Button type="button" variant="primary" loading={busy} onClick={() => void turnOn()}>
              Turn on sale alerts
            </Button>
            <ButtonLink Link={Link} href={bidSettingsHref("alerts")} variant="secondary">
              Alert settings
            </ButtonLink>
          </>
        ) : (
          <ButtonLink Link={Link} href={bidSettingsHref("alerts")} variant="secondary">
            Manage alerts
          </ButtonLink>
        )
      }
    />
  );
}
