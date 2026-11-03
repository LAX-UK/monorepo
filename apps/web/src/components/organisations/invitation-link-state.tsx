"use client";

import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import type { InvitationLinkView } from "@/lib/organisations/invitation-link.vm";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Button } from "@auction/ui/lax";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  view: InvitationLinkView;
  /** Where "Accept invitation" posts. */
  acceptAction: string;
};

function AcceptForm({ label, action }: { label: string; action: string }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      method="post"
      action={action}
      onSubmit={(event) => {
        if (submitting) event.preventDefault();
        else setSubmitting(true);
      }}
      className="contents"
    >
      <Button
        type="submit"
        variant="primary"
        aria-busy={submitting || undefined}
        aria-disabled={submitting || undefined}
        data-testid="invitation-accept"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </form>
  );
}

/**
 * One state of an invitation link: the invitation to accept, or what became of it. Accepting is
 * a plain form post to the accept route (it works before scripts load, and nothing is accepted
 * by opening the page).
 */
export function InvitationLinkState({ view, acceptAction }: Props) {
  const art =
    view.art.kind === "tile" ? (
      <AccountTile account={{ kind: "organisation", initials: view.art.initials }} />
    ) : (
      view.art.name
    );
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      {view.retryNotice ? (
        <Alert variant="warning" className="mt-6">
          <AlertCircle className="size-4" strokeWidth={1.75} aria-hidden />
          <AlertDescription>{view.retryNotice}</AlertDescription>
        </Alert>
      ) : null}
      <EmptyState
        size="page"
        variant="plain"
        headingLevel="h1"
        illustration={art}
        title={view.title}
        description={view.description}
        action={
          <>
            {view.accept ? <AcceptForm label={view.accept.label} action={acceptAction} /> : null}
            {view.primary ? (
              <Button asChild variant="primary">
                <Link href={view.primary.href} prefetch={false}>
                  {view.primary.label}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={view.secondary.href}>{view.secondary.label}</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
