"use client";

import { dismissWelcomeAction } from "@/lib/legal-entity/organisation-membership.actions";
import type { WelcomeCardView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/lax";
import { X } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  welcome: WelcomeCardView;
  organisationName: string;
};

/**
 * The welcome after accepting an invitation, as a calm card: what the role allows, the identity
 * step when the role needs it (it is also first in Needs you), and where the account switcher
 * is. Closing it is remembered for this person in this organisation.
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
      className="relative rounded-lax-card border border-lax-line bg-lax-surface px-5 py-5 sm:px-6"
      data-testid="welcome-card"
    >
      <h2
        id="welcome-card-heading"
        className="pr-10 font-lax-display text-lax-18 font-semibold text-lax-fg"
      >
        Welcome to {organisationName}
      </h2>
      <p className="mt-1 text-lax-14 text-lax-muted">{welcome.headline} You can:</p>
      <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-lax-14 text-lax-fg sm:grid-cols-2">
        {welcome.abilities.map((ability) => (
          <li key={ability} className="flex gap-2.5">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-lax-line-strong" />
            <span className="first-letter:uppercase">{ability}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-lax-13 text-lax-muted">
        {welcome.identityStep
          ? "One step first: verify your identity. Your role acts in your name, so we check who you are. It's first under Needs you. "
          : null}
        Your own bids and purchases stay in your personal account. Switch between them from the
        account menu.
      </p>
      <div className="absolute top-3 right-3">
        <Button
          variant="ghost"
          size="icon-md"
          aria-label={`Close the welcome to ${organisationName}`}
          loading={pending}
          icon={<X aria-hidden />}
          onClick={dismiss}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-lax-13 text-lax-danger-fg">
          {error}
        </p>
      ) : null}
    </section>
  );
}
