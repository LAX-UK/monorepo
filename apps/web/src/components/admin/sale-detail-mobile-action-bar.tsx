"use client";

import {
  type CatalogMobileAction,
  CatalogMobileActionBar,
} from "@/components/admin/catalog/catalog-mobile-action-bar";
import {
  SALE_PUBLISH_PHRASE,
  useSaleLifecycleActions,
} from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  type SaleLifecycleActionKind,
  buildSaleLifecycleActionItems,
  buildSaleNavigationActionItems,
} from "@/lib/admin/build-sale-lifecycle-mobile-actions";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useCallback, useMemo, useState } from "react";

type Props = {
  saleId: string;
  publicHref: string;
  canEdit: boolean;
  liveish: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canCancel: boolean;
  canMarkOnsiteEnded: boolean;
};

function lifecycleConfirmCopy(kind: SaleLifecycleActionKind) {
  switch (kind) {
    case "unpublish":
      return {
        title: "Revert sale to draft?",
        description: "All scheduled lots will also revert to draft.",
        actionLabel: "Revert to draft",
      };
    case "markEnded":
      return {
        title: "End onsite sale?",
        description: "This will end the sale and all remaining lots.",
        actionLabel: "Mark ended",
      };
    case "cancel":
      return {
        title: "Cancel entire sale?",
        description: "This cancels the sale and remaining lots.",
        actionLabel: "Cancel sale",
      };
    default:
      return null;
  }
}

/** Unified mobile bar — one primary lifecycle or navigation action, rest in overflow. */
export function SaleDetailMobileActionBar({
  saleId,
  publicHref,
  canEdit,
  liveish,
  canPublish,
  canUnpublish,
  canCancel,
  canMarkOnsiteEnded,
}: Props) {
  const { pending, publish, unpublish, markOnsiteEnded, cancel } = useSaleLifecycleActions(saleId);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<SaleLifecycleActionKind | null>(null);

  const runLifecycle = useCallback(
    (kind: SaleLifecycleActionKind) => {
      if (kind === "publish") publish();
      if (kind === "unpublish") unpublish();
      if (kind === "markEnded") markOnsiteEnded();
      if (kind === "cancel") cancel();
    },
    [cancel, markOnsiteEnded, publish, unpublish],
  );

  const openLifecycle = useCallback((kind: SaleLifecycleActionKind) => {
    if (kind === "publish") {
      setPublishOpen(true);
      return;
    }
    setConfirmKind(kind);
  }, []);

  const lifecycleItems = buildSaleLifecycleActionItems({
    canPublish,
    canUnpublish,
    canMarkOnsiteEnded,
    canCancel,
  });
  const navItems = buildSaleNavigationActionItems({
    saleId,
    publicHref,
    canEdit,
    liveish,
  });

  const primaryLifecycle = lifecycleItems[0] ?? null;
  const secondaryLifecycle = lifecycleItems.slice(1);

  const mobileActions = useMemo((): CatalogMobileAction[] => {
    const actions: CatalogMobileAction[] = [];

    if (primaryLifecycle) {
      actions.push({
        id: primaryLifecycle.id,
        label: primaryLifecycle.label,
        variant: "primary",
        disabled: pending,
        onClick: () => openLifecycle(primaryLifecycle.kind),
      });
    }

    for (const nav of navItems) {
      actions.push({
        id: nav.id,
        label: nav.label,
        href: nav.href,
        ...(primaryLifecycle
          ? { variant: "secondary" as const }
          : nav.variant
            ? { variant: nav.variant }
            : {}),
      });
    }

    for (const item of secondaryLifecycle) {
      actions.push({
        id: item.id,
        label: item.label,
        variant: "secondary",
        disabled: pending,
        onClick: () => openLifecycle(item.kind),
      });
    }

    return actions;
  }, [navItems, openLifecycle, pending, primaryLifecycle, secondaryLifecycle]);

  const confirmCopy = confirmKind ? lifecycleConfirmCopy(confirmKind) : null;

  return (
    <>
      <CatalogMobileActionBar actions={mobileActions} />
      {canPublish ? (
        <TypedConfirmationDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          title="Publish this sale?"
          description={`Type ${SALE_PUBLISH_PHRASE} to schedule lots and make the sale visible to bidders.`}
          actionLabel="Publish sale"
          confirmationPhrase={SALE_PUBLISH_PHRASE}
          severity="warning"
          onConfirm={async () => {
            publish();
          }}
        />
      ) : null}
      {confirmCopy && confirmKind ? (
        <ConfirmDialog
          open={confirmKind != null}
          onOpenChange={(open) => {
            if (!open) setConfirmKind(null);
          }}
          title={confirmCopy.title}
          body={confirmCopy.description}
          confirmLabel={confirmCopy.actionLabel}
          onConfirm={() => {
            runLifecycle(confirmKind);
            setConfirmKind(null);
          }}
        />
      ) : null}
    </>
  );
}
