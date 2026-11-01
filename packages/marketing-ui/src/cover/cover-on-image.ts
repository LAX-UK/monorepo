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

/** A focus ring that shows on the picture: white on a dark tone, ink on a light one. */
export const ON_IMAGE_FOCUS: Record<CoverTone, string> = {
  light: "md:focus-visible:outline-white md:has-[:focus-visible]:outline-white",
  dark: "md:focus-visible:outline-[#181a1a] md:has-[:focus-visible]:outline-[#181a1a]",
};

/** The email field on a picture: a tinted pane so it reads on any image. */
export const ON_IMAGE_FIELD: Record<CoverTone, { box: string; input: string }> = {
  light: {
    box: "md:border-white/[0.44] md:bg-[rgb(16_18_18/0.44)] md:shadow-none",
    input: "md:text-white md:placeholder:text-white/[0.76]",
  },
  dark: {
    box: "md:border-[#8d9090] md:bg-white/60 md:shadow-none",
    input: "md:text-[#181a1a] md:placeholder:text-[#454848]",
  },
};

/** The status badge: opaque, so it reads on any picture. */
export const ON_IMAGE_BADGE: Record<CoverTone, string> = {
  light: "md:bg-white md:text-[#181a1a]",
  dark: "md:bg-[#181a1a] md:text-white",
};

/** The badge that sits on a phone's picture is opaque in both themes. */
export const PHONE_IMAGE_BADGE = "bg-[#0a0b0b] text-white";
