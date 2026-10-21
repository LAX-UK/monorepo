import { cn } from "@auction/ui";
import { type ComponentPropsWithoutRef, type ReactNode, forwardRef } from "react";

export type MarketingSuccessStateProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"output">, "title">;

/**
 * Confirmation shown in place of a form once it has been sent: a circle and tick that draw
 * themselves, then the message. The drawing is disabled under `prefers-reduced-motion` in
 * `marketing-ui.css`, which leaves the finished tick. It is a polite status region (`<output>`) so screen
 * reader users hear the confirmation; give it `tabIndex={-1}` and a ref to move focus to it.
 */
export const MarketingSuccessState = forwardRef<HTMLOutputElement, MarketingSuccessStateProps>(
  function MarketingSuccessState({ title, description, actions, className, ...props }, ref) {
    return (
      <output
        ref={ref}
        aria-live="polite"
        className={cn("marketing-success-state", className)}
        {...props}
      >
        <svg
          className="marketing-success-state__check"
          viewBox="0 0 48 48"
          width="48"
          height="48"
          fill="none"
          aria-hidden="true"
          data-testid="marketing-success-check"
        >
          <circle
            className="marketing-success-state__circle"
            cx="24"
            cy="24"
            r="22"
            pathLength={1}
          />
          <path className="marketing-success-state__tick" d="M14 25l7 7 13-14" pathLength={1} />
        </svg>
        <p className="marketing-success-state__title">{title}</p>
        {description ? <p className="marketing-success-state__description">{description}</p> : null}
        {actions ? <div className="marketing-success-state__actions">{actions}</div> : null}
      </output>
    );
  },
);
