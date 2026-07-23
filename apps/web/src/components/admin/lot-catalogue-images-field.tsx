"use client";

import { CatalogMediaCollectionActions } from "@/components/admin/catalog/media";
import { type LotImageEntry, LotImageManager } from "@/components/admin/lot-image-manager";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import { useState } from "react";

type Props = {
  value: LotImageEntry[];
  onChange: (next: LotImageEntry[]) => void;
  maxFiles?: number;
  disabled?: boolean;
};

/** Form adapter that guarantees the full lot-image capability contract. */
export function LotCatalogueImagesField({
  value,
  onChange,
  maxFiles = 50,
  disabled = false,
}: Props) {
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const {
    showAdd,
    showManage,
    addButtonRef,
    manageButtonRef,
    closeAddPanel,
    toggleAdd,
    toggleManage,
  } = useMediaCollectionUi({
    collectionLength: value.length,
    inspectTarget: inspectIndex,
    setInspectTarget: setInspectIndex,
  });

  return (
    <div className="space-y-4">
      {!disabled && value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <CatalogMediaCollectionActions
            addButtonRef={addButtonRef}
            manageButtonRef={manageButtonRef}
            showAdd={showAdd}
            showManage={showManage}
            onToggleAdd={toggleAdd}
            onToggleManage={toggleManage}
            addLabel="Add images"
          />
        </div>
      ) : null}
      <LotImageManager
        value={value}
        onChange={onChange}
        maxFiles={maxFiles}
        disabled={disabled}
        showAddPanel={showAdd}
        onCloseAddPanel={closeAddPanel}
        showManage={showManage}
        inspectIndex={inspectIndex}
        onInspectIndex={setInspectIndex}
      />
    </div>
  );
}
