import * as React from "react";
import { cn } from "../../lib/utils.js";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 border-b border-outline-variant/10 pb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="font-headline text-3xl tracking-tight text-on-surface md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
