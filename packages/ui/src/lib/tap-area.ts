/**
 * A 44px touch target for a control that is drawn smaller: on a coarse pointer (a finger) an
 * invisible square of at least 44px centres on the control, so it looks the same and is easy to
 * hit. A mouse pointer is unchanged. The control becomes `relative` and uses its `::after`, so
 * leave it off controls that are already positioned or draw their own `::after`.
 */
export const TAP_AREA =
  "relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']";
