import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useId } from "react";
import type { MarketingFaqItem } from "./marketing-faq-accordion.js";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

export type MarketingFaqPillsProps = {
  title?: string;
  items: readonly MarketingFaqItem[];
  className?: string;
};

/**
 * Questions as pills (Figma lax.art artwork FAQ): one pill per question, the chosen question's
 * answer open beneath the row. The pills are a native radio group, so the arrow keys and Tab
 * work without script and the page ships no extra client JavaScript. The first question is
 * open to begin with. Renders nothing without questions.
 */
export function MarketingFaqPills({ title = "FAQs", items, className }: MarketingFaqPillsProps) {
  const headingId = useId();
  const groupName = useId();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-4", className)}
      data-testid="marketing-faq-pills"
    >
      <h2
        id={headingId}
        className="m-0 font-body text-base font-semibold leading-5 text-on-surface"
      >
        {title}
      </h2>
      <div role="radiogroup" aria-labelledby={headingId} className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const inputId = `${groupName}-${item.id}-q`;
          const panelId = `${groupName}-${item.id}-a`;
          return (
            <div key={item.id} className="contents">
              <input
                type="radio"
                id={inputId}
                name={groupName}
                value={item.id}
                defaultChecked={index === 0}
                aria-controls={panelId}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input-border bg-transparent px-4 font-body text-sm font-medium text-on-surface transition-colors hover:border-on-surface-variant hover:bg-surface-container-low motion-reduce:transition-none lg:pointer-fine:min-h-10",
                  "peer-checked:border-on-surface peer-checked:bg-surface-container-low",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-on-surface",
                )}
              >
                {item.question}
              </label>
              <section
                id={panelId}
                aria-labelledby={inputId}
                className="order-last hidden w-full flex-col gap-3 text-sm leading-6 text-on-surface peer-checked:flex"
              >
                <p className="m-0 max-w-[65ch]">{item.answer}</p>
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
              </section>
            </div>
          );
        })}
      </div>
    </section>
  );
}
