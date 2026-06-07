import type { TocNavItem } from "@auction/ui";

/** Anchor ids must match `LegalH2 id=` on [`sell/page.tsx`]. */
export const SELL_PAGE_TOC: readonly TocNavItem[] = [
  { id: "departments", label: "What we accept" },
  { id: "how-it-works", label: "How consignment works" },
  { id: "prepare", label: "Prepare your submission" },
  { id: "photos", label: "Photographing your item" },
  { id: "fees", label: "Fees & specialist support" },
  { id: "valuation", label: "Get a valuation" },
] as const;
