import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeDepartment } from "@/lib/home-sections/types";
import type { Category, Lot } from "@auction/types";

/** A department's own picture, else the photograph of a work seen on this page in it. */
function imageFor(category: Category, lots: readonly Lot[]): string | null {
  if (category.heroImageKey) return category.heroImageKey;
  const work = lots.find((lot) => {
    const ids = lot.categoryIds?.length ? lot.categoryIds : [lot.categoryId];
    return ids.includes(category.id) && lot.images[0];
  });
  return work?.images[0] ?? null;
}

/**
 * The top-level departments that hold public lots, those with a picture first. `null` when fewer
 * than the minimum can be shown, so the row is never mostly empty.
 */
export function buildDepartments(
  categories: readonly Category[],
  lots: readonly Lot[],
): HomeDepartment[] | null {
  const top = categories
    .filter((category) => !category.archived && category.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => ({
      id: category.id,
      name: category.name,
      href: `/search?categoryId=${encodeURIComponent(category.id)}`,
      imageUrl: imageFor(category, lots),
    }));
  const withPicture = top.filter((department) => department.imageUrl);
  const shown = [...withPicture, ...top.filter((department) => !department.imageUrl)].slice(
    0,
    HOME_SECTION_LIMITS.departments.max,
  );
  return shown.length >= HOME_SECTION_LIMITS.departments.min ? shown : null;
}
