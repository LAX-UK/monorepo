import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { Fragment, useId } from "react";
import type { MarketingFaqItem } from "./marketing-faq-accordion.js";
import { MARKETING_FAQ_COPY } from "./marketing-faq.copy.js";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

export type MarketingFaqPillsProps = {
  title?: string;
  items: readonly MarketingFaqItem[];
  className?: string;
};

/**
 * Shows answer k when the k-th radio of the group is checked. The class names are written out
 * so Tailwind can see them; the answers sit after the group, so only the pills are in it.
 */
const SHOW_WHEN_CHOSEN = [
  "group-has-[input:nth-of-type(1):checked]:flex",
  "group-has-[input:nth-of-type(2):checked]:flex",
  "group-has-[input:nth-of-type(3):checked]:flex",
  "group-has-[input:nth-of-type(4):checked]:flex",
  "group-has-[input:nth-of-type(5):checked]:flex",
  "group-has-[input:nth-of-type(6):checked]:flex",
  "group-has-[input:nth-of-type(7):checked]:flex",
  "group-has-[input:nth-of-type(8):checked]:flex",
  "group-has-[input:nth-of-type(9):checked]:flex",
  "group-has-[input:nth-of-type(10):checked]:flex",
] as const;

/**
 * Questions as pills (Figma lax.art artwork FAQ): one pill per question, the chosen question's
 * answer open beneath the row. The pills are native radios in a fieldset, so the arrow keys and
 * Tab work without script and the page ships no extra client JavaScript. The answers follow the
 * group as plain blocks (not landmarks) and show through `:has()` on the checked pill. The first
 * question is open to begin with. At most ten questions show. Renders nothing without questions.
 */
export function MarketingFaqPills({
  title = MARKETING_FAQ_COPY.title,
  items,
  className,
}: MarketingFaqPillsProps) {
  const groupName = useId();
  const shown = items.slice(0, SHOW_WHEN_CHOSEN.length);
  if (shown.length === 0) return null;
  return (
    <section
      className={cn("group flex flex-col gap-4", className)}
      data-testid="marketing-faq-pills"
    >
      <h2 className="m-0 font-body text-base font-semibold leading-5 text-on-surface">{title}</h2>
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{title}</legend>
        {shown.map((item, index) => {
          const inputId = `${groupName}-${item.id}-q`;
          return (
            <Fragment key={item.id}>
              <input
                type="radio"
                id={inputId}
                name={groupName}
                value={item.id}
                defaultChecked={index === 0}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "marketing-chip-choice inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input-border bg-transparent px-4 py-2 text-left font-body text-sm font-medium text-on-surface transition-colors hover:border-on-surface-variant hover:bg-surface-container-low motion-reduce:transition-none lg:pointer-fine:min-h-10",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                )}
              >
                {item.question}
              </label>
            </Fragment>
          );
        })}
      </fieldset>
      {shown.map((item, index) => (
        <div
          key={item.id}
          data-testid="marketing-faq-answer"
          className={cn(
            "hidden flex-col gap-3 text-sm leading-6 text-on-surface",
            SHOW_WHEN_CHOSEN[index],
          )}
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
        </div>
      ))}
    </section>
  );
}
