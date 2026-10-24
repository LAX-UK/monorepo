import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge reads any unknown `text-*` class as a colour, so `text-staff-sm` (a size) and
 * `text-staff-fg` (a colour) would cancel each other out. Naming the staff scale here (see
 * packages/staff-ui/src/theme.css) keeps sizes, radii, shadows and control heights in their own
 * groups, for every component that merges classes, including the ones staff-ui wraps.
 */
const STAFF_TEXT_SIZES = ["staff-2xs", "staff-xs", "staff-sm", "staff-md", "staff-lg", "staff-xl"];
const STAFF_RADII = ["staff-xs", "staff-sm", "staff-md", "staff-lg"];
const STAFF_SHADOWS = ["staff-xs", "staff-md", "staff-lg"];
const STAFF_SPACING = ["control-xs", "control-sm", "control-md", "control-lg"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: STAFF_SPACING },
    classGroups: {
      "font-size": [{ text: STAFF_TEXT_SIZES }],
      rounded: [{ rounded: STAFF_RADII }],
      shadow: [{ shadow: STAFF_SHADOWS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
