import { CountPill } from "@auction/ui/components/count-pill";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  /** Shown as a pill after the title; nothing for zero. */
  count?: number;
  countLabel?: string;
  description?: string;
  children: ReactNode;
};

/** One card on the Members tab, built like the Home sections so the workspace reads as one. */
export function TeamSection({ id, title, count, countLabel, description, children }: Props) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} data-testid={id}>
      <Surface variant="section" padding="none" className="p-4 sm:p-6">
        <div className="space-y-1">
          <h2
            id={headingId}
            className="flex items-center gap-2 font-headline text-lg leading-6.5 font-semibold tracking-tight text-on-surface"
          >
            {title}
            {count !== undefined ? (
              <CountPill value={count} {...(countLabel ? { label: countLabel } : {})} />
            ) : null}
          </h2>
          {description ? (
            <p className="max-w-prose font-body text-sm leading-5.5 text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </Surface>
    </section>
  );
}
