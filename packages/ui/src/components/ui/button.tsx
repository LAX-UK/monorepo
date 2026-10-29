"use client";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { DisabledReason } from "./button-disabled-reason.js";

/**
 * Disabled states never fade. A disabled button is drawn in its own pair, distinct from every
 * enabled label at a glance in light and dark: a disabled label (`--color-disabled-fg`), on a
 * faint neutral fill for filled variants (`--color-disabled-bg`) or inside a faint edge for
 * outlined ones (`--color-disabled-border`). A product may set the three tokens; the defaults
 * mix the product's own text into its surface (label 55%, edge 16%, fill 8%), which keeps the
 * label at 3:1 or more, the level WCAG asks of an inactive control. The pair applies to the
 * native `disabled` attribute and to `aria-disabled` alike, and wins over hover and pressed.
 */
const DISABLED_FILLED =
  "disabled:bg-[color:var(--color-disabled-bg,color-mix(in_srgb,var(--color-on-surface)_8%,var(--color-surface)))] disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] disabled:shadow-none aria-disabled:bg-[color:var(--color-disabled-bg,color-mix(in_srgb,var(--color-on-surface)_8%,var(--color-surface)))] aria-disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] aria-disabled:shadow-none";
const DISABLED_OUTLINED =
  "disabled:border-[color:var(--color-disabled-border,color-mix(in_srgb,var(--color-on-surface)_16%,var(--color-surface)))] disabled:bg-transparent disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] disabled:shadow-none aria-disabled:border-[color:var(--color-disabled-border,color-mix(in_srgb,var(--color-on-surface)_16%,var(--color-surface)))] aria-disabled:bg-transparent aria-disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] aria-disabled:shadow-none";
const DISABLED_TEXT =
  "disabled:border-transparent disabled:bg-transparent disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] disabled:no-underline aria-disabled:border-transparent aria-disabled:bg-transparent aria-disabled:text-[color:var(--color-disabled-fg,color-mix(in_srgb,var(--color-on-surface)_55%,var(--color-surface)))] aria-disabled:no-underline";

/**
 * The one primary button of every LAX product: a flat fill in the product's `--color-cta-bg` with
 * `--color-cta-on` text (ink on Bid, Shop and lax.art, teal on LAX Account). Hover and pressed
 * move the fill one and two steps through `--color-cta-bg-hover` and `--color-cta-bg-pressed`;
 * a product may set those tokens, and the defaults mix the fill toward its text colour so the
 * step shows in light and dark alike. The focus ring is the product's `--color-ring`.
 */
const PRIMARY_BUTTON = cn(
  "rounded-md bg-cta-bg text-cta-on shadow-none hover:bg-[var(--color-cta-bg-hover,color-mix(in_srgb,var(--color-cta-bg)_82%,var(--color-cta-on)))] active:bg-[var(--color-cta-bg-pressed,color-mix(in_srgb,var(--color-cta-bg)_70%,var(--color-cta-on)))] focus-visible:ring-ring",
  DISABLED_FILLED,
);

/**
 * The size scale. Each size sets height, padding, label size and icon gap together:
 * - `sm` 32px, 13px label: dense rows and toolbars;
 * - `default` 36px, 14px label: secondary and row actions;
 * - `lg` 44px, 14px label: primary and form actions, and the comfortable tap target. A button
 *   with no size is `lg`, so pages keep the height they were designed at.
 * The other sizes are shapes rather than steps: `icon` and `touch` are square or padded 44px tap
 * targets, `link` and `inline` are text-shaped, and `xl` is the full-width sign-in button.
 */
export const BUTTON_SIZES = {
  sm: "min-h-8 gap-1.5 px-3 py-1.5 text-[0.8125rem] leading-5",
  default: "min-h-9 px-4 py-2 text-sm leading-5",
  lg: "min-h-11 px-6 py-3 text-sm leading-5",
  icon: "min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] h-[var(--tap-target-min,44px)] w-[var(--tap-target-min,44px)]",
  /** Touch-friendly icon button */
  touch: "min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] px-3",
  /** Link-shaped controls — no block tap target */
  link: "h-auto min-h-0 p-0",
  /** Text-shaped controls that keep the 44px tap target */
  inline: "h-auto min-h-[var(--tap-target-min,44px)] px-0 py-0",
  /** Full-width auth / hero primary button */
  xl: "h-[60px] min-h-[44px] w-full px-8 py-[18px] text-base font-semibold leading-6",
} as const;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /**
         * Filled buttons never fade: hover and pressed mix the fill one and two steps toward its own
         * label colour, the same rule as the primary, on each variant's own surface.
         */
        default: cn(
          "bg-primary text-on-primary shadow hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,var(--color-on-primary))] active:bg-[color-mix(in_srgb,var(--color-primary)_72%,var(--color-on-primary))]",
          DISABLED_FILLED,
        ),
        /** The primary action (see `PRIMARY_BUTTON`). */
        primary: PRIMARY_BUTTON,
        destructive: cn(
          "bg-error text-on-error shadow-sm hover:bg-[color-mix(in_srgb,var(--color-error)_85%,var(--color-on-error))] active:bg-[color-mix(in_srgb,var(--color-error)_72%,var(--color-on-error))]",
          DISABLED_FILLED,
        ),
        success: cn(
          "bg-success text-on-success shadow-sm hover:bg-[color-mix(in_srgb,var(--color-success)_85%,var(--color-on-success))] active:bg-[color-mix(in_srgb,var(--color-success)_72%,var(--color-on-success))]",
          DISABLED_FILLED,
        ),
        outline: cn(
          "border border-outline-variant/25 bg-surface-container-lowest shadow-sm hover:bg-surface-container-low",
          DISABLED_OUTLINED,
        ),
        secondary: cn(
          "bg-secondary-container text-on-secondary-container shadow-sm hover:bg-[color-mix(in_srgb,var(--color-secondary-container)_88%,var(--color-on-secondary-container))] active:bg-[color-mix(in_srgb,var(--color-secondary-container)_78%,var(--color-on-secondary-container))]",
          DISABLED_FILLED,
        ),
        /**
         * The secondary action: a 1px edge, no fill and no shadow, so it sits on a page or a tinted
         * band alike. The edge is the product's `--color-button-secondary-border` (lax.art uses its
         * 3:1 field edge), falling back to the hairline. Hover and pressed tint the fill.
         */
        secondaryOutline: cn(
          "rounded-md border border-[color:var(--color-button-secondary-border,var(--color-border-hairline))] bg-transparent font-label font-semibold text-on-surface shadow-none hover:bg-surface-container-low active:bg-surface-container",
          DISABLED_OUTLINED,
        ),
        ghost: cn("hover:bg-surface-container-high hover:text-on-surface", DISABLED_TEXT),
        link: cn("text-primary underline-offset-4 hover:underline", DISABLED_TEXT),
        /** Text link with underline-on-hover (legacy app tertiary). */
        tertiary: cn(
          "h-auto min-h-0 rounded-none border-b border-primary/0 bg-transparent p-0 px-0 py-2 font-label text-label font-semibold text-primary shadow-none hover:border-primary focus-visible:ring-accent-brand",
          DISABLED_TEXT,
        ),
        ctaLink: cn(
          "h-auto min-h-0 rounded-none bg-transparent p-0 font-label text-xs font-semibold text-primary shadow-none hover:underline focus-visible:ring-accent-brand",
          DISABLED_TEXT,
        ),
        /** Underlined label-caps text action with a 44px tap target (card “Enquire”, inline actions). */
        underline: cn(
          "rounded-none bg-transparent font-label text-xs font-semibold text-on-surface underline decoration-1 underline-offset-4 shadow-none hover:decoration-2",
          DISABLED_TEXT,
        ),
        /** The same primary action under its earlier marketing name. */
        cta: PRIMARY_BUTTON,
        /** “Join live” style — border + label caps */
        liveJoin: cn(
          "rounded border border-brand-100 bg-transparent font-label text-base font-semibold text-brand-100 shadow-none hover:bg-white/5 dark:border-on-surface-variant dark:text-on-surface-variant",
          DISABLED_OUTLINED,
        ),
        /** Text “View all” with chevron slot — pair with `asChild` + Link */
        chevron: cn(
          "h-auto min-h-[44px] rounded-none bg-transparent p-0 font-label text-base font-semibold text-brand-900 shadow-none hover:underline focus-visible:ring-accent-brand dark:text-on-surface",
          DISABLED_TEXT,
        ),
      },
      size: BUTTON_SIZES,
    },
    defaultVariants: {
      variant: "default",
      size: "lg",
    },
  },
);

export type ButtonSize = keyof typeof BUTTON_SIZES;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Why the action is unavailable right now ("Accept the agreement first"). When set, the
     * button is disabled with `aria-disabled` instead of `disabled`: it stays focusable, reads the
     * reason as its description and shows it in a tooltip, and pressing it does nothing.
     */
    disabledReason?: string | undefined;
  };

function resolveSize(variant: ButtonProps["variant"], size: ButtonProps["size"]) {
  if (
    variant === "tertiary" ||
    variant === "ctaLink" ||
    variant === "link" ||
    variant === "chevron"
  )
    return "link";
  if (variant === "underline") return "inline";
  return size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disabledReason, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const classes = cn(buttonVariants({ variant, size: resolveSize(variant, size) }), className);
    const reason = disabledReason?.trim();
    if (!reason) return <Comp className={classes} ref={ref} {...props} />;

    const { disabled: _native, onClick: _action, "aria-describedby": describedBy, ...rest } = props;
    return (
      <DisabledReason reason={reason} describedBy={describedBy}>
        {(blocked) => <Comp className={classes} ref={ref} {...rest} {...blocked} />}
      </DisabledReason>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
