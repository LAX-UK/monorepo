"use client";

import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LotImageManager } from "@/components/admin/lot-image-manager";
import { LabelCaps } from "@/components/ui/typography";
import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { buildLotPublishReadiness } from "@/lib/admin/catalog-readiness";
import { lotDetailReadinessDismissKey } from "@/lib/admin/compute-lot-detail-readiness";
import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { countLotsCatalogReady, humanizeSetupError, saleSetupHref } from "@/lib/admin/sale-setup";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { Lot, Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  saleId: string;
  sale: Pick<Sale, "id" | "deliveryMode" | "startTime" | "endTime">;
  lots: Lot[];
  readOnly?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
};

function LotCatalogPrepCard({
  lot,
  sale,
  readOnly,
  connectRequired,
}: {
  lot: Lot;
  sale: Pick<Sale, "id" | "deliveryMode" | "startTime" | "endTime">;
  readOnly: boolean;
  connectRequired: boolean;
}) {
  const router = useRouter();
  const [descPending, startDescTransition] = useTransition();
  const imageAlts = lot.marketingDetails?.imageAlts ?? [];
  const { save, pending: imagesPending } = useLotImagesSave(lot.id);
  const [entries, setEntries] = useState<LotImageSaveEntry[]>(
    lot.images.map((key, i) => ({ key, alt: imageAlts[i] ?? "" })),
  );
  const [description, setDescription] = useState(lot.description ?? "");
  const [descDirty, setDescDirty] = useState(false);

  const readiness = buildLotPublishReadiness(
    lot.id,
    {
      ...lot,
      description: descDirty ? description : lot.description,
      images: entries.map((e) => e.key),
    },
    { connectRequired, sale },
  );

  function saveImages() {
    save(entries);
  }

  function saveDescription() {
    startDescTransition(async () => {
      const r = await adminUpdateLotResultAction(lot.id, {
        description: description.trim() || undefined,
      });
      if (!r.ok) {
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error, {
              status: r.status,
              errorCode: r.errorCode,
              meta: r.meta,
            }),
            errorCode: r.errorCode,
          }),
        );
        return;
      }
      notify.success("Description saved");
      setDescDirty(false);
      router.refresh();
    });
  }

  return (
    <CatalogFormSection
      title={lot.title.trim() || "Untitled lot"}
      description="Add photos and catalog text for this lot."
      collapsible
      defaultOpen
    >
      <CatalogPublishReadiness
        title="Lot readiness"
        readiness={readiness}
        compact
        dismissKey={lotDetailReadinessDismissKey(lot.id)}
      />

      <div className="space-y-3">
        <LabelCaps>Photos — needed before going live</LabelCaps>
        <div className="rounded-lg border border-border-hairline bg-surface-container-lowest/40 p-4">
          <LotImageManager
            value={entries}
            onChange={setEntries}
            disabled={readOnly || imagesPending}
          />
        </div>
        {!readOnly ? (
          <Button type="button" size="sm" disabled={imagesPending} onClick={saveImages}>
            {imagesPending ? "Saving…" : "Save photos"}
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        <LabelCaps>Catalog description — needed before going live</LabelCaps>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDescDirty(true);
          }}
          rows={4}
          disabled={readOnly}
          className="font-body text-sm"
        />
        {!readOnly && descDirty ? (
          <LoadingButton type="button" size="sm" loading={descPending} onClick={saveDescription}>
            Save description
          </LoadingButton>
        ) : null}
      </div>
    </CatalogFormSection>
  );
}

export function SaleSetupCatalogPrepStep({
  saleId,
  sale,
  lots,
  readOnly = false,
  connectRequiredByLotId,
}: Props) {
  const { ready, total } = countLotsCatalogReady(lots, connectRequiredByLotId, sale);

  if (lots.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Add lots in the previous step first.{" "}
          <a href={saleSetupHref(saleId, "lots")} className="text-primary hover:underline">
            Go to lots
          </a>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <p className="font-body text-sm text-on-surface-variant">
        <span className="font-medium tabular-nums text-on-surface">{ready}</span> of{" "}
        <span className="font-medium tabular-nums text-on-surface">{total}</span> lots ready to go
        live
      </p>
      {lots.map((lot) => (
        <LotCatalogPrepCard
          key={lot.id}
          lot={lot}
          sale={sale}
          readOnly={readOnly}
          connectRequired={lotConnectRequired(connectRequiredByLotId, lot.id)}
        />
      ))}
    </div>
  );
}
