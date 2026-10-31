"use client";

import { ButtonLink, type ButtonLinkProps } from "@auction/ui/lax";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";

export type StaffButtonLinkProps = ButtonLinkProps & {
  /** What the destination needs. People who may never use it do not see the link at all. */
  requires?: StaffPermission;
};

/** A link that looks like a staff button, safe to render from a server component. */
export function StaffButtonLink({ requires, ...props }: StaffButtonLinkProps) {
  const permitted = useStaffCan(requires);
  if (!permitted) return null;
  return <ButtonLink {...props} />;
}
