"use client";

import { Button, type ButtonProps, buttonVariants } from "@auction/ui/lax";
import * as React from "react";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";

/** The LAX system button (`@auction/ui/lax`), at the staff density. */
export const staffButtonVariants = buttonVariants;

export type StaffButtonProps = ButtonProps & {
  /**
   * What the action needs. People who may never take it do not see the button at all; the
   * same rule guards the route behind it.
   */
  requires?: StaffPermission;
};

/** The shared button, left out for people whose role may never take its action. */
export const StaffButton = React.forwardRef<HTMLButtonElement, StaffButtonProps>(
  ({ requires, ...props }, ref) => {
    const permitted = useStaffCan(requires);
    if (!permitted) return null;
    return <Button ref={ref} {...props} />;
  },
);
StaffButton.displayName = "StaffButton";
