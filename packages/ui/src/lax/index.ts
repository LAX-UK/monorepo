/**
 * The LAX system primitives: one set of elements for the staff tools (LAX Admin, Bid admin) and
 * the client workspace, on the shared tokens in `@auction/branding/lax-system.css`. Each reads the
 * density its shell sets (`data-lax-density`, `LaxDensityProvider`): staff and client share every
 * token and differ only in type step, control height and a few element sizes.
 *
 * `@auction/staff-ui` re-exports these under its staff names and keeps only staff-only parts.
 */
export {
  LaxDensityProvider,
  laxDensityAttributes,
  useLaxDensity,
  useLayerAttributes,
} from "./density.js";
export type { LaxDensity } from "./density.js";
export { PlainLink } from "./link.js";
export type { LinkComponent, LinkProps } from "./link.js";
export { Button, buttonVariants } from "./button.js";
export { ButtonLink } from "./button-link.js";
export type { ButtonLinkProps } from "./button-link.js";
export type { ButtonProps } from "./button.js";
export { ReasonTooltip, Tooltip, TooltipProvider, tooltipClass } from "./tooltip.js";
export { Kbd, ShortcutKeys } from "./kbd.js";
export { Field, ReadOnlyView, readOnlyBox, useField, useReadOnlyView } from "./field.js";
export type { FieldProps } from "./field.js";
export { TextArea, TextInput, fieldBox } from "./input.js";
export type { TextAreaProps, TextInputProps } from "./input.js";
export { NativeSelect } from "./native-select.js";
export type { NativeSelectOption, NativeSelectProps } from "./native-select.js";
export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./menu.js";
export {
  Count,
  OverflowTabs,
  SecondaryTabNav,
  SegmentedControl,
  TabNav,
  fitViewTabs,
  formatCount,
} from "./tabs.js";
export type { CountTone, SegmentOption, TabNavItem } from "./tabs.js";
export { Switch } from "./switch.js";
export type { SwitchProps } from "./switch.js";
export { Notice } from "./notice.js";
export type { NoticeTone } from "./notice.js";
export { TOAST_DURATION_MS, Toaster, UNDO_TOAST_DURATION_MS } from "./toaster.js";
export { Skeleton } from "./skeleton.js";
export { MetricCell, MetricCellSkeleton, MetricDelta, isLongMetricValue } from "./metric-cell.js";
export type { Metric, MetricCellItem, MetricComparison } from "./metric-cell.js";
export { metricChange } from "./metric-change.js";
export { Sparkline, SparklineSkeleton, sparklinePoints, sparklineToneClass } from "./sparkline.js";
export type { MetricTone } from "./sparkline.js";
export {
  MappedStatusBadge,
  STATUS_BADGE_DEFAULT_SHAPE,
  STATUS_BADGE_TONE_CLASSES,
  StatusBadge,
  defineStatusMap,
  humanizeStatus,
  statusBadgeVariants,
} from "../components/ui/status-badge.js";
export type {
  StatusBadgeProps,
  StatusBadgeShape,
  StatusBadgeTone,
  StatusPresentation,
} from "../components/ui/status-badge.js";
export { Dialog, DialogClose } from "./dialog.js";
export type { DialogPlacement, DialogProps } from "./dialog.js";
export { PresetCards } from "./preset-cards.js";
export type { PresetOption } from "./preset-cards.js";
export { ToggleRow } from "./toggle-row.js";
export type { ToggleRowProps } from "./toggle-row.js";
export { EmptyState } from "./empty-state.js";
export type { EmptyStateProps } from "./empty-state.js";
export {
  FilterButton,
  FilterChips,
  FilterSheet,
  ListSearch,
  ListToolbar,
  ShowingCount,
  SortMenu,
} from "./list-toolbar.js";
export type {
  AppliedFilter,
  ListSearchProps,
  ListToolbarProps,
  SortOption,
} from "./list-toolbar.js";
export { ExportSheet } from "./export-sheet.js";
export type { ExportRequest, ExportScope, ExportSheetProps } from "./export-sheet.js";
export { SearchPalette, useSearchPaletteShortcut } from "./search-palette.js";
export type { PaletteGroup, PaletteItem, SearchPaletteProps } from "./search-palette.js";
export { returnFocusTarget, useReturnFocus } from "./return-focus.js";
