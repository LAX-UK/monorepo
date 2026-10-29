"use client";

import { dismissWelcomeAction } from "@/lib/legal-entity/organisation-membership.actions";
import type { WelcomeCardView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/components/button";
import { ArrowUpLeft, Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  welcome: WelcomeCardView;
  organisationName: string;
};

/**
 * The one-time welcome after accepting an invitation: what the role allows, the identity step
 * when the role needs it, and where the account switcher is. "Got it" closes it for good.
 */
export function WelcomeCard({ welcome, organisationName }: Props) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  const dismiss = () => {
    setError(null);
    startTransition(async () => {
      const result = await dismissWelcomeAction(welcome.organisationId);
      if (result.ok) setHidden(true);
      else setError(result.error);
    });
  };

  return (
    <section
      aria-labelledby="welcome-card-heading"
      className="rounded-xl bg-secondary p-5 text-on-secondary shadow-sm sm:p-6"
      data-testid="welcome-card"
    >
      <h2
        id="welcome-card-heading"
        className="font-headline text-lg font-semibold tracking-tight sm:text-xl"
      >
        Welcome to {organisationName}
      </h2>
      <p className="mt-2 font-body text-sm sm:text-base">{welcome.headline} You can:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 font-body text-sm sm:text-base">
        {welcome.abilities.map((ability) => (
          <li key={ability}>{ability}</li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-2 font-body text-sm sm:text-base">
        <ArrowUpLeft
          className="mt-0.5 hidden size-4 shrink-0 lg:block"
          strokeWidth={1.75}
          aria-hidden
        />
        Your own bids and purchases stay in your personal account. Switch between them from the
        account menu.
      </p>

      {welcome.identityStep ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-on-secondary/10 p-3 font-body text-sm sm:p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            <strong className="font-semibold">One step first: verify your identity.</strong> Your
            role acts in your name, so we check who you are. You'll find it under Needs you below.
          </span>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="default"
          onClick={dismiss}
          disabled={pending}
          className="bg-on-secondary text-secondary shadow-none hover:bg-on-secondary/90 focus-visible:ring-on-secondary focus-visible:ring-offset-secondary"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Got it
        </Button>
        {error ? (
          <p role="alert" className="font-body text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
