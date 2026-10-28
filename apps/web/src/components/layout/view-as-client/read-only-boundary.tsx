import type { ReactNode } from "react";

type Props = {
  /** The id of the element that says why actions are off. */
  reasonId: string;
  children: ReactNode;
};

/**
 * Turns every action inside it off at once: a disabled fieldset disables all its buttons, inputs,
 * selects and text areas, which then show their own disabled state, and points assistive
 * technology to the reason. Links still work, so the person can look around. Nothing inside has
 * to know about it.
 */
export function ReadOnlyBoundary({ reasonId, children }: Props) {
  return (
    <fieldset disabled aria-describedby={reasonId} data-read-only="true" className="contents">
      {children}
    </fieldset>
  );
}
