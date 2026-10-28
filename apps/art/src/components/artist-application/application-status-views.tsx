import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ARTIST_PORTAL_PATH, FOR_ARTISTS_PATH } from "@/lib/artist-application/for-artists.content";
import {
  ARTIST_APPLICATION_JOURNEY,
  type ArtistApplicationStatusTone,
  artistApplicationJourneyStep,
  presentArtistApplicationStatus,
} from "@auction/lax-ecosystem";
import { MarketingSuccessState } from "@auction/marketing-ui";
import type { MyArtistApplication } from "@auction/shop-contracts";
import { ARTIST_APPLICATION_REVIEW_WEEKS } from "@auction/shop-domain";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

export function formatApplicationDate(value: string | null): string | null {
  return value ? LONG_DATE.format(new Date(value)) : null;
}

const TONE_DOT: Record<ArtistApplicationStatusTone, string> = {
  neutral: "bg-on-surface-variant",
  info: "bg-info",
  attention: "bg-warning",
  success: "bg-success",
};

export function ApplicationStatusLabel({ status }: { status: string }) {
  const vm = presentArtistApplicationStatus(status);
  return (
    <span className="inline-flex items-center gap-2 font-label text-sm font-medium text-on-surface">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_DOT[vm.tone])} />
      {vm.label}
    </span>
  );
}

function Facts({ application }: { application: MyArtistApplication }) {
  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: "Reference", value: <span className="tabular-nums">{application.reference}</span> },
    ...(application.submittedAt
      ? [{ label: "Sent", value: formatApplicationDate(application.submittedAt) }]
      : []),
    { label: "Status", value: <ApplicationStatusLabel status={application.status} /> },
  ];
  return (
    <dl className="m-0 grid gap-x-8 gap-y-4 border-y border-outline-variant py-6 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <dt className="font-label text-sm text-on-surface-variant">{row.label}</dt>
          <dd className="m-0 text-base text-on-surface">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Submitted, in review, decision: where the application is, as three marks on a line. */
function Journey({ status }: { status: string }) {
  const at = artistApplicationJourneyStep(status);
  return (
    <ol aria-label="Where your application is" className="m-0 grid list-none grid-cols-3 p-0">
      {ARTIST_APPLICATION_JOURNEY.map((stage, index) => {
        const reached = index <= at;
        return (
          <li
            key={stage.id}
            aria-current={index === at ? "step" : undefined}
            className="relative flex flex-col gap-3 pr-2"
          >
            <span className="flex items-center">
              <span
                aria-hidden
                className={cn(
                  "relative z-10 size-3 shrink-0 rounded-full border-2",
                  reached ? "border-on-surface bg-on-surface" : "border-input-border bg-surface",
                )}
              />
              {index < ARTIST_APPLICATION_JOURNEY.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("h-px flex-1", index < at ? "bg-on-surface" : "bg-outline-variant")}
                />
              ) : null}
            </span>
            <span
              className={cn(
                "font-label text-sm",
                reached ? "font-medium text-on-surface" : "text-on-surface-variant",
              )}
            >
              {stage.label}
              {reached ? null : <span className="sr-only"> (not yet)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="outline" size="lg" className="min-h-11 font-label">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/** The confirmation after sending: the reference, the emailed copy, and when to expect a reply. */
export function ApplicationSentView({
  application,
  email,
  accountHref,
}: {
  application: MyArtistApplication;
  email: string | null;
  accountHref: string | null;
}) {
  return (
    <MarketingSuccessState
      title="Application sent"
      data-testid="artist-application-sent"
      description={
        <>
          Thank you. Your reference is{" "}
          <strong className="font-medium">{application.reference}</strong>.
          {email ? ` We have emailed a copy to ${email}.` : ""} The gallery team replies within{" "}
          {ARTIST_APPLICATION_REVIEW_WEEKS} weeks.
        </>
      }
      actions={
        <div className="flex flex-wrap justify-center gap-3">
          {accountHref ? (
            <Button asChild size="lg" className="min-h-11 font-label">
              <a href={accountHref}>Follow it in LAX Account</a>
            </Button>
          ) : null}
          <SecondaryLink href="/">Back to lax.art</SecondaryLink>
        </div>
      }
    />
  );
}

/** Sent and waiting on the gallery: where it is, and what happens next. */
export function ApplicationStatusView({
  application,
  accountHref,
}: {
  application: MyArtistApplication;
  accountHref: string | null;
}) {
  const vm = presentArtistApplicationStatus(application.status);
  return (
    <div className="flex flex-col gap-8" data-testid="artist-application-status">
      <Facts application={application} />
      <Journey status={application.status} />
      <p className="m-0 max-w-[60ch] text-base leading-relaxed text-on-surface">
        {vm.next} We reply by email within {ARTIST_APPLICATION_REVIEW_WEEKS} weeks of receiving it.
      </p>
      <div className="flex flex-wrap gap-3">
        {accountHref ? (
          <Button asChild size="lg" className="min-h-11 font-label">
            <a href={accountHref}>Follow it in LAX Account</a>
          </Button>
        ) : null}
        <SecondaryLink href={FOR_ARTISTS_PATH}>About representation</SecondaryLink>
      </div>
    </div>
  );
}

export function ApplicationAcceptedView({ application }: { application: MyArtistApplication }) {
  return (
    <div className="flex flex-col gap-8" data-testid="artist-application-accepted">
      <Facts application={application} />
      <div className="flex max-w-[60ch] flex-col gap-3">
        <h2 className="m-0 font-headline text-2xl font-medium text-on-surface">
          Welcome to the gallery
        </h2>
        <p className="m-0 text-base leading-relaxed text-on-surface">
          Your artist portal is open in your LAX Account. The gallery team will be in touch about
          your profile on lax.art and the works to show first.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="min-h-11 font-label">
          <a href={ARTIST_PORTAL_PATH}>Open the artist portal</a>
        </Button>
      </div>
    </div>
  );
}

export function ApplicationDeclinedView({
  application,
  availableFrom,
}: {
  application: MyArtistApplication;
  availableFrom: string | null;
}) {
  const date = formatApplicationDate(availableFrom);
  return (
    <div className="flex flex-col gap-8" data-testid="artist-application-declined">
      <Facts application={application} />
      <div className="flex max-w-[60ch] flex-col gap-4">
        <h2 className="m-0 font-headline text-2xl font-medium text-on-surface">
          Thank you for applying
        </h2>
        <p className="m-0 text-base leading-relaxed text-on-surface">
          We are not able to offer representation at the moment.
        </p>
        {application.messageToArtist ? (
          <blockquote className="m-0 border-l-2 border-on-surface pl-4 text-base leading-relaxed text-on-surface">
            <p className="m-0 font-label text-sm text-on-surface-variant">From the gallery</p>
            <p className="m-0 mt-1 whitespace-pre-line">{application.messageToArtist}</p>
          </blockquote>
        ) : null}
        <p className="m-0 text-base leading-relaxed text-on-surface-variant">
          {date
            ? `You are welcome to apply again from ${date}, with new work.`
            : "You are welcome to apply again with new work."}
        </p>
      </div>
    </div>
  );
}

/** Applying needs a LAX Account, so a visitor signs in (or creates one) and comes straight back. */
export function ApplicationSignInView({
  loginHref,
  registerHref,
}: {
  loginHref: string;
  registerHref: string;
}) {
  return (
    <ArtStatusState
      variant="empty"
      icon="gallery"
      titleAs="h2"
      layout="page"
      title="Sign in to apply"
      description="You apply with your LAX Account, so your answers are saved and you can follow your application. Creating an account takes a minute."
      actions={
        <>
          <ArtStatusStateLink href={loginHref} priority="primary">
            Sign in
          </ArtStatusStateLink>
          <ArtStatusStateLink href={registerHref}>Create an account</ArtStatusStateLink>
        </>
      }
    />
  );
}
