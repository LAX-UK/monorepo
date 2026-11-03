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

/**
 * The error summary on a picture: the danger notice's light-theme colours in both themes, because
 * a picture does not change with the theme and the notice must stay readable on any of them.
 */
export const ON_IMAGE_ERROR_SUMMARY = "md:border-[#a8261b]/30 md:bg-[#fcecea] md:text-[#a8261b]";

/** The status badge: opaque, so it reads on any picture. */
export const ON_IMAGE_BADGE: Record<CoverTone, string> = {
  light: "md:bg-white md:text-[#181a1a]",
  dark: "md:bg-[#181a1a] md:text-white",
};

/** The badge that sits on a phone's picture is opaque in both themes. */
export const PHONE_IMAGE_BADGE = "bg-[#0a0b0b] text-white";

/**
 * What a pale plate (tone "dark") turns into in the dark theme, where its field is deep and the
 * type is light: the light tone's fills, written out in full for the Tailwind scanner and marked
 * important so they win over the pale tone's own classes.
 */
export const ON_IMAGE_DARK_THEME = {
  button:
    "dark:md:bg-white! dark:md:text-[#181a1a]! dark:md:hover:bg-[#ececec]! dark:md:active:bg-[#dddddd]!",
  focus: "dark:md:focus-visible:outline-white! dark:md:has-[:focus-visible]:outline-white!",
  field: {
    box: "dark:md:border-white/[0.44]! dark:md:bg-[rgb(16_18_18/0.44)]!",
    input: "dark:md:text-white! dark:md:placeholder:text-white/[0.76]!",
  },
  badge: "dark:md:bg-white! dark:md:text-[#181a1a]!",
} as const;

/** The classes for a control on the picture: its tone's, and the dark theme's when the plate switches. */
export function onImageButton(tone: CoverTone, swap: boolean): string {
  return swap ? `${ON_IMAGE_BUTTON[tone]} ${ON_IMAGE_DARK_THEME.button}` : ON_IMAGE_BUTTON[tone];
}

export function onImageFocus(tone: CoverTone, swap: boolean): string {
  return swap ? `${ON_IMAGE_FOCUS[tone]} ${ON_IMAGE_DARK_THEME.focus}` : ON_IMAGE_FOCUS[tone];
}
