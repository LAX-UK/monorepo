/**
 * The LAX system's plain values: formatters, class lists and constants, with no "use client".
 * Server components import them from here (`@auction/ui/lax/helpers`). The `@auction/ui/lax`
 * barrel re-exports the same modules, so client code may use either.
 *
 * A value exported from a "use client" module is a client reference on the server: calling it
 * there fails ("Attempted to call formatCount() from the server"). Keep every value that is not a
 * component or a hook in a plain module like these; `client-boundary.test.ts` enforces it.
 */
export { buttonVariants } from "./button-variants.js";
export { formatCount } from "./count.js";
export { laxDensityAttributes } from "./density-attributes.js";
export type { LaxDensity } from "./density-attributes.js";
export {
  STATUS_BADGE_DEFAULT_SHAPE,
  STATUS_BADGE_TONE_CLASSES,
  defineStatusMap,
  humanizeStatus,
  statusBadgeVariants,
} from "../components/ui/status-badge.js";
export { isLongMetricValue } from "./metric-cell.js";
export { metricChange } from "./metric-change.js";
export { sparklinePoints, sparklineToneClass } from "./sparkline.js";
export { returnFocusTarget } from "./return-focus-target.js";
export { shortcutKeyCaps } from "./shortcut-key-caps.js";
export { fieldBox, readOnlyBox, tooltipClass } from "./styles.js";
export { fitViewTabs } from "./tabs-fit.js";
export { splitTokens } from "./token-split.js";
export { TOAST_DURATION_MS, UNDO_TOAST_DURATION_MS } from "./toast-durations.js";
