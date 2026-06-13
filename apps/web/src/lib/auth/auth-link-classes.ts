import { FOCUS_RING } from "@/lib/marketing/chrome";

/** Standard auth inline link (midnight brand). */
export const AUTH_INLINE_LINK = `font-medium text-link underline underline-offset-2 ${FOCUS_RING}`;

/** Auth footer / secondary nav link with Outfit stack. */
export const AUTH_FOOTER_LINK = `inline-flex min-h-11 items-center font-footer-links text-sm font-medium text-link underline underline-offset-2 ${FOCUS_RING}`;

/** Compact uppercase auth action (e.g. sign out). */
export const AUTH_LABEL_LINK = `font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline ${FOCUS_RING}`;

/** Centered footer link row (sign up / sign in prompts). */
export const AUTH_FOOTER_LINK_ROW = `min-h-[44px] content-center font-footer-links text-sm font-medium text-link underline underline-offset-2 ${FOCUS_RING}`;
