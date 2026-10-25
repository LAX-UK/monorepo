import type { EntityOption } from "@auction/staff-ui";
import type { CategoryNode } from "@auction/types";

/**
 * The category tree as picker options, parents before their children. A child's description
 * names where it sits ("Under Prints"), so two categories with the same name can be told apart.
 */
export function categoryPickerOptions(
  nodes: readonly CategoryNode[],
  parents: readonly string[] = [],
): EntityOption[] {
  const out: EntityOption[] = [];
  for (const node of nodes) {
    out.push({
      id: node.id,
      label: node.name,
      ...(parents.length > 0 ? { description: `Under ${parents.join(" › ")}` } : {}),
    });
    if (node.children.length > 0) {
      out.push(...categoryPickerOptions(node.children, [...parents, node.name]));
    }
  }
  return out;
}
