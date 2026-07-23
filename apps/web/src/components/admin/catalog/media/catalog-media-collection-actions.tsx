"use client";

import { Button } from "@auction/ui/components/button";
import type { RefObject } from "react";

type Props = {
  addButtonRef?: RefObject<HTMLButtonElement | null>;
  manageButtonRef?: RefObject<HTMLButtonElement | null>;
  showAdd: boolean;
  showManage: boolean;
  onToggleAdd: () => void;
  onToggleManage: () => void;
  addLabel?: string;
  addOpenLabel?: string;
  manageLabel?: string;
  manageOpenLabel?: string;
  addDisabled?: boolean;
  manageDisabled?: boolean;
};

/** Shared Add / Manage header actions for catalog media workspaces. */
export function CatalogMediaCollectionActions({
  addButtonRef,
  manageButtonRef,
  showAdd,
  showManage,
  onToggleAdd,
  onToggleManage,
  addLabel = "Add",
  addOpenLabel = "Close add panel",
  manageLabel = "Manage",
  manageOpenLabel = "Done managing",
  addDisabled = false,
  manageDisabled = false,
}: Props) {
  return (
    <>
      <Button
        ref={addButtonRef}
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        aria-expanded={showAdd}
        disabled={addDisabled}
        onClick={onToggleAdd}
      >
        {showAdd ? addOpenLabel : addLabel}
      </Button>
      <Button
        ref={manageButtonRef}
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        aria-expanded={showManage}
        disabled={manageDisabled}
        onClick={onToggleManage}
      >
        {showManage ? manageOpenLabel : manageLabel}
      </Button>
    </>
  );
}
