import type { SellerTermsFiguresView } from "@/lib/data/http/workspace-selling.schema";
import { sellerProceeds } from "@auction/domain";

/** A snapshot as the seller-terms policy records it: made by sellerProceeds, never by hand. */
export function snapshotFixture(
  hammerPence: number,
  commissionBps: number,
  vat: "standard" | "not_registered" = "standard",
): SellerTermsFiguresView {
  const proceeds = sellerProceeds({
    hammerPence,
    party: { kind: "agreement", commissionBps },
    vat,
  });
  if (proceeds.basis !== "agreement") throw new Error("fixture must price");
  return {
    hammerPence,
    commissionBps,
    commissionPence: proceeds.commissionPence,
    vatTreatment: vat,
    vatBps: proceeds.vatBps,
    vatPence: proceeds.vatPence,
    netPence: proceeds.netPence,
  };
}
