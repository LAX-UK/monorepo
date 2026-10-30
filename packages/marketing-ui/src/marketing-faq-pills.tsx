import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useId } from "react";
import { MarketingArrowRightIcon, MarketingPlusIcon } from "./marketing-icons.js";

export type MarketingFaqPill = {
  id: string;
  question: string;
  answer: string;
  /** Where to read more, when the answer has a page. */
  link?: { label: string; href: string };
};

export type MarketingFaqPillsProps = {
  title?: string;
  items: readonly MarketingFaqPill[];
  className?: string;
};

/**
 * Questions as full-width pills (Figma artwork FAQs, `468:7996`). Each pill is a native
 * disclosure: it opens its answer in place, works without script and keeps one tab stop per
 * question. Renders nothing without questions.
 */
export function MarketingFaqPills({ title = "FAQs", items, className }: MarketingFaqPillsProps) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-4", className)}
      data-testid="marketing-faq-pills"
    >
      <h2
        id={headingId}
        className="m-0 font-headline text-[length:var(--text-title-section,1.5rem)] font-medium leading-[1.2] text-on-surface"
      >
        {title}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <details className="group rounded-[1.5rem] border border-[var(--color-button-secondary-border,var(--color-outline-variant))] bg-surface open:rounded-lg">
              <summary
                className={cn(
                  "flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] px-5 py-3 font-body text-sm font-medium leading-5 text-on-surface hover:bg-surface-container-low group-open:rounded-b-none group-open:rounded-t-lg [&::-webkit-details-marker]:hidden",
                  FOCUS_RING,
                )}
              >
                <span className="min-w-0">{item.question}</span>
                <MarketingPlusIcon
                  aria-hidden
                  className="size-4 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
                <p className="m-0 max-w-[65ch] font-body text-sm leading-6 text-on-surface-variant">
                  {item.answer}
                </p>
                {item.link ? (
                  <Link
                    href={item.link.href}
                    className={cn(
                      "inline-flex w-fit items-center gap-2 rounded-sm font-body text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2",
                      FOCUS_RING,
                    )}
                  >
                    {item.link.label}
                    <MarketingArrowRightIcon className="size-4" />
                  </Link>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
