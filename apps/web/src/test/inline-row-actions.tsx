import type { DataColumn, OverflowAction } from "@auction/staff-ui";
import { Button } from "@auction/ui/components/button";

/**
 * Makes each row's `…` menu render its actions in place, for tests. The Radix menu is slow to
 * open and close in jsdom on a table with several rows; this keeps every action in the document
 * and runs `onSelect` on click. Use it as
 *
 *     vi.mock("@auction/staff-ui", async (importOriginal) =>
 *       (await import("@/test/inline-row-actions")).withInlineRowActions(
 *         await importOriginal<typeof import("@auction/staff-ui")>(),
 *       ),
 *     );
 */
export function withInlineRowActions<K extends object>(kit: K): K {
  const rowActionsColumn = <T,>({
    actions,
    label,
  }: {
    actions: (row: T) => readonly OverflowAction[];
    label: (row: T) => string;
  }): DataColumn<T> => ({
    id: "actions",
    header: "Actions",
    headerHidden: true,
    truncate: false,
    mobile: "actions",
    cell: (row) => (
      <ul aria-label={label(row)}>
        {actions(row).map((action) => (
          <li key={action.id}>
            {action.href ? (
              <a href={action.href}>{action.label}</a>
            ) : (
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                disabled={Boolean(action.disabled || action.disabledReason)}
                onClick={() => action.onSelect?.()}
              >
                {action.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    ),
  });
  return { ...kit, rowActionsColumn };
}
