/**
 * Restyles the shared cmdk wrapper (@auction/ui/components/command) to the staff scale from the
 * root, because its input row is not exposed for styling. Used by the entity picker and ⌘K.
 */
export const staffCommandClass = [
  "rounded-none bg-transparent font-staff text-staff-fg",
  "[&_[data-slot=command-input-wrapper]]:h-control-lg [&_[data-slot=command-input-wrapper]]:gap-2",
  "[&_[data-slot=command-input-wrapper]]:border-staff-line [&_[data-slot=command-input-wrapper]]:px-3",
  "[&_[data-slot=command-input-wrapper]_svg]:size-4 [&_[data-slot=command-input-wrapper]_svg]:text-staff-subtle [&_[data-slot=command-input-wrapper]_svg]:opacity-100",
  "[&_[data-slot=command-input]]:h-full [&_[data-slot=command-input]]:py-0 [&_[data-slot=command-input]]:text-staff-md [&_[data-slot=command-input]]:placeholder:text-staff-subtle",
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-staff-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-staff-muted",
].join(" ");

export const staffCommandItemClass = [
  "min-h-control-sm gap-2.5 rounded-staff-sm px-2 py-1.5 font-staff text-staff-sm text-staff-fg",
  "data-[selected=true]:bg-staff-hover data-[selected=true]:text-staff-fg",
  "data-[disabled=true]:text-staff-disabled data-[disabled=true]:opacity-100",
  "[&_svg]:size-4 [&_svg:not([class*='text-'])]:text-staff-muted",
].join(" ");
