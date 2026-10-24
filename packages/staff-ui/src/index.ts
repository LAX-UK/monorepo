// Tokens
export * from "./tokens.js";
export { cn, STAFF_LAYER } from "./lib/cn.js";
export { formatGbp, formatPenceAsPounds, parsePoundsToPence } from "./lib/money.js";
export type { ParsedPence } from "./lib/money.js";

// Primitives
export { StaffButton, staffButtonVariants } from "./primitives/button.js";
export type { StaffButtonProps } from "./primitives/button.js";
export { Kbd, TextArea, TextInput, staffFieldBox } from "./primitives/input.js";
export type { TextAreaProps, TextInputProps } from "./primitives/input.js";
export {
  ChoiceRow,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  StaffSwitch,
} from "./primitives/choice.js";
export {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
  StaffTooltip,
} from "./primitives/menu.js";
export { Count, SegmentedControl, TabNav } from "./primitives/tabs.js";
export type { SegmentOption, TabNavItem } from "./primitives/tabs.js";

// Display
export {
  MappedStatusBadge,
  StatusBadge,
  defineStatusMap,
  humanizeStatus,
} from "./display/status-badge.js";
export type { StatusPresentation } from "./display/status-badge.js";
export { KeyValueList } from "./display/key-value-list.js";
export { StatGrid } from "./display/stat-grid.js";
export type { StatItem } from "./display/stat-grid.js";
export type { KeyValueItem } from "./display/key-value-list.js";
export { Timeline, formatStaffDateTime } from "./display/timeline.js";
export type { TimelineEvent } from "./display/timeline.js";
export {
  EmptyState,
  ErrorState,
  NoResultsState,
  Section,
  Skeleton,
} from "./display/states.js";

// Forms
export { Field, useStaffField } from "./forms/field.js";
export type { FieldProps } from "./forms/field.js";
export { MoneyInput } from "./forms/money-input.js";
export type { MoneyInputProps } from "./forms/money-input.js";
export { EnumSelect } from "./forms/enum-select.js";
export type { EnumOption, EnumSelectProps } from "./forms/enum-select.js";
export { EntityPicker } from "./forms/entity-picker.js";
export type { EntityOption, EntityPickerProps } from "./forms/entity-picker.js";
export {
  DangerZone,
  DangerZoneAction,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
} from "./forms/form-section.js";

// Data
export { DataTable } from "./data/data-table.js";
export type { DataTableProps } from "./data/data-table.js";
export { BulkActionBar } from "./data/bulk-action-bar.js";
export {
  DEFAULT_DATE_PRESETS,
  DateRangeFilter,
  daysBefore,
  londonToday,
} from "./data/date-range-filter.js";
export type { DateRangePreset, DayRange } from "./data/date-range-filter.js";
export { ListPageSkeleton } from "./data/list-page-skeleton.js";
export {
  ActiveFilterChips,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  FilterMenu,
  TablePagination,
  TableSearch,
  useTableDensity,
} from "./data/toolbar.js";
export type { ActiveFilter, DataView, FilterOption } from "./data/toolbar.js";
export { SavedViewsError, sameViewQuery, useSavedViews, viewQuery } from "./data/saved-views.js";
export type {
  SavedView,
  SavedViewItem,
  SavedViewsControls,
  SavedViewsErrorCode,
  SavedViewsPort,
  SavedViewsResult,
} from "./data/saved-views.js";
export { VIEW_LABEL_MAX_LENGTH, ViewsMenu } from "./data/views-menu.js";
export type { TeamView } from "./data/views-menu.js";
export type { DataColumn, SortDirection, SortState, TableDensity } from "./data/types.js";

// Panels
export { DetailPanel, PanelSection } from "./panels/detail-panel.js";
export type { DetailPanelProps } from "./panels/detail-panel.js";
export { ConfirmActionDialog, StaffDialog } from "./panels/staff-dialog.js";
export type { StaffDialogProps } from "./panels/staff-dialog.js";
export { StaffToaster } from "./panels/toaster.js";
/** Toasts for the StaffToaster: `toast.success("Refund requested")`. */
export { toast } from "sonner";

// Shell
export { StaffShell, STAFF_NAV_COOKIE } from "./shell/staff-shell.js";
export type { StaffShellProps } from "./shell/staff-shell.js";
export { AccountMenu, initialsOf } from "./shell/account-menu.js";
export { ProductMark, ProductSwitcher } from "./shell/product-switcher.js";
export { STAFF_PRODUCT_IDS, buildStaffProducts } from "./shell/staff-products.js";
export type { StaffProductId } from "./shell/staff-products.js";
export { CommandPalette, useCommandPaletteShortcut } from "./shell/command-palette.js";
export { StaffBreadcrumbs } from "./shell/breadcrumbs.js";
export { MetaItem, PageHeader, STAFF_PAGE_TITLE_CLASS } from "./shell/page-header.js";
export type { PageHeaderProps } from "./shell/page-header.js";
export { OverflowMenu } from "./shell/overflow-menu.js";
export {
  STAFF_THEME_COOKIE,
  applyStaffTheme,
  parseStaffTheme,
  staffThemeHtmlAttributes,
} from "./shell/theme.js";
export type { OverflowAction } from "./shell/overflow-menu.js";
export { SidebarNav, resolveActiveItem } from "./shell/sidebar-nav.js";
export { PlainLink } from "./shell/link.js";
export type { StaffLinkComponent, StaffLinkProps } from "./shell/link.js";
export type {
  StaffBreadcrumb,
  StaffCommand,
  StaffCommandSearch,
  StaffNavGroup,
  StaffNavItem,
  StaffProduct,
  StaffTheme,
  StaffUser,
} from "./shell/types.js";
