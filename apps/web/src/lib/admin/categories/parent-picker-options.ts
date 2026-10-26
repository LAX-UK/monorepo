import type { EntityOption } from "@auction/staff-ui";
import type { Category } from "@auction/types";

/** The option that means "no parent": a top-level category. */
export const NO_PARENT_ID = "none";

/**
 * The categories a category may sit under, as kit picker options in tree order (each branch
 * follows its parent), the way the category list reads. A nested one says where it sits
 * ("Under Prints › Etchings"), so two with the same name can be told apart. Archived categories,
 * the category itself and everything under it are left out, since a branch cannot sit under its
 * own descendant.
 */
export function parentPickerOptions(
  categories: readonly Category[],
  selfId?: string,
): EntityOption[] {
  const known = new Set(categories.map((category) => category.id));
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId && known.has(category.parentId) ? category.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  const options: EntityOption[] = [
    { id: NO_PARENT_ID, label: "No parent", description: "A top-level category" },
  ];
  const seen = new Set<string>();
  const walk = (parentId: string | null, trail: readonly string[]) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id) || category.id === selfId) continue;
      seen.add(category.id);
      if (!category.archived) {
        options.push({
          id: category.id,
          label: category.name,
          ...(trail.length > 0 ? { description: `Under ${trail.join(" › ")}` } : {}),
        });
      }
      walk(category.id, [...trail, category.name]);
    }
  };
  walk(null, []);
  return options;
}
