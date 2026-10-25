"use client";

import {
  registerEditionAlert,
  stopEditionAlertForArtwork,
} from "@/app/actions/artwork-interest.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { SHOP_EDITION_ALERTS_HREF } from "@/lib/account/shop-account-routes";
import { FOCUS_RING } from "@auction/branding";
import { MarketingCheckIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import { type FormEvent, useId, useRef, useState, useTransition } from "react";

export type ArtworkEditionAlertViewer = { kind: "guest" } | { kind: "account"; email: string };

type Props = {
  slug: string;
  viewer: ArtworkEditionAlertViewer;
  /** A signed-in shopper who already has a waiting alert for this edition. */
  initialWaiting?: boolean;
};

type Phase = { kind: "idle" } | { kind: "waiting"; email: string } | { kind: "stopped" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(value: string): string | null {
  if (!value.trim()) return "Enter your email address";
  if (!EMAIL_PATTERN.test(value.trim())) {
    return "Enter an email address in the correct format, like name@example.com";
  }
  return null;
}

/**
 * "Email me if this edition is back" on a sold-out edition. Guests type an address; a signed-in
 * shopper uses the account's. Results are announced through a polite status region and focus
 * only moves when the shopper submits an address that needs correcting.
 */
export function ArtworkEditionAlert({ slug, viewer, initialWaiting = false }: Props) {
  const ids = useId();
  const emailId = `${ids}-email`;
  const errorId = `${ids}-error`;
  const consentId = `${ids}-consent`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    initialWaiting && viewer.kind === "account"
      ? { kind: "waiting", email: viewer.email }
      : { kind: "idle" },
  );
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function register(typed: string | null) {
    setFailure(null);
    startTransition(async () => {
      const result = await registerEditionAlert(slug, {
        ...(typed ? { email: typed } : {}),
        ...(website ? { website } : {}),
      });
      if (!result.ok) {
        if (result.field === "email") {
          setFieldError(result.message);
          inputRef.current?.focus();
        } else {
          setFailure({ title: "Alert not saved", message: result.message });
        }
        return;
      }
      setPhase({
        kind: "waiting",
        email: typed ?? (viewer.kind === "account" ? viewer.email : ""),
      });
    });
  }

  function onGuestSubmit(event: FormEvent) {
    event.preventDefault();
    const error = emailError(email);
    setFieldError(error);
    if (error) {
      inputRef.current?.focus();
      return;
    }
    register(email.trim());
  }

  function stop() {
    setFailure(null);
    startTransition(async () => {
      const result = await stopEditionAlertForArtwork(slug);
      if (!result.ok) {
        setFailure({ title: "Alert not stopped", message: result.message });
        return;
      }
      setPhase({ kind: "stopped" });
    });
  }

  const status =
    phase.kind === "waiting" ? (
      <div className="shop-alert__done">
        <MarketingCheckIcon className="shop-alert__done-icon" aria-hidden />
        <div className="shop-alert__done-text">
          <p className="shop-alert__done-title">You are on the list</p>
          <p>
            We will email <span className="shop-alert__email">{phase.email}</span> once if an
            edition is back.
          </p>
        </div>
      </div>
    ) : phase.kind === "stopped" ? (
      <p className="shop-alert__note">Alert stopped. We will not email you about this edition.</p>
    ) : null;

  return (
    <div className="shop-alert">
      {/* Always mounted, so screen readers announce each change without focus moving. */}
      <output aria-live="polite" className="shop-alert__status">
        {status}
      </output>

      {phase.kind === "waiting" ? (
        <div className="shop-alert__actions">
          {viewer.kind === "account" ? (
            <>
              <ShopCommerceButton
                type="button"
                variant="outline"
                scale="standard"
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={stop}
              >
                {pending ? "Stopping…" : "Stop this alert"}
              </ShopCommerceButton>
              <Link href={SHOP_EDITION_ALERTS_HREF} className={cn("shop-inline-link", FOCUS_RING)}>
                Manage alerts
              </Link>
            </>
          ) : (
            <p className="shop-alert__note">Every alert email has a link to stop alerts.</p>
          )}
        </div>
      ) : viewer.kind === "account" ? (
        <div className="shop-alert__actions">
          <ShopCommerceButton
            type="button"
            variant="cta"
            scale="standard"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => register(null)}
          >
            {pending ? "Saving…" : "Email me if it is back"}
          </ShopCommerceButton>
          <p className="shop-alert__note">
            Alerts go to <span className="shop-alert__email">{viewer.email}</span>.
          </p>
        </div>
      ) : (
        <form className="shop-alert__form" noValidate onSubmit={onGuestSubmit}>
          <label htmlFor={emailId} className="shop-alert__label">
            Email address
          </label>
          {fieldError ? (
            <p id={errorId} className="shop-alert__error">
              <span className="sr-only">Error: </span>
              {fieldError}
            </p>
          ) : null}
          <div className="shop-alert__row">
            <input
              ref={inputRef}
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${errorId} ${consentId}` : consentId}
              className="shop-field shop-alert__input"
            />
            <ShopCommerceButton
              type="submit"
              variant="cta"
              scale="standard"
              disabled={pending}
              aria-busy={pending || undefined}
              className="shop-alert__submit"
            >
              {pending ? "Saving…" : "Email me"}
            </ShopCommerceButton>
          </div>
          {/* Left empty by people; bots that fill every field are dropped by the API. */}
          <div className="shop-alert__trap" aria-hidden="true">
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
          <p id={consentId} className="shop-alert__note">
            We will use this address only to tell you about this edition, once. Every alert email
            has a link to stop alerts. See our{" "}
            <Link href="/privacy" className={cn("shop-inline-link", FOCUS_RING)}>
              privacy notice
            </Link>
            .
          </p>
        </form>
      )}

      {failure ? (
        <ShopNotice tone="error" title={failure.title}>
          {failure.message}
        </ShopNotice>
      ) : null}
    </div>
  );
}
