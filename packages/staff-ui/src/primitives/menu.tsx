"use client";

import { MenuItem } from "@auction/ui/lax";
import type * as React from "react";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";

/*
 * The LAX system menu (`@auction/ui/lax`) at the staff density. The kit adds one thing: an item
 * that names what its action needs is left out for people whose role may never take it.
 */
export {
  Menu as StaffMenu,
  MenuCheckboxItem as StaffMenuCheckboxItem,
  MenuContent as StaffMenuContent,
  MenuLabel as StaffMenuLabel,
  MenuRadioGroup as StaffMenuRadioGroup,
  MenuRadioItem as StaffMenuRadioItem,
  MenuSeparator as StaffMenuSeparator,
  MenuTrigger as StaffMenuTrigger,
  Tooltip as StaffTooltip,
  TooltipProvider as StaffTooltipProvider,
} from "@auction/ui/lax";

export function StaffMenuItem({
  requires,
  ...props
}: React.ComponentPropsWithoutRef<typeof MenuItem> & {
  /** What the action needs; left out of the menu for people who may never take it. */
  requires?: StaffPermission;
}) {
  const permitted = useStaffCan(requires);
  if (!permitted) return null;
  return <MenuItem {...props} />;
}
