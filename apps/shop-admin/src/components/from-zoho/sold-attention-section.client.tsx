"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { markNotSold } from "@/server/application/admin-register-actions.server";
import { soldAttentionActionHref } from "@/server/domain/zoho-register.vm";
import type { AdminSoldAttentionItem } from "@auction/shop-contracts";
import { ConfirmActionDialog, Notice, Permitted, StaffButton } from "@auction/staff-ui";
import Link from "next/link";
import { useState } from "react";

const REVIEW = "artwork_register.review";

/** "It is not sold": needs a reason, which is kept in the artwork's history, and clears the pause. */
function NotSoldDialog({
  item,
  onClose,
}: {
  item: AdminSoldAttentionItem;
  onClose: () => void;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="It is not sold"
        description="New payments and acceptances start again. Zoho will not raise this again unless the artwork is withdrawn and marked again."
        confirmLabel="It is not sold"
        loading={action.pending}
        reason={{
          label: "Why is it not sold?",
          description: "Kept in the artwork's history with your name.",
          maxLength: 500,
          missingMessage: "Say why it is not sold.",
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () =>
              markNotSold({
                attentionId: item.id,
                reason,
                idempotencyKey: action.idempotencyKey,
              }),
            "Payments and acceptances are open again",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * Artworks Zoho says are Sold or Reserved that are still for sale. Nothing is withdrawn by
 * itself: each item names where the artwork is still for sale and offers the way out for that
 * place, Zoho's record, and "It is not sold" for people who may review.
 */
export function SoldAttentionSection({
  items,
  bidAdminUrl,
  zohoUrlTemplate,
}: {
  items: readonly AdminSoldAttentionItem[];
  bidAdminUrl: string | null;
  zohoUrlTemplate: string | null;
}) {
  const [deciding, setDeciding] = useState<AdminSoldAttentionItem | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Notice key={item.id} tone={item.tone} alert title={item.title}>
          <div className="flex flex-col gap-3">
            <p>{item.body}</p>
            <div className="flex flex-wrap gap-2">
              {item.actions.map((entry) => {
                if (entry.kind === "not_sold") {
                  return (
                    <Permitted key={entry.kind} requires={REVIEW}>
                      <StaffButton variant="secondary" onClick={() => setDeciding(item)}>
                        {entry.label}
                      </StaffButton>
                    </Permitted>
                  );
                }
                const target = soldAttentionActionHref(item, entry.kind, {
                  bidAdminUrl,
                  zohoUrlTemplate,
                });
                if (!target) return null;
                return (
                  <StaffButton key={entry.kind} asChild variant="secondary">
                    {target.external ? (
                      <a href={target.href} target="_blank" rel="noreferrer">
                        {entry.label}
                      </a>
                    ) : (
                      <Link href={target.href}>{entry.label}</Link>
                    )}
                  </StaffButton>
                );
              })}
            </div>
          </div>
        </Notice>
      ))}
      {deciding ? <NotSoldDialog item={deciding} onClose={() => setDeciding(null)} /> : null}
    </div>
  );
}
