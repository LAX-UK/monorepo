import { cva } from "class-variance-authority";

/**
 * The look of the LAX system button, for the staff tools and the client workspace. Five variants: primary
 * (one per view, a flat ink fill), secondary, ghost (toolbars, rows), danger (the final
 * destructive confirm, red fill) and danger-secondary (a destructive action that opens that
 * confirm). Sizes: sm 32, md 36 and lg 44; the label follows the density (13px staff, 14px
 * client), and in the client workspace every size grows to 44px on a phone. Icons are 16px in
 * every size so they centre on the same optical line as the label.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-lax-control font-lax text-lax-ui font-medium",
    "transition-[background-color,border-color,color,box-shadow] duration-150 ease-out",
    "lax-focus lax-target",
    "disabled:cursor-not-allowed aria-disabled:pointer-events-none",
    "data-[loading]:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-lax-ink text-lax-on-ink",
          "hover:bg-lax-ink-hover active:bg-lax-ink-pressed",
          "disabled:bg-lax-line disabled:text-lax-disabled-fg aria-disabled:bg-lax-line aria-disabled:text-lax-disabled-fg aria-disabled:opacity-100",
        ],
        secondary: [
          "border border-lax-line-strong bg-lax-surface text-lax-fg shadow-lax-xs",
          "hover:lax-overlay-hover active:lax-overlay-pressed",
          "disabled:border-lax-line disabled:bg-lax-sunken disabled:text-lax-disabled-fg disabled:shadow-none",
          "aria-disabled:border-lax-line aria-disabled:bg-lax-sunken aria-disabled:text-lax-disabled-fg aria-disabled:shadow-none",
          "disabled:bg-none aria-disabled:bg-none",
          "data-[state=open]:lax-overlay-pressed",
        ],
        ghost: [
          "bg-transparent text-lax-fg",
          "hover:bg-lax-hover active:bg-lax-pressed data-[state=open]:bg-lax-pressed",
          "disabled:bg-transparent disabled:text-lax-disabled-fg aria-disabled:bg-transparent aria-disabled:text-lax-disabled-fg",
        ],
        danger: [
          "bg-lax-danger-solid text-lax-on-danger",
          "hover:bg-lax-danger-solid-hover active:bg-lax-danger-solid-pressed",
          "disabled:bg-lax-line disabled:text-lax-disabled-fg aria-disabled:bg-lax-line aria-disabled:text-lax-disabled-fg aria-disabled:opacity-100",
        ],
        "danger-secondary": [
          "border border-lax-line-strong bg-lax-surface text-lax-danger shadow-lax-xs",
          "hover:lax-overlay-hover active:lax-overlay-pressed",
          "disabled:border-lax-line disabled:bg-lax-sunken disabled:text-lax-disabled-fg disabled:shadow-none",
          "aria-disabled:border-lax-line aria-disabled:bg-lax-sunken aria-disabled:text-lax-disabled-fg aria-disabled:shadow-none",
          "disabled:bg-none aria-disabled:bg-none",
        ],
      },
      size: {
        sm: "h-lax-control-sm px-3",
        md: "h-lax-control-md px-3.5 in-data-[lax-density=client]:px-4",
        /** 44px at every pointer: actions taken under time pressure, and the client phone default. */
        lg: "h-lax-control-lg px-4 in-data-[lax-density=client]:px-6",
        "icon-xs": "size-lax-control-xs rounded-lax-badge",
        "icon-sm": "size-lax-control-sm",
        "icon-md": "size-lax-control-md",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);
