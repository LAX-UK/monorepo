import type { ReactNode } from "react";

export type EmptyStateProps = {
  title: string;
  description?: string | undefined;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-8 text-center ring-1 ring-outline-variant/10">
      {icon ? <div className="mb-4 flex justify-center text-secondary">{icon}</div> : null}
      <p className="font-headline text-lg text-on-surface">{title}</p>
      {description ? (
        <p className="mt-2 font-body text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
