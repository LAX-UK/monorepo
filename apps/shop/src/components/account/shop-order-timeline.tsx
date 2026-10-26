import type { ShopOrderTimelineStep } from "@/lib/account/shop-orders.vm";
import { MarketingArrowUpRightIcon, MarketingCheckIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

const STATE_TEXT: Record<ShopOrderTimelineStep["state"], string> = {
  done: "Done",
  next: "Next",
  upcoming: "Not yet",
};

/**
 * The order's progress as a vertical list: reached stages with their dates, the stage expected
 * next, and the stages after it. Each step says its state in words for screen readers; the marker
 * only repeats it.
 */
export function ShopOrderTimeline({ steps }: { steps: readonly ShopOrderTimelineStep[] }) {
  return (
    <ol className="shop-timeline">
      {steps.map((step) => (
        <li
          key={step.id}
          className={cn("shop-timeline__step", `is-${step.state}`)}
          {...(step.state === "next" ? { "aria-current": "step" as const } : {})}
        >
          <span className="shop-timeline__marker" aria-hidden>
            {step.state === "done" ? <MarketingCheckIcon className="shop-timeline__check" /> : null}
          </span>
          <div className="shop-timeline__body">
            <p className="shop-timeline__label">
              {step.label}
              <span className="sr-only">: {STATE_TEXT[step.state]}</span>
            </p>
            {step.dateTime && step.dateLabel ? (
              <time className="shop-timeline__date" dateTime={step.dateTime}>
                {step.dateLabel}
              </time>
            ) : null}
            {step.detail ? <p className="shop-timeline__detail">{step.detail}</p> : null}
            {step.link ? (
              <a
                href={step.link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="shop-inline-link shop-focus-ring shop-timeline__link"
              >
                {step.link.label}
                <MarketingArrowUpRightIcon className="shop-timeline__link-icon" aria-hidden />
                <span className="sr-only"> on the carrier's website (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
