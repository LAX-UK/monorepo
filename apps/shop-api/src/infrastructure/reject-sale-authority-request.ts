import type { Database } from "@auction/db";
import { shopAdminAudit, shopSaleAuthorityRequest } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";

export async function rejectSaleAuthorityRequest(
  db: Database,
  input: {
    requestId: string;
    reason: string;
    operatorSubjectId: string;
  },
): Promise<{ requestId: string; status: "rejected" }> {
  const now = new Date();
  const updated = await db
    .update(shopSaleAuthorityRequest)
    .set({
      status: "rejected",
      handledBySubjectId: input.operatorSubjectId,
      handledAt: now,
      note: input.reason,
    })
    .where(
      and(
        eq(shopSaleAuthorityRequest.id, input.requestId),
        eq(shopSaleAuthorityRequest.status, "pending"),
      ),
    )
    .returning({ id: shopSaleAuthorityRequest.id });
  if (updated.length !== 1) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "Sale authority request is not pending",
      409,
    );
  }
  await db.insert(shopAdminAudit).values({
    actorSubjectId: input.operatorSubjectId,
    capability: "sale_authority.write",
    action: "reject_sale_authority_request",
    targetType: "shop_sale_authority_request",
    targetId: input.requestId,
    afterJson: JSON.stringify({ status: "rejected", reason: input.reason }),
  });
  return { requestId: input.requestId, status: "rejected" as const };
}
