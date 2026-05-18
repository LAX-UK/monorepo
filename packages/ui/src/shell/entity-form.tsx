import type * as React from "react";
import { PageHeader, type PageHeaderProps } from "../components/ui/page-header.js";
import { Surface } from "../components/ui/surface.js";
import { cn } from "../lib/utils.js";

export type EntityFormSection = {
  id: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export type EntityFormProps = {
  header: PageHeaderProps;
  sections: readonly EntityFormSection[];
  actions?: React.ReactNode;
  className?: string;
};

/** Standard form page layout — one surface per section, no card nesting. */
export function EntityForm({ header, sections, actions, className }: EntityFormProps) {
  return (
    <div className={cn("screen w-full space-y-8", className)}>
      <PageHeader {...header} className={cn("mb-0 border-0 pb-0", header.className)} />
      <div className="space-y-6">
        {sections.map((section) => (
          <Surface key={section.id} variant="section" id={section.id}>
            {section.title ? (
              <h2 className="mb-4 font-headline text-lg tracking-tight text-on-surface">
                {section.title}
              </h2>
            ) : null}
            {section.description ? (
              <p className="mb-4 font-body text-sm text-on-surface-variant">
                {section.description}
              </p>
            ) : null}
            {section.children}
          </Surface>
        ))}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 border-t border-border-hairline pt-6">{actions}</div>
      ) : null}
    </div>
  );
}
