/**
 * The twelve LAX Bid departments, once: their order, names and how their lots are shown. The
 * sell page, the home page, the cards and the lot page all read this list. A department's
 * category in the database is matched by `slug`.
 */

export const DEPARTMENT_DISPLAY_STYLES = [
  "wall",
  "object",
  "product",
  "showcase",
  "document",
] as const;

/**
 * How a department's lots are shown.
 * - wall: flat art, true proportions with a soft shadow
 * - object: sculpture and design, on a plain studio ground
 * - product: watches and coins, filling the frame
 * - showcase: motor cars, a wide gallery
 * - document: books and manuscripts, page by page
 */
export type DepartmentDisplayStyle = (typeof DEPARTMENT_DISPLAY_STYLES)[number];

export const DEFAULT_DEPARTMENT_DISPLAY_STYLE: DepartmentDisplayStyle = "wall";

export type Department = {
  slug: string;
  label: string;
  displayStyle: DepartmentDisplayStyle;
  /** Two pictures are the two faces of one piece (obverse and reverse) and show side by side. */
  pairsTwoFaces?: true;
};

/** In the order visitors see them. */
export const DEPARTMENTS: readonly Department[] = [
  { slug: "paintings", label: "Paintings", displayStyle: "wall" },
  { slug: "sculpture", label: "Sculpture", displayStyle: "object" },
  { slug: "photography", label: "Photography", displayStyle: "wall" },
  { slug: "digital-art", label: "Digital art", displayStyle: "wall" },
  { slug: "mixed-media", label: "Mixed media", displayStyle: "wall" },
  { slug: "drawings", label: "Drawings", displayStyle: "wall" },
  { slug: "watches-clocks", label: "Watches & clocks", displayStyle: "product" },
  { slug: "motor-cars", label: "Motor cars", displayStyle: "showcase" },
  { slug: "coins-medals", label: "Coins & medals", displayStyle: "product", pairsTwoFaces: true },
  { slug: "design-decorative-arts", label: "Design & decorative arts", displayStyle: "object" },
  { slug: "fine-prints", label: "Fine prints", displayStyle: "wall" },
  { slug: "books-manuscripts", label: "Books & manuscripts", displayStyle: "document" },
];

const BY_SLUG: ReadonlyMap<string, Department> = new Map(
  DEPARTMENTS.map((department) => [department.slug, department]),
);

export function departmentBySlug(slug: string | null | undefined): Department | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

/** The department's display style; a category outside the twelve is shown as a wall work. */
export function departmentDisplayStyle(slug: string | null | undefined): DepartmentDisplayStyle {
  return departmentBySlug(slug)?.displayStyle ?? DEFAULT_DEPARTMENT_DISPLAY_STYLE;
}

/** How one lot is presented: its department's style, and whether two pictures are two faces. */
export type LotMediaTreatment = { style: DepartmentDisplayStyle; pairsTwoFaces: boolean };

export const DEFAULT_LOT_MEDIA_TREATMENT: LotMediaTreatment = {
  style: DEFAULT_DEPARTMENT_DISPLAY_STYLE,
  pairsTwoFaces: false,
};

export function departmentMediaTreatment(slug: string | null | undefined): LotMediaTreatment {
  const department = departmentBySlug(slug);
  return department
    ? { style: department.displayStyle, pairsTwoFaces: department.pairsTwoFaces === true }
    : DEFAULT_LOT_MEDIA_TREATMENT;
}

/** Category id to treatment, for the categories that are one of the twelve departments. */
export type LotMediaTreatmentIndex = Readonly<Record<string, LotMediaTreatment>>;

export function buildLotMediaTreatmentIndex(
  categories: readonly { id: string; slug: string }[],
): LotMediaTreatmentIndex {
  const index: Record<string, LotMediaTreatment> = {};
  for (const category of categories) {
    if (departmentBySlug(category.slug)) {
      index[category.id] = departmentMediaTreatment(category.slug);
    }
  }
  return index;
}

/**
 * The treatment of a lot: that of its first category that is a department, else a wall work.
 * `categoryIds` lists the lot's categories, main one first.
 */
export function lotMediaTreatment(
  lot: { categoryIds?: readonly string[] | undefined; categoryId?: string | undefined },
  index: LotMediaTreatmentIndex,
): LotMediaTreatment {
  const ids = lot.categoryIds?.length ? lot.categoryIds : lot.categoryId ? [lot.categoryId] : [];
  for (const id of ids) {
    const treatment = index[id];
    if (treatment) return treatment;
  }
  return DEFAULT_LOT_MEDIA_TREATMENT;
}
