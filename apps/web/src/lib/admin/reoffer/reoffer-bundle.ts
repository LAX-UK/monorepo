import type { ReofferPreview, StaffBuyerDefault, StaffReoffer } from "@auction/validators";

/**
 * A lot's re-offer story for staff: the default, every offer so far and who is next in line.
 * `failed` is a load that did not work, which the page says plainly and offers to retry; it is
 * never shown as "no offers".
 */
export type LotReofferBundle =
  | {
      status: "ready";
      buyerDefault: StaffBuyerDefault | null;
      offers: StaffReoffer[];
      preview: ReofferPreview;
    }
  | { status: "failed" };
