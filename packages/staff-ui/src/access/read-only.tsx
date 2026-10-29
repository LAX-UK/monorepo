"use client";

import * as React from "react";

const ReadOnlyContext = React.createContext(false);

/**
 * Marks everything below it as a view of a record, not a form: fields show their values at
 * normal contrast with no editing affordance, selects and checkboxes show the chosen value, and
 * the controls that would change it are left to each page's own `requires`.
 */
export function StaffReadOnly({
  readOnly = true,
  children,
}: {
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  const inherited = React.useContext(ReadOnlyContext);
  return (
    <ReadOnlyContext.Provider value={readOnly || inherited}>{children}</ReadOnlyContext.Provider>
  );
}

/** Whether the surrounding form is being shown as a read-only view. */
export function useStaffReadOnly(): boolean {
  return React.useContext(ReadOnlyContext);
}

/**
 * How a read-only control draws its value: the field box without the control look, at the
 * foreground colour, so values read as content and not as disabled controls.
 */
export const staffReadOnlyBox =
  "data-[readonly]:cursor-default data-[readonly]:border-staff-line! data-[readonly]:bg-transparent! data-[readonly]:text-staff-fg!";
