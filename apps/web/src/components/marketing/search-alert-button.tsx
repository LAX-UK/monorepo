"use client";

import { TurnOnEmailDialog } from "@/components/dashboard/watchlist/turn-on-email-dialog";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { ensureSearchAlert } from "@/lib/marketing/search-alert";
import type { SearchAlertState } from "@/lib/marketing/search-fallback";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import { searchEmailIsOn } from "@/lib/watching/alert-reach";
import {
  type AlertAccess,
  needsOthersConfirmation,
  savedWhileHeldMessage,
  searchEmailControl,
  switchSearchEmail,
  turnedOnMessage,
} from "@/lib/watching/search-email";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  isAuthenticated: boolean;
  q: string;
  categoryId?: string;
  /** The search page with `alert=1`: signing in returns here and the alert is saved on arrival. */
  returnHref: string;
  /** True when arriving from sign-in with the alert already asked for. */
  saveOnArrival: boolean;
  /** What the account's saved searches hold for this search, read on the server. */
  alertState?: SearchAlertState;
  /** Whether the saved-search alerts topic's email is on; null when it could not be read. */
  topicEmailOn?: boolean | null;
  /** The saved search holding this alert, when the server found it. */
  alertSearchId?: string | null;
  /** That saved search's own email switch, for putting it back if turning email on fails. */
  alertSearchNotifyEmail?: boolean;
  /** Whether email can be switched on from here, or alerts are stopped or the address unverified. */
  emailAccess?: AlertAccess;
  /** Other saved searches whose own email switch is on, which turning the topic on brings back. */
  otherSearchesOn?: number;
  /** Where saved search alerts are managed. */
  manageHref?: string;
};

type Phase = "idle" | "saving" | "saved" | "email_off";

const INITIAL_PHASE: Record<SearchAlertState, Phase> = {
  none: "idle",
  on: "saved",
  email_off: "email_off",
};

/** "Get an alert for this search": emails the visitor when a lot matching the text goes on sale. */
export function SearchAlertButton({
  isAuthenticated,
  q,
  categoryId,
  returnHref,
  saveOnArrival,
  alertState = "none",
  topicEmailOn = null,
  alertSearchId = null,
  alertSearchNotifyEmail = false,
  emailAccess = "ok",
  otherSearchesOn = 0,
  manageHref = CLIENT_ROUTES.watchingSearches,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>(INITIAL_PHASE[alertState]);
  const [confirming, setConfirming] = useState(false);
  const asked = useRef(false);
  const reasonId = useId();

  const save = useCallback(async () => {
    setPhase("saving");
    const outcome = await ensureSearchAlert(q, categoryId);
    if (outcome === "failed") {
      setPhase("idle");
      notify.error("Could not set the alert. Try again in a moment.");
      return;
    }
    // The search is saved with email on, but nothing is emailed while the topic's email is off.
    if (emailAccess !== "ok") {
      setPhase("email_off");
      notify.success(savedWhileHeldMessage(emailAccess));
      return;
    }
    if (!searchEmailIsOn(true, topicEmailOn)) {
      setPhase("email_off");
      notify.success("Alert saved. Email is off for saved searches, so nothing will be sent.");
      return;
    }
    setPhase("saved");
    notify.success(
      outcome === "existing"
        ? "You already have an alert for this search."
        : "Alert set. Matches arrive in your 08:00 email and in the app.",
    );
  }, [q, categoryId, topicEmailOn, emailAccess]);

  const turnOnEmail = useCallback(async () => {
    setConfirming(false);
    setPhase("saving");
    const result = await switchSearchEmail({
      id: alertSearchId,
      on: true,
      previous: alertSearchId === null || alertSearchNotifyEmail,
      access: emailAccess,
    });
    if (!result.ok) {
      setPhase("email_off");
      notify.error(result.error);
      return;
    }
    setPhase("saved");
    notify.success(turnedOnMessage(topicEmailOn === false ? otherSearchesOn : 0));
  }, [alertSearchId, alertSearchNotifyEmail, emailAccess, topicEmailOn, otherSearchesOn]);

  /** Asks first when turning on would also bring back other searches' email. */
  const requestTurnOn = () => {
    if (needsOthersConfirmation({ topicEmailOn, othersOn: otherSearchesOn })) setConfirming(true);
    else void turnOnEmail();
  };

  useEffect(() => {
    if (!saveOnArrival || !isAuthenticated || asked.current) return;
    asked.current = true;
    void save().finally(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("alert");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [saveOnArrival, isAuthenticated, save, router, pathname]);

  if (!isAuthenticated) {
    return (
      <ButtonLink
        variant="secondary"
        icon={<Bell aria-hidden />}
        href={buildHostedLoginStartHref({ next: returnHref })}
      >
        Get an alert for this search
      </ButtonLink>
    );
  }

  if (phase === "saved" || phase === "email_off") {
    const held = searchEmailControl({ access: emailAccess, notifyEmail: true, topicEmailOn });
    return (
      <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
        <output
          aria-describedby={phase === "email_off" && held.kind === "held" ? reasonId : undefined}
          className="inline-flex h-10 items-center gap-2 text-lax-14 font-medium text-lax-fg"
        >
          <BellRing className="size-4" aria-hidden />
          {phase === "saved" ? "Alert set" : "Saved search · email off"}
        </output>
        {phase === "email_off" && held.kind === "held" ? (
          <>
            <span id={reasonId} className="text-lax-13 text-lax-muted">
              {held.reason}
            </span>
            <ButtonLink Link={Link} variant="secondary" href={held.action.href}>
              {held.action.label}
            </ButtonLink>
          </>
        ) : null}
        {phase === "email_off" && held.kind === "switch" ? (
          <Button variant="secondary" onClick={requestTurnOn}>
            Turn on email
          </Button>
        ) : null}
        <ButtonLink Link={Link} variant="ghost" href={manageHref}>
          Manage alerts
        </ButtonLink>
        <TurnOnEmailDialog
          open={confirming}
          othersOn={otherSearchesOn}
          busy={false}
          onConfirm={() => void turnOnEmail()}
          onCancel={() => setConfirming(false)}
        />
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      icon={<Bell aria-hidden />}
      loading={phase === "saving"}
      onClick={() => void save()}
    >
      Get an alert for this search
    </Button>
  );
}
