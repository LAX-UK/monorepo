import type { CoverTone } from "./cover-types.js";

/**
 * Controls on a picture take their colours from the picture's tone, not from the page theme, so
 * these are fixed fills (desktop only: on a phone the controls sit on the page below the image).
 * Each class is written out in full so the Tailwind scanner finds it.
 */
export const ON_IMAGE_BUTTON: Record<CoverTone, string> = {
  light:
    "md:border-transparent md:bg-white md:text-[#181a1a] md:shadow-none md:hover:bg-[#ececec] md:active:bg-[#dddddd]",
  dark: "md:border-transparent md:bg-[#181a1a] md:text-white md:shadow-none md:hover:bg-[#2b2e2e] md:active:bg-[#3b3e3e]",
};

/** The status badge: opaque, so it reads on any picture. */
export const ON_IMAGE_BADGE: Record<CoverTone, string> = {
  light: "md:bg-white md:text-[#181a1a]",
  dark: "md:bg-[#181a1a] md:text-white",
};

/** The badge that sits on a phone's picture is opaque in both themes. */
export const PHONE_IMAGE_BADGE = "bg-[#0a0b0b] text-white";
