import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  /** What the section holds and how changes to it behave. */
  description: ReactNode;
  children: ReactNode;
};

/**
 * One section of a settings tab (Profile, Payouts, Security): the title and what it is for in a
 * label column, the card beside it. On a phone the label sits above the card.
 */
export function SettingsSection({ id, title, description, children }: Props) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-lax-line pt-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-lax-display text-lax-18 font-semibold text-lax-fg">
          {title}
        </h2>
        <div className="text-lax-14 text-lax-muted">{description}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** The card a settings section's rows sit on. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-lax-line-subtle overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
      {children}
    </div>
  );
}

/** One row of a settings card: a label and its value, and an action at the end. */
export function SettingsRow({
  label,
  value,
  muted = false,
  action,
}: {
  label: ReactNode;
  value: ReactNode;
  /** The value is an empty state ("None. Add one…"), read in the muted colour. */
  muted?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-4 md:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-lax-13 text-lax-muted">{label}</div>
        <div
          className={
            muted ? "text-lax-14 text-lax-muted" : "break-words text-lax-14 font-medium text-lax-fg"
          }
        >
          {value}
        </div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
