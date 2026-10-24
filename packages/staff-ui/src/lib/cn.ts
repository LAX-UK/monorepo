/** The shared class merger, which knows the staff scales (packages/ui/src/lib/utils.ts). */
export { cn } from "@auction/ui/lib/utils";

/** Marks a portalled layer (menu, dialog, sheet) as staff UI so the kit's base styles reach it. */
export const STAFF_LAYER = { "data-staff-ui": "" } as const;
