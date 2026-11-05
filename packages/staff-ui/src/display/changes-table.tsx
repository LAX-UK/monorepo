import { cn } from "../lib/cn.js";

export type ChangesRow = {
  id: string;
  label: string;
  /** The value now, as text; null says the field is empty. */
  before: string | null;
  /** The value after the change; null says the field will be empty. */
  after: string | null;
  /** The row changes: it is highlighted and the old value is struck through. */
  changes: boolean;
};

const EMPTY = "Empty";

/**
 * What a change does, field by field: the value now beside the value after. Rows that change are
 * highlighted and show the old value struck through (the words "was" and "now" are in the
 * accessible text, so colour is never the only cue); rows that stay the same read quietly, so the
 * table is the whole record and the changes stand out.
 */
export function ChangesTable({
  rows,
  beforeHeading,
  afterHeading,
  label,
  className,
}: {
  rows: readonly ChangesRow[];
  /** The heading of the "now" column: "lax.art now". */
  beforeHeading: string;
  /** The heading of the "after" column: "From Zoho, after linking". */
  afterHeading: string;
  /** The table's accessible name. */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-staff-md border border-staff-line text-staff-sm",
        className,
      )}
    >
      <table aria-label={label} className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-staff-sunken text-left text-staff-xs font-medium text-staff-muted">
            <th scope="col" className="w-[4.5rem] px-3 py-2 sm:w-28">
              <span className="sr-only">Field</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {beforeHeading}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {afterHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-changes={row.changes ? "true" : "false"}
              className={cn(
                "border-t border-staff-line-subtle align-baseline",
                row.changes && "bg-staff-warning-bg",
              )}
            >
              <th
                scope="row"
                className={cn(
                  "px-3 py-2 text-left font-normal",
                  row.changes ? "text-staff-warning-fg" : "text-staff-muted",
                )}
              >
                {row.label}
              </th>
              <td
                className={cn(
                  "px-3 py-2 break-words",
                  row.changes ? "text-staff-warning-fg line-through" : "text-staff-fg",
                )}
              >
                {row.changes ? <span className="sr-only">was </span> : null}
                {row.before ?? EMPTY}
              </td>
              <td className="px-3 py-2 break-words text-staff-fg">
                {row.changes ? <span className="sr-only">now </span> : null}
                {row.after ?? EMPTY}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
