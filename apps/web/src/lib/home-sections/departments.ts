import { findDepartmentCategory } from "@/lib/departments/department-evidence";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeDepartment } from "@/lib/home-sections/types";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import { DEPARTMENTS } from "@auction/domain";
import type { Category, Lot } from "@auction/types";

function inCategory(lot: Lot, categoryId: string): boolean {
  const ids = lot.categoryIds?.length ? lot.categoryIds : [lot.categoryId];
  return ids.includes(categoryId);
}

function endedAt(lot: Lot): number {
  const time = new Date(lot.endTime).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function latestFirst(lots: readonly Lot[]): Lot[] {
  return [...lots].sort((a, b) => endedAt(b) - endedAt(a));
}

/**
 * A department's picture: the one staff chose, else the latest sold lot's, else the latest lot's
 * (lots seen on this page that have a photograph). `null` when there is none.
 */
function imageFor(
  category: Category,
  lots: readonly Lot[],
): Pick<HomeDepartment, "imageUrl" | "imageSource"> | null {
  if (category.heroImageKey) return { imageUrl: category.heroImageKey, imageSource: "staff" };
  const photographed = latestFirst(lots.filter((lot) => lot.images[0]));
  const sold = photographed.find((lot) => lot.status === "ended" && lotWasSold(lot));
  const imageUrl = (sold ?? photographed[0])?.images[0];
  return imageUrl ? { imageUrl, imageSource: "lot" } : null;
}

function hasOpenLots(lots: readonly Lot[]): boolean {
  return lots.some((lot) => lot.status === "active" || lot.status === "scheduled");
}

/**
 * The departments, from the one list of twelve, that have a picture to show; those with live or
 * upcoming lots first, then the list's own order. A department with no picture at all is left
 * out here (it still has its place on the sell page), so the page never shows an empty tile.
 * `null` when fewer than the minimum can be shown.
 */
export function buildDepartments(
  categories: readonly Category[],
  lots: readonly Lot[],
): HomeDepartment[] | null {
  const shown = DEPARTMENTS.flatMap((department) => {
    const category = findDepartmentCategory(categories, department.slug);
    if (!category) return [];
    const own = lots.filter((lot) => inCategory(lot, category.id));
    const image = imageFor(category, own);
    if (!image) return [];
    return [
      {
        open: hasOpenLots(own),
        department: {
          id: category.id,
          name: department.label,
          href: `/search?categoryId=${encodeURIComponent(category.id)}`,
          ...image,
        } satisfies HomeDepartment,
      },
    ];
  });
  // Array.prototype.sort is stable, so departments keep the list's order within each group.
  const ordered = [...shown]
    .sort((a, b) => Number(b.open) - Number(a.open))
    .map(({ department }) => department)
    .slice(0, HOME_SECTION_LIMITS.departments.max);
  return ordered.length >= HOME_SECTION_LIMITS.departments.min ? ordered : null;
}
