// Tokens
export * from "./tokens.js";
export { cn, STAFF_LAYER } from "./lib/cn.js";
export { formatGbp, formatPenceAsPounds, parsePoundsToPence } from "./lib/money.js";
export type { ParsedPence } from "./lib/money.js";
export { formatRateAsPercent, formatStaffPercent, parsePercentToRate } from "./lib/percent.js";
export type { ParsedRate } from "./lib/percent.js";
export {
  STAFF_TIME_ZONE,
  formatStaffDate,
  formatStaffDateTime,
  formatStaffMoney,
  formatStaffRelative,
  formatStaffTime,
  londonZoneLabel,
} from "./lib/format.js";

// Primitives
export { StaffButton, staffButtonVariants } from "./primitives/button.js";
export type { StaffButtonProps } from "./primitives/button.js";
export { HoldButton, STAFF_HOLD_MS } from "./primitives/hold-button.js";
export type { HoldButtonProps } from "./primitives/hold-button.js";
export {
  Kbd,
  ShortcutKeys,
  TextArea,
  TextInput,
  fieldBox as staffFieldBox,
} from "@auction/ui/lax";
export type { TextAreaProps, TextInputProps } from "@auction/ui/lax";
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
  StaffMenuRadioGroup,
  StaffMenuRadioItem,
  StaffMenuSeparator,
  StaffMenuTrigger,
  StaffTooltip,
  StaffTooltipProvider,
} from "./primitives/menu.js";
export {
  Count,
  OverflowTabs,
  SecondaryTabNav,
  SegmentedControl,
  TabNav,
} from "@auction/ui/lax";
export type { CountTone, SegmentOption, TabNavItem } from "@auction/ui/lax";

// Display
export {
  MappedStatusBadge,
  StatusBadge,
  defineStatusMap,
  humanizeStatus,
} from "@auction/ui/lax";
export type { StatusPresentation } from "@auction/ui/lax";
export { KeyValueList } from "./display/key-value-list.js";
export { Notice } from "@auction/ui/lax";
export { RecordImage } from "./display/record-image.js";
export { ImageGallery, type ImageGalleryItem } from "./display/image-gallery.js";
export { StatGrid } from "./display/stat-grid.js";
export type { StatItem } from "./display/stat-grid.js";
export type { KeyValueItem } from "./display/key-value-list.js";
export { Timeline } from "./display/timeline.js";
export { RelativeTime } from "./display/relative-time.js";
export {
  STAFF_TRUNCATION_TOOLTIP_DELAY_MS,
  TruncatedText,
} from "./display/truncated-text.js";
export { TextLink, staffTextLinkClass } from "./display/text-link.js";
export { AttentionList } from "./display/attention-list.js";
export { LinkList } from "./display/link-list.js";
export type { LinkListItem } from "./display/link-list.js";
export { IssueList } from "./display/issue-list.js";
export { Checklist } from "./display/checklist.js";
export type { ChecklistItem } from "./display/checklist.js";
export type { IssueItem } from "./display/issue-list.js";
export type { AttentionItem } from "./display/attention-list.js";
export type { TimelineEvent } from "./display/timeline.js";
export {
  AccessDeniedState,
  EmptyState,
  ErrorState,
  NoResultsState,
  NotFoundState,
  Section,
  Skeleton,
  ViewOnlyBadge,
} from "./display/states.js";
export { METRIC_STRIP_MAX, MetricStrip } from "./display/metric-strip.js";
export {
  MetricCell,
  MetricDelta,
  Sparkline,
  SparklineSkeleton,
  metricChange,
} from "@auction/ui/lax";
export type { Metric, MetricCellItem, MetricComparison, MetricTone } from "@auction/ui/lax";
export { ProgressBar } from "./display/progress-bar.js";
export { AttentionStrip } from "./display/attention-strip.js";
export type { AttentionStripItem } from "./display/attention-strip.js";

// Forms
export { Field, useField as useStaffField } from "@auction/ui/lax";
export type { FieldProps } from "@auction/ui/lax";
export { MoneyInput } from "./forms/money-input.js";
export {
  DateInput,
  DateTimeInput,
  formatStaffDay,
  isoToLondonWallTime,
  londonClockChange,
  londonWallTimeToIso,
  parseStaffDay,
  parseStaffTime,
} from "./forms/date-input.js";
export type { DateInputProps, DateTimeInputProps, ParsedDay } from "./forms/date-input.js";
export {
  UnsavedChangesDialog,
  UnsavedChangesGuard,
  confirmDiscardChanges,
  discardPrompt,
  hasUnsavedChanges,
  useBeforeUnloadGuard,
  useUnsavedChanges,
} from "./forms/unsaved-changes.js";
export type {
  DiscardPrompt,
  UnsavedChangesOptions,
  UnsavedChangesState,
} from "./forms/unsaved-changes.js";
export { FileDropzone } from "./forms/file-dropzone.js";
export type { FileDropzoneProps } from "./forms/file-dropzone.js";
export { MediaGrid } from "./forms/media-grid.js";
export type { MediaGridItem, MediaGridProps } from "./forms/media-grid.js";
export { UploadQueue } from "./forms/upload-queue.js";
export type { UploadQueueItem } from "./forms/upload-queue.js";
export type { MoneyInputProps } from "./forms/money-input.js";
export { PercentInput } from "./forms/percent-input.js";
export type { PercentInputProps } from "./forms/percent-input.js";
export { EnumSelect } from "./forms/enum-select.js";
export type { EnumOption, EnumSelectProps } from "./forms/enum-select.js";
export { EntityPicker } from "./forms/entity-picker.js";
export type { EntityOption, EntityPickerProps } from "./forms/entity-picker.js";
export { EntityMultiPicker } from "./forms/entity-multi-picker.js";
export type { EntityMultiPickerProps } from "./forms/entity-multi-picker.js";
export {
  DangerZone,
  DangerZoneAction,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
} from "./forms/form-section.js";
export type { FormErrorSummaryProps } from "./forms/form-section.js";
export { ChoiceFieldset } from "./forms/choice-fieldset.js";
export type { ChoiceFieldsetProps } from "./forms/choice-fieldset.js";
export { ReviewSection, StepHeader, StepIndicator } from "./forms/wizard.js";
export { ListEditor } from "./forms/list-editor.js";
export { SortableList } from "./forms/sortable-list.js";
export type { SortableListProps } from "./forms/sortable-list.js";
export { RichTextField } from "./forms/rich-text-field.js";
export type { RichTextFieldProps } from "./forms/rich-text-field.js";
export {
  htmlToSpans,
  normalizeSpans,
  spansToHtml,
  spansToPlainText,
} from "./forms/rich-text-model.js";
export type { RichTextMark, RichTextSpan } from "./forms/rich-text-model.js";
export type { WizardStep } from "./forms/wizard.js";

// Data
export { DataTable } from "./data/data-table.js";
export type { DataTableProps } from "./data/data-table.js";
export { BulkActionBar, useTableSelectionActive } from "./data/bulk-action-bar.js";
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
  fitViewTabs,
  searchChipLabel,
  useTableDensity,
} from "./data/toolbar.js";
export { FilterSheet } from "./data/filter-sheet.js";
export type {
  FilterChecklistSection,
  FilterDateRangeSection,
  FilterEntitySection,
  FilterRadioSection,
  FilterSheetSection,
  FilterSheetValues,
} from "./data/filter-sheet.js";
export { ColumnsMenu, useColumnVisibility, visibleColumns } from "./data/columns-menu.js";
export type { ColumnVisibility } from "./data/columns-menu.js";
export { RowActions, rowActionsColumn } from "./data/row-actions.js";
export { DisplayMenu } from "./data/display-menu.js";
export {
  STAFF_DEFAULT_PAGE_SIZE,
  STAFF_PAGE_SIZES,
  parseStaffPageSize,
} from "./lib/page-size.js";
export type { DisplayPageSize } from "./data/display-menu.js";
export {
  CellLink,
  CellThumbnail,
  EmptyValue,
  PersonCell,
  PrimaryCell,
  StaffDate,
  StaffMoney,
  isEmptyCellValue,
  staffCellLinkClass,
} from "./data/cells.js";

export { RelatedRecordsSection } from "./data/related-records-section.js";
export type { RelatedRecordsSectionProps } from "./data/related-records-section.js";

// Access
export {
  ReadOnlyView as StaffReadOnly,
  readOnlyBox as staffReadOnlyBox,
  useReadOnlyView as useStaffReadOnly,
} from "@auction/ui/lax";
export {
  Permitted,
  StaffAccessProvider,
  usePermittedItems,
  useStaffAccess,
  useStaffCan,
  useStaffPageAccess,
} from "./access/staff-access.js";
export type { StaffAccess, StaffPermission } from "./access/staff-access.js";
export { CsvExportMenu } from "./data/csv-export-menu.js";
export type { CsvExportScope } from "./data/csv-export-menu.js";
export { StaffChip } from "./display/staff-chip.js";
export type { StaffChipProps } from "./display/staff-chip.js";

// Page templates
export { ListPage } from "./templates/list-page.js";
export type { ListPageAccess, ListPageProps, ListPageTable } from "./templates/list-page.js";
export {
  DetailColumns,
  DetailError,
  DetailPage,
  DetailPageSkeleton,
} from "./templates/detail-page.js";
export type { DetailPageProps } from "./templates/detail-page.js";
export { FormPage, FormPageSkeleton } from "./templates/form-page.js";
export type { FormPageProps } from "./templates/form-page.js";
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
export type {
  BulkSelectionScope,
  CellTruncation,
  DataColumn,
  SelectAllMatching,
  SortDirection,
  SortState,
  TableDensity,
} from "./data/types.js";

// Panels
export { DetailPanel, PanelSection } from "./panels/detail-panel.js";
export type { DetailPanelProps, PanelMetaFact } from "./panels/detail-panel.js";
export { ConfirmActionDialog, StaffDialog } from "./panels/staff-dialog.js";
export type {
  ConfirmActionDialogProps,
  ConfirmReason,
  StaffDialogProps,
} from "./panels/staff-dialog.js";
export { StaffToaster } from "./panels/toaster.js";
export {
  STAFF_TOAST_DURATION_MS,
  STAFF_UNDO_TOAST_DURATION_MS,
  toastUndo,
  useOptimisticState,
} from "./panels/feedback.js";
export type { OptimisticOptions, OptimisticResult } from "./panels/feedback.js";
export {
  STAFF_STEP_UP_REASON,
  StepUpDialog,
  StepUpNotice,
  isStaffStepUpRequired,
  useStaffStepUp,
} from "./panels/step-up.js";
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
export { RecordPager, recordPosition } from "./shell/record-pager.js";
export type { RecordPosition } from "./shell/record-pager.js";
export {
  STAFF_SHORTCUTS_STORAGE_KEY,
  ShortcutsDialog,
  StaffShortcutsProvider,
  isTypingTarget,
  useStaffShortcut,
  useStaffShortcuts,
} from "./shell/shortcuts.js";
export type { StaffShortcut } from "./shell/shortcuts.js";
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
export { PlainLink } from "@auction/ui/lax";
export type {
  LinkComponent as StaffLinkComponent,
  LinkProps as StaffLinkProps,
} from "@auction/ui/lax";
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
