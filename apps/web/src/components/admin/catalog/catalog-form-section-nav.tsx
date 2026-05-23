"use client";

import { cn } from "@auction/ui";

export type CatalogFormSection = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  sections: readonly CatalogFormSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  "aria-label": string;
  className?: string;
};

/** In-page section control for multi-form catalog edit pages. */
export function CatalogFormSectionNav({
  sections,
  activeSection,
  onSectionChange,
  "aria-label": ariaLabel,
  className,
}: Props) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-outline-variant/40 bg-surface-container-low p-1 scrollbar-thin",
        className,
      )}
    >
      {sections.map((section) => {
        const selected = section.id === activeSection;
        return (
          <button
            key={section.id}
            type="button"
            disabled={section.disabled}
            aria-current={selected ? "page" : undefined}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
