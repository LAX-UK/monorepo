import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useId } from "react";
import { MarketingDetailAccordion } from "./marketing-detail-accordion.js";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

export type MarketingFaqItem = {
  id: string;
  question: string;
  answer: string;
  /** Where to read more, when the answer has a page. */
  link?: { label: string; href: string };
};

export type MarketingFaqAccordionProps = {
  title?: string;
  items: readonly MarketingFaqItem[];
  className?: string;
};

/**
 * Questions that open their answers in place, on the shared detail accordion, under the same
 * section heading as the detail tabs beside them. Renders nothing without questions.
 */
export function MarketingFaqAccordion({
  title = "FAQs",
  items,
  className,
}: MarketingFaqAccordionProps) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3", className)}
      data-testid="marketing-faq-accordion"
    >
      <h2
        id={headingId}
        className="m-0 font-body text-base font-semibold leading-5 text-on-surface"
      >
        {title}
      </h2>
      <MarketingDetailAccordion
        items={items.map((item) => ({
          id: item.id,
          title: item.question,
          content: (
            <div className="flex flex-col gap-3">
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
            </div>
          ),
        }))}
      />
    </section>
  );
}
