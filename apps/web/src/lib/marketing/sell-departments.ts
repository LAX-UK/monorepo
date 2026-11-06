import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { departmentBySlug } from "@auction/domain";

/** Anchor id on `/sell` for department grid and navigation deep links. */
export const SELL_DEPARTMENTS_ANCHOR = "departments";

export type SellDepartmentIntake = "wizard" | "landing";

export type SellDepartment = {
  id: string;
  label: string;
  /** DB category slug — used for wizard pre-select when intake is `wizard`. */
  slug?: string;
  examples?: readonly string[];
  photoHints?: readonly string[];
  intake: SellDepartmentIntake;
  /** SEO landing page — not used as the primary CTA href; wizard intake is always preferred. */
  landing?: string;
  /** Hide from the public department grid until wizard categories exist in DB. */
  hidden?: boolean;
  note?: string;
};

export type SellDepartmentGroup = {
  id: string;
  label: string;
  departments: readonly SellDepartment[];
};

/**
 * The id, name and category slug of one of the twelve departments, read from the department
 * list in the domain so the sell page never keeps its own copy of them.
 */
function departmentIdentity(slug: string): Pick<SellDepartment, "id" | "label" | "slug"> {
  const department = departmentBySlug(slug);
  if (!department) throw new Error(`Unknown department: ${slug}`);
  return { id: department.slug, label: department.label, slug: department.slug };
}

export const SELL_DEPARTMENT_GROUPS: readonly SellDepartmentGroup[] = [
  {
    id: "fine-art",
    label: "Fine art",
    departments: [
      {
        ...departmentIdentity("paintings"),
        examples: ["Contemporary", "Impressionist", "Modern British"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("sculpture"),
        examples: ["Bronze", "Marble", "Installation"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("photography"),
        examples: ["Vintage prints", "Contemporary editions"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("digital-art"),
        examples: ["Digital editions", "Video and screen works"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("mixed-media"),
        examples: ["Collage", "Assemblage"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("drawings"),
        examples: ["Works on paper", "Watercolour", "Ink"],
        intake: "wizard",
      },
    ],
  },
  {
    id: "luxury-collectibles",
    label: "Luxury & collectibles",
    departments: [
      {
        ...departmentIdentity("watches-clocks"),
        examples: ["Wristwatches", "Pocket watches", "Desk clocks"],
        photoHints: ["Dial", "Caseback", "Movement", "Box and papers"],
        intake: "wizard",
        landing: "/sell/watches",
      },
      {
        ...departmentIdentity("motor-cars"),
        examples: ["Classic", "Modern collectibles", "Competition cars"],
        photoHints: ["Exterior angles", "Interior", "VIN plate", "Odometer"],
        intake: "wizard",
        landing: "/sell/motor-cars",
      },
      {
        ...departmentIdentity("coins-medals"),
        examples: ["Ancient", "British", "Commemorative"],
        photoHints: ["Obverse and reverse", "Edge detail", "Certification"],
        intake: "wizard",
      },
      {
        ...departmentIdentity("design-decorative-arts"),
        examples: ["Furniture", "Ceramics", "Lighting"],
        photoHints: ["Overall view", "Maker marks", "Dimensions reference"],
        intake: "wizard",
      },
    ],
  },
  {
    id: "prints-multiples",
    label: "Prints & multiples",
    departments: [
      {
        ...departmentIdentity("fine-prints"),
        examples: ["Limited editions", "Portfolios", "Multiples"],
        photoHints: ["Overall", "Signature", "Edition number"],
        intake: "wizard",
        landing: "/sell/prints",
      },
    ],
  },
  {
    id: "books-manuscripts",
    label: "Books & manuscripts",
    departments: [
      {
        ...departmentIdentity("books-manuscripts"),
        examples: ["First editions", "Manuscripts", "Illustrated books"],
        photoHints: ["Title page", "Binding", "Condition details"],
        intake: "wizard",
      },
    ],
  },
  {
    id: "jewellery-luxury",
    label: "Jewellery, handbags & luxury",
    departments: [
      {
        id: "jewellery",
        label: "Jewellery",
        examples: ["Signed pieces", "Gem-set", "Vintage"],
        intake: "wizard",
        hidden: true,
        note: "Specialist review before you send it",
      },
      {
        id: "handbags-accessories",
        label: "Handbags & accessories",
        examples: ["Designer handbags", "Luxury accessories"],
        intake: "wizard",
        hidden: true,
        note: "Enquire first — categories added on request",
      },
    ],
  },
  {
    id: "collections",
    label: "Collections & institutions",
    departments: [
      {
        id: "estate",
        label: "Estate & collections",
        examples: ["Family collections", "Multi-item estates"],
        intake: "wizard",
        landing: "/sell/estate",
      },
      {
        id: "corporate",
        label: "Corporate disposals",
        examples: ["Office art", "Deaccession programmes"],
        intake: "wizard",
        landing: "/sell/corporate",
      },
    ],
  },
] as const;

/** Per-vertical photo and preparation hints — keyed by department id. */
export const SELL_DEPARTMENT_PHOTO_HINTS: Record<string, readonly string[]> = {
  "watches-clocks": [
    "Reference number, case material, and bracelet or strap",
    "Dial, caseback, movement, and serial markings",
    "Box, papers, and service history in your notes",
  ],
  "motor-cars": [
    "Exterior from several angles, interior, and odometer",
    "VIN plate, engine bay, and any known ownership history",
    "Mechanical condition and recent service records in notes",
  ],
  "fine-prints": [
    "Edition size and number (e.g. 12/75), publisher, and signature",
    "Overall, signature detail, and condition photographs",
  ],
  prints: [
    "Edition size and number (e.g. 12/75), publisher, and signature",
    "Overall, signature detail, and condition photographs",
  ],
  "coins-medals": [
    "Obverse, reverse, and edge detail",
    "Grade, mint, and certification references where available",
  ],
  "design-decorative-arts": [
    "Maker or designer in title and description",
    "Dimensions, material, and condition photographs",
  ],
  "books-manuscripts": [
    "Title page, binding, and notable inscriptions",
    "Condition details and provenance when available",
  ],
};

export function allSellDepartments(): SellDepartment[] {
  return SELL_DEPARTMENT_GROUPS.flatMap((group) => [...group.departments]);
}

/** Departments shown in the public marketing grid (excludes hidden). */
export function visibleSellDepartmentGroups(): SellDepartmentGroup[] {
  return SELL_DEPARTMENT_GROUPS.map((group) => ({
    ...group,
    departments: group.departments.filter((dept) => !dept.hidden),
  })).filter((group) => group.departments.length > 0);
}

export function sellDepartmentsAnchorHref(): string {
  return `/sell#${SELL_DEPARTMENTS_ANCHOR}`;
}

/** Resolve marketing CTA href for a department card — always routes to the submission wizard. */
export function departmentIntakeHref(dept: SellDepartment): string {
  return sellIntakeHref(dept.slug ? { categorySlug: dept.slug } : undefined);
}
