"use client";

import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { buildLotPublishReadiness } from "@/lib/admin/catalog-readiness";
import { lotDetailReadinessDismissKey } from "@/lib/admin/compute-lot-detail-readiness";
import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { countLotsCatalogReady, saleSetupHref } from "@/lib/admin/sale-setup";
import { notify } from "@/lib/ui/notify";
import { Field, FormActions, FormSection, Notice, StaffButton, TextArea } from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
  const { save, pending: imagesPending, lastResult: imagesSaveResult } = useLotImagesSave(lot.id);
  const [entries, setEntries] = useState<LotImageSaveEntry[]>(
    lot.images.map((key, i) => ({ key, alt: imageAlts[i] ?? "" })),
  );
  const [description, setDescription] = useState(lot.description ?? "");
  const [descDirty, setDescDirty] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const [imagesDirty, setImagesDirty] = useState(false);

  useEffect(() => {
    if (imagesSaveResult === "ok" || imagesSaveResult === "partial") {
      setImagesDirty(false);
    }
  }, [imagesSaveResult]);

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
        setDescError(r.error);
        return;
      }
      notify.success("Description saved");
      setDescDirty(false);
      router.refresh();
    });
  }

  return (
    <FormSection
      title={lot.title.trim() || "Untitled lot"}
      description="Photos and a catalogue description are needed before the lot can go live."
    >
      <CatalogPublishReadiness
        title="Lot readiness"
        readiness={readiness}
        compact
        dismissKey={lotDetailReadinessDismissKey(lot.id)}
      />
      <Field label="Photos" description="Saved with Save photos.">
        <LotCatalogueImagesField
          value={entries}
          onChange={(next) => {
            setEntries(next);
            setImagesDirty(true);
          }}
          disabled={readOnly || imagesPending}
        />
      </Field>
      {!readOnly && imagesDirty ? (
        <FormActions>
          <StaffButton type="button" size="sm" loading={imagesPending} onClick={saveImages}>
            Save photos
          </StaffButton>
        </FormActions>
      ) : null}
      <Field label="Catalogue description" error={descError}>
        <TextArea
          value={description}
          rows={4}
          disabled={readOnly}
          onChange={(event) => {
            setDescription(event.target.value);
            setDescDirty(true);
            setDescError(null);
          }}
        />
      </Field>
      {!readOnly && descDirty ? (
        <FormActions>
          <StaffButton type="button" size="sm" loading={descPending} onClick={saveDescription}>
            Save description
          </StaffButton>
        </FormActions>
      ) : null}
    </FormSection>
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
      <Notice
        tone="info"
        title="No lots yet"
        actions={
          <StaffButton asChild size="sm" variant="secondary">
            <Link href={saleSetupHref(saleId, "lots")}>Go to lots</Link>
          </StaffButton>
        }
      >
        Add the sale's lots in the previous step first.
      </Notice>
    );
  }

  return (
    <>
      <Notice
        tone={ready === total ? "info" : "warning"}
        title={`${ready} of ${total} lots are ready to go live`}
      >
        Each lot below needs photos and a catalogue description.
      </Notice>
      {lots.map((lot) => (
        <LotCatalogPrepCard
          key={lot.id}
          lot={lot}
          sale={sale}
          readOnly={readOnly}
          connectRequired={lotConnectRequired(connectRequiredByLotId, lot.id)}
        />
      ))}
    </>
  );
}
