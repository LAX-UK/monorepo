"use client";

import {
  type ReleaseAlertSubscribeResult,
  stopReleaseAlerts,
  subscribeReleaseAlerts,
} from "@/app/actions/release-alerts.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import type { ReleaseAlertViewer } from "@/lib/shop-release-alerts.server";
import { FOCUS_RING } from "@auction/branding";
import {
  MarketingCheckIcon,
  MarketingFormErrorSummary,
  MarketingFormField,
  marketingEmailError,
} from "@auction/marketing-ui";
import { RELEASE_ALERT_CONSENT_TEXT } from "@auction/shop-domain";
import { cn } from "@auction/ui";
import Link from "next/link";
import { type FormEvent, useId, useState, useTransition } from "react";

type Props = {
  viewer: ReleaseAlertViewer;
  /** The page the form is on, kept with the person's consent. */
  source: string;
  /** `inline` sits inside an empty state; `band` sits in the home band and centres its text. */
  layout?: "band" | "inline";
};

type Phase =
  | { kind: "idle" }
  | { kind: "check-email"; email: string }
  | { kind: "on"; email: string; justNow: boolean }
  | { kind: "stopped" };

type Problem = { tone: "warning" | "error"; title: string; message: string };

function problemFor(result: Extract<ReleaseAlertSubscribeResult, { ok: false }>): Problem {
  return result.kind === "limited"
    ? { tone: "warning", title: "Too many requests", message: result.message }
    : { tone: "error", title: "Release alerts not saved", message: result.message };
}

/**
 * Asks for an email each time LAX Shop releases a new edition. A visitor types an address and
 * confirms it from an email; a signed-in shopper uses the account's address with one button and
 * can stop from here. Each change is announced in a polite status region, and focus moves only
 * when a submitted address needs correcting.
 */
export function ShopReleaseAlertsForm({ viewer, source, layout = "inline" }: Props) {
  const ids = useId();
  const emailId = `${ids}-email`;
  const consentId = `${ids}-consent`;
  const [phase, setPhase] = useState<Phase>(
    viewer.kind === "account" && viewer.subscribed
      ? { kind: "on", email: viewer.email, justNow: false }
      : { kind: "idle" },
  );
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, startTransition] = useTransition();

  function subscribe(typed: string | null) {
    setProblem(null);
    startTransition(async () => {
      const result = await subscribeReleaseAlerts({
        source,
        ...(typed ? { email: typed } : {}),
        ...(website ? { website } : {}),
      });
      if (!result.ok) {
        if (result.kind === "invalid") {
          setFieldError(result.message);
          setFailedSubmits((count) => count + 1);
        } else {
          setProblem(problemFor(result));
        }
        return;
      }
      setPhase(
        result.status === "subscribed" && viewer.kind === "account"
          ? { kind: "on", email: viewer.email, justNow: true }
          : { kind: "check-email", email: typed ?? "" },
      );
    });
  }

  function onGuestSubmit(event: FormEvent) {
    event.preventDefault();
    const error = marketingEmailError(email);
    setFieldError(error);
    if (error) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    subscribe(email.trim());
  }

  function stop() {
    setProblem(null);
    startTransition(async () => {
      const result = await stopReleaseAlerts();
      if (!result.ok) {
        setProblem({ tone: "error", title: "Release alerts not stopped", message: result.message });
        return;
      }
      setPhase({ kind: "stopped" });
    });
  }

  const status =
    phase.kind === "check-email" ? (
      <div className="shop-release-alerts__done">
        <MarketingCheckIcon className="shop-release-alerts__done-icon" aria-hidden />
        <div>
          <p className="shop-release-alerts__done-title">Check your email</p>
          <p>
            We have sent a confirmation link to{" "}
            <span className="shop-release-alerts__email">{phase.email}</span>. Open it to turn on
            release alerts.
          </p>
        </div>
      </div>
    ) : phase.kind === "on" ? (
      <div className="shop-release-alerts__done">
        <MarketingCheckIcon className="shop-release-alerts__done-icon" aria-hidden />
        <div>
          <p className="shop-release-alerts__done-title">
            {phase.justNow ? "Done" : "You’re on the list"}
          </p>
          <p>
            We’ll email <span className="shop-release-alerts__email">{phase.email}</span> when a new
            edition is released.
          </p>
        </div>
      </div>
    ) : phase.kind === "stopped" ? (
      <p className="shop-release-alerts__note">
        Release alerts stopped. We will not email you about new editions.
      </p>
    ) : null;

  const wrapper = cn("shop-release-alerts", layout === "band" && "shop-release-alerts--band");

  return (
    <div className={wrapper}>
      {/* Always mounted, so screen readers announce each change without focus moving. */}
      <output aria-live="polite" className="shop-release-alerts__status">
        {status}
      </output>

      {phase.kind === "check-email" ? (
        <div className="shop-release-alerts__actions">
          <button
            type="button"
            className={cn("shop-inline-link", FOCUS_RING)}
            onClick={() => {
              setPhase({ kind: "idle" });
              setEmail("");
            }}
          >
            Use a different address
          </button>
        </div>
      ) : phase.kind === "on" ? (
        <div className="shop-release-alerts__actions">
          <ShopCommerceButton
            type="button"
            variant="outline"
            scale="standard"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={stop}
          >
            {pending ? "Stopping…" : "Stop alerts"}
          </ShopCommerceButton>
        </div>
      ) : viewer.kind === "account" ? (
        <div className="shop-release-alerts__actions">
          <ShopCommerceButton
            type="button"
            variant="cta"
            scale="standard"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => subscribe(null)}
          >
            {pending ? "Saving…" : "Get release alerts"}
          </ShopCommerceButton>
          <p className="shop-release-alerts__note">
            We’ll email you at <span className="shop-release-alerts__email">{viewer.email}</span>.
          </p>
        </div>
      ) : (
        <form className="shop-release-alerts__form" noValidate onSubmit={onGuestSubmit}>
          <MarketingFormErrorSummary
            errors={fieldError ? [{ fieldId: emailId, message: fieldError }] : []}
            focusKey={failedSubmits}
          />
          <div className="shop-release-alerts__row">
            <MarketingFormField
              id={emailId}
              label="Email address"
              error={fieldError}
              className="shop-release-alerts__field"
            >
              {(control) => (
                <input
                  {...control}
                  aria-describedby={
                    [control["aria-describedby"], consentId].filter(Boolean).join(" ") || undefined
                  }
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="shop-field shop-release-alerts__input"
                />
              )}
            </MarketingFormField>
            <ShopCommerceButton
              type="submit"
              variant="cta"
              scale="standard"
              disabled={pending}
              aria-busy={pending || undefined}
              className="shop-release-alerts__submit"
            >
              {pending ? "Sending…" : "Get release alerts"}
            </ShopCommerceButton>
          </div>
          {/* Left empty by people; bots that fill every field are dropped by the API. */}
          <div className="shop-release-alerts__trap" aria-hidden="true">
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
          </div>
          <p id={consentId} className="shop-release-alerts__note">
            {RELEASE_ALERT_CONSENT_TEXT} We’ll ask you to confirm by email first. See our{" "}
            <Link href="/privacy" className={cn("shop-inline-link", FOCUS_RING)}>
              privacy notice
            </Link>
            .
          </p>
        </form>
      )}

      {problem ? (
        <ShopNotice tone={problem.tone} title={problem.title}>
          {problem.message}
        </ShopNotice>
      ) : null}
    </div>
  );
}
