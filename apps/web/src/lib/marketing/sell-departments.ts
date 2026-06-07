import { sellContactHref, sellIntakeHref } from "@/lib/marketing/sell-intake";

/** Anchor id on `/sell` for department grid and navigation deep links. */
export const SELL_DEPARTMENTS_ANCHOR = "departments";

export type SellDepartmentIntake = "wizard" | "contact" | "landing";

export type SellDepartment = {
  id: string;
  label: string;
  /** DB category slug — used for wizard pre-select when intake is `wizard`. */
  slug?: string;
  examples?: readonly string[];
  photoHints?: readonly string[];
  intake: SellDepartmentIntake;
  landing?: string;
  contactType?: "estate" | "corporate" | "prints" | "jewellery";
  note?: string;
};

export type SellDepartmentGroup = {
  id: string;
  label: string;
  departments: readonly SellDepartment[];
};

export const SELL_DEPARTMENT_GROUPS: readonly SellDepartmentGroup[] = [
  {
    id: "fine-art",
    label: "Fine art",
    departments: [
      {
        id: "paintings",
        label: "Paintings",
        slug: "paintings",
        examples: ["Contemporary", "Impressionist", "Modern British"],
        intake: "wizard",
      },
      {
        id: "sculpture",
        label: "Sculpture",
        slug: "sculpture",
        examples: ["Bronze", "Marble", "Installation"],
        intake: "wizard",
      },
      {
        id: "photography",
        label: "Photography",
        slug: "photography",
        examples: ["Vintage prints", "Contemporary editions"],
        intake: "wizard",
      },
      {
        id: "digital-art",
        label: "Digital art",
        slug: "digital-art",
        examples: ["NFT-backed works", "Digital editions"],
        intake: "wizard",
      },
      {
        id: "mixed-media",
        label: "Mixed media",
        slug: "mixed-media",
        examples: ["Collage", "Assemblage"],
        intake: "wizard",
      },
      {
        id: "drawings",
        label: "Drawings",
        slug: "drawings",
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
        id: "watches-clocks",
        label: "Watches & clocks",
        slug: "watches-clocks",
        examples: ["Wristwatches", "Pocket watches", "Desk clocks"],
        photoHints: ["Dial", "Caseback", "Movement", "Box and papers"],
        intake: "wizard",
        landing: "/sell/watches",
      },
      {
        id: "motor-cars",
        label: "Motor cars",
        slug: "motor-cars",
        examples: ["Classic", "Modern collectibles", "Competition cars"],
        photoHints: ["Exterior angles", "Interior", "VIN plate", "Odometer"],
        intake: "wizard",
        landing: "/sell/motor-cars",
      },
      {
        id: "coins-medals",
        label: "Coins & medals",
        slug: "coins-medals",
        examples: ["Ancient", "British", "Commemorative"],
        photoHints: ["Obverse and reverse", "Edge detail", "Certification"],
        intake: "wizard",
      },
      {
        id: "design-decorative-arts",
        label: "Design & decorative arts",
        slug: "design-decorative-arts",
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
        id: "fine-prints",
        label: "Fine prints",
        slug: "fine-prints",
        examples: ["Limited editions", "Portfolios", "Multiples"],
        photoHints: ["Overall", "Signature", "Edition number"],
        intake: "landing",
        landing: "/sell/prints",
        contactType: "prints",
      },
    ],
  },
  {
    id: "books-manuscripts",
    label: "Books & manuscripts",
    departments: [
      {
        id: "books-manuscripts",
        label: "Books & manuscripts",
        slug: "books-manuscripts",
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
        intake: "contact",
        contactType: "jewellery",
        note: "Specialist review before submission",
      },
      {
        id: "handbags-accessories",
        label: "Handbags & accessories",
        examples: ["Designer handbags", "Luxury accessories"],
        intake: "contact",
        contactType: "jewellery",
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
        intake: "landing",
        landing: "/sell/estate",
        contactType: "estate",
      },
      {
        id: "corporate",
        label: "Corporate disposals",
        examples: ["Office art", "Deaccession programmes"],
        intake: "landing",
        landing: "/sell/corporate",
        contactType: "corporate",
      },
    ],
  },
] as const;

/** Per-vertical photo and preparation hints — keyed by department id. */
export const SELL_DEPARTMENT_PHOTO_HINTS: Record<string, readonly string[]> = {
  "watches-clocks": [
    "Reference number, case material, and bracelet or strap",
    "Dial, caseback, movement, and serial markings",
    "Box, papers, and service history in submitter notes",
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

export function sellDepartmentsAnchorHref(): string {
  return `/sell#${SELL_DEPARTMENTS_ANCHOR}`;
}

/** Resolve marketing CTA href for a department card. */
export function departmentIntakeHref(dept: SellDepartment): string {
  if (dept.intake === "landing" && dept.landing) return dept.landing;
  if (dept.intake === "contact") {
    return sellContactHref(dept.contactType ?? "jewellery");
  }
  return sellIntakeHref(dept.slug ? { categorySlug: dept.slug } : undefined);
}
