import "server-only";
import { getLotSellerProceeds } from "@/lib/data/http/admin-seller-proceeds.server";
import type { LotSellerProceedsDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { SELLER_AGREEMENT_RECORD_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type StaffRoles, type UserRole, userHasAccessTo } from "@auction/types";
import { lotName } from "./held-reasons";
import {
  type HeldPayoutNotice,
  type LotSellerProceedsState,
  buildHeldPayoutNotice,
  buildLotSellerProceeds,
} from "./lot-seller-proceeds.vm";
import type { RecordAgreementContext } from "./record-agreement.vm";

export type LotSellerProceedsPage = {
  state: LotSellerProceedsState;
  notice: HeldPayoutNotice | null;
  /** Set when this person may record the seller's signed agreement for a held sale. */
  record: RecordAgreementContext | null;
};

export function recordContextFor(facts: LotSellerProceedsDto): RecordAgreementContext | null {
  const terms = facts.sale?.terms;
  if (!terms) return null;
  return {
    lotId: facts.lotId,
    lot: lotName(facts),
    lotTitle: facts.lotTitle,
    sellerName: facts.sellerName,
    hammerPence: terms.hammerPence,
    vatSetting: facts.vatSetting,
  };
}

/** The lot's seller side for the Overview section and the header notice; one read per request. */
export async function loadLotSellerProceeds(
  lotId: string,
  user: { role: string; staffRoles?: StaffRoles | undefined } | null,
): Promise<LotSellerProceedsPage> {
  let facts: LotSellerProceedsDto | null;
  try {
    facts = await getLotSellerProceeds(lotId);
  } catch (error) {
    console.error("[loadLotSellerProceeds] Failed to load the seller's proceeds:", error);
    return { state: { kind: "error" }, notice: null, record: null };
  }
  const canRecord =
    user !== null &&
    userHasAccessTo(user.role as UserRole, user.staffRoles, SELLER_AGREEMENT_RECORD_ACCESS);
  return {
    state: buildLotSellerProceeds(facts),
    notice: buildHeldPayoutNotice(facts),
    record: canRecord && facts ? recordContextFor(facts) : null,
  };
}
