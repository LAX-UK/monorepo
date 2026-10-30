import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge reads any unknown `text-*` class as a colour, so `text-staff-sm` (a size) and
 * `text-staff-fg` (a colour) would cancel each other out. Naming the staff and LAX scales here (see
 * packages/staff-ui/src/theme.css) keeps sizes, radii, shadows and control heights in their own
 * groups, for every component that merges classes, including the ones staff-ui wraps.
 */
const STAFF_TEXT_SIZES = ["staff-2xs", "staff-xs", "staff-sm", "staff-md", "staff-lg", "staff-xl"];
const STAFF_RADII = ["staff-xs", "staff-sm", "staff-md", "staff-lg"];
const STAFF_SHADOWS = ["staff-xs", "staff-md", "staff-lg"];
const STAFF_SPACING = ["control-xs", "control-sm", "control-md", "control-lg"];

/** The LAX system names (packages/ui/src/lax/theme.css), read by the shared primitives. */
const LAX_TEXT_SIZES = [
  "lax-2xs",
  "lax-12",
  "lax-13",
  "lax-14",
  "lax-16",
  "lax-18",
  "lax-20",
  "lax-24",
  "lax-28",
  "lax-ui",
];
const LAX_RADII = ["lax-badge", "lax-control", "lax-menu", "lax-card"];
const LAX_SHADOWS = ["lax-xs", "lax-md", "lax-lg"];
const LAX_SPACING = ["lax-control-xs", "lax-control-sm", "lax-control-md", "lax-control-lg"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: [...STAFF_SPACING, ...LAX_SPACING] },
    classGroups: {
      "font-size": [{ text: [...STAFF_TEXT_SIZES, ...LAX_TEXT_SIZES] }],
      rounded: [{ rounded: [...STAFF_RADII, ...LAX_RADII] }],
      shadow: [{ shadow: [...STAFF_SHADOWS, ...LAX_SHADOWS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
