"use client";

import * as React from "react";

/**
 * What an action needs: one permission, or any one of several. The same shape as each app's
 * capability requirement, so a button and the route behind it name the same rule.
 */
export type StaffPermission = string | { readonly anyOf: readonly string[] };

/** The signed-in person's permissions, as the server checks them. */
export type StaffAccess = {
  /** Whether the person may take an action that needs `permission`. */
  can(permission: StaffPermission): boolean;
  /** The person's roles, for the "View only · Read-only" marker. */
  roleLabel?: string | undefined;
};

/** Outside a provider (tests, previews, a tool without roles) every action is offered. */
const EVERYONE: StaffAccess = { can: () => true };

const StaffAccessContext = React.createContext<StaffAccess>(EVERYONE);

/**
 * Gives every kit action below it the person's permissions. Actions that declare `requires` and
 * that the person may never take are left out, so pages never check roles themselves.
 */
export function StaffAccessProvider({
  access,
  children,
}: {
  access: StaffAccess;
  children: React.ReactNode;
}) {
  return <StaffAccessContext.Provider value={access}>{children}</StaffAccessContext.Provider>;
}

export function useStaffAccess(): StaffAccess {
  return React.useContext(StaffAccessContext);
}

/** Whether the person may take an action that needs `requires`; no requirement means yes. */
export function useStaffCan(requires: StaffPermission | undefined): boolean {
  const access = useStaffAccess();
  return requires === undefined || access.can(requires);
}

/** Keeps only the items the person may act on; an item without `requires` is always kept. */
export function usePermittedItems<T extends { requires?: StaffPermission | undefined }>(
  items: readonly T[],
): T[] {
  const access = useStaffAccess();
  return items.filter((item) => item.requires === undefined || access.can(item.requires));
}

/**
 * Renders its children only for people who may take an action that needs `requires`: for
 * controls the kit does not draw itself (an export, an inline editor).
 */
export function Permitted({
  requires,
  children,
  fallback = null,
}: {
  requires: StaffPermission;
  children: React.ReactNode;
  /** Shown instead, e.g. the read-only value an editor would change. */
  fallback?: React.ReactNode;
}) {
  return <>{useStaffCan(requires) ? children : fallback}</>;
}

/**
 * How a page shows to the person: "full" when they may change what it shows (`editRequires`),
 * otherwise "read-only", with their roles for the "View only" marker. An explicit access the
 * page already worked out wins.
 */
export function useStaffPageAccess<A extends string>(
  explicit: A | undefined,
  editRequires: StaffPermission | undefined,
): { access: A | "full" | "read-only"; roleLabel: string | undefined } {
  const access = useStaffAccess();
  if (explicit !== undefined) return { access: explicit, roleLabel: access.roleLabel };
  const canEdit = editRequires === undefined || access.can(editRequires);
  return { access: canEdit ? "full" : "read-only", roleLabel: access.roleLabel };
}
