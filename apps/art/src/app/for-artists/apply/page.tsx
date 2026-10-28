import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import {
  ApplicationAcceptedView,
  ApplicationDeclinedView,
  ApplicationSentView,
  ApplicationSignInView,
  ApplicationStatusView,
  formatApplicationDate,
} from "@/components/artist-application/application-status-views";
import { ArtistApplicationForm } from "@/components/artist-application/artist-application-form.client";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import { type ApplyPageView, decideApplyPageView } from "@/lib/artist-application/apply-page.vm";
import { artistApplicationGateway } from "@/lib/artist-application/artist-application.services.server";
import { ARTIST_APPLY_PATH, FOR_ARTISTS_PATH } from "@/lib/artist-application/for-artists.content";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Apply to join");

type Props = { searchParams: Promise<{ sent?: string | string[] }> };

const TITLES: Record<ApplyPageView["kind"], { title: string; intro: string | null }> = {
  sign_in: { title: "Apply to join", intro: null },
  account_disabled: { title: "Apply to join", intro: null },
  unavailable: { title: "Apply to join", intro: null },
  form: {
    title: "Apply to join",
    intro:
      "Your application to be represented by London Art Exchange. Your answers are saved each time you continue.",
  },
  sent: { title: "Your application", intro: null },
  status: { title: "Your application", intro: null },
  accepted: { title: "Your application", intro: null },
  declined: { title: "Your application", intro: null },
};

function Frame({
  title,
  intro,
  children,
}: { title: string; intro: string | null; children: ReactNode }) {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "pb-16 pt-8 md:pb-24 md:pt-12")}>
      <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-10">
        <header className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb">
            <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 font-label text-sm text-on-surface-variant">
              <li>
                <Link
                  href={FOR_ARTISTS_PATH}
                  className="art-focus-ring rounded-sm underline-offset-4 hover:text-on-surface hover:underline"
                >
                  For artists
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-on-surface">
                {title}
              </li>
            </ol>
          </nav>
          <h1 className="m-0 font-headline text-[length:var(--text-display-md,2.5rem)] font-semibold leading-tight text-on-surface">
            {title}
          </h1>
          {intro ? (
            <p className="m-0 max-w-[60ch] text-base leading-relaxed text-on-surface-variant md:text-lg">
              {intro}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}

function Question({ text }: { text: string }) {
  return (
    <aside
      aria-label="The gallery's question"
      className="flex flex-col gap-2 border-l-2 border-warning bg-surface-container-low px-5 py-4"
    >
      <p className="m-0 font-label text-sm font-medium text-on-surface">
        The gallery has a question
      </p>
      <p className="m-0 whitespace-pre-line text-base leading-relaxed text-on-surface">{text}</p>
      <p className="m-0 text-sm text-on-surface-variant">
        Change your answers or add what they ask for, then send your application back from the last
        step.
      </p>
    </aside>
  );
}

/**
 * Applying to join the gallery. One address for every stage: the form while the artist writes
 * (or answers a question), the confirmation once sent, then where the application stands, the
 * welcome, or the reply and when they may apply again.
 */
export default async function ArtistApplyPage({ searchParams }: Props) {
  const [{ sent }, viewer] = await Promise.all([searchParams, artServices.viewer.load()]);
  const state = viewer.kind === "authenticated" ? await artistApplicationGateway.readState() : null;
  const view = decideApplyPageView({
    viewer,
    state,
    justSent: sent === "1",
    returnPath: ARTIST_APPLY_PATH,
  });
  const accountHref = laxAccountUrl("sellingApplication");
  const { title, intro } = TITLES[view.kind];

  return (
    <Frame title={title} intro={intro}>
      {view.kind === "sign_in" ? (
        <ApplicationSignInView loginHref={view.loginHref} registerHref={view.registerHref} />
      ) : null}
      {view.kind === "account_disabled" ? (
        <ArtStatusState
          variant="error"
          icon="lock"
          titleAs="h2"
          layout="page"
          title="Your account cannot apply right now"
          description="Your LAX Account is disabled. Contact the gallery team and we will help."
          actions={<ArtStatusStateLink href="/contact">Contact us</ArtStatusStateLink>}
        />
      ) : null}
      {view.kind === "unavailable" ? (
        <ArtStatusState
          variant="error"
          titleAs="h2"
          layout="page"
          title="Your application did not load"
          description="Something went wrong on our side. Your answers are safe; try again in a moment."
          actions={
            <ArtStatusStateLink href={ARTIST_APPLY_PATH} priority="primary">
              Try again
            </ArtStatusStateLink>
          }
        />
      ) : null}
      {view.kind === "form" ? (
        <>
          {view.question ? <Question text={view.question} /> : null}
          {view.previous ? (
            <p className="m-0 border-l-2 border-outline-variant pl-4 text-base leading-relaxed text-on-surface-variant">
              Your application {view.previous.reference} was declined
              {view.previous.decidedAt
                ? ` on ${formatApplicationDate(view.previous.decidedAt)}`
                : ""}
              . You are welcome to apply again with new work.
            </p>
          ) : null}
          <ArtistApplicationForm
            application={view.application}
            sentPath={`${ARTIST_APPLY_PATH}?sent=1`}
          />
        </>
      ) : null}
      {view.kind === "sent" ? (
        <ApplicationSentView
          application={view.application}
          email={viewer.kind === "authenticated" ? viewer.email : null}
          accountHref={accountHref}
        />
      ) : null}
      {view.kind === "status" ? (
        <ApplicationStatusView application={view.application} accountHref={accountHref} />
      ) : null}
      {view.kind === "accepted" ? <ApplicationAcceptedView application={view.application} /> : null}
      {view.kind === "declined" ? (
        <ApplicationDeclinedView
          application={view.application}
          availableFrom={view.availableFrom}
        />
      ) : null}
    </Frame>
  );
}
