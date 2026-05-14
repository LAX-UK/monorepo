"use client";

import { Button } from "@auction/ui/components/button";
import { useCallback } from "react";

type Props = {
  selectedCount: number;
  selectedIds: readonly string[];
  onClear: () => void;
};

export function AdminArtistsBulkBar({ selectedCount, selectedIds, onClear }: Props) {
  const copyIds = useCallback(() => {
    if (selectedIds.length === 0) return;
    void navigator.clipboard.writeText(selectedIds.join("\n"));
  }, [selectedIds]);

  if (selectedCount <= 0) return null;

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-surface-container-low px-4 py-3 shadow-lg">
      <p className="font-body text-sm text-on-surface">
        <span className="font-semibold">{selectedCount}</span> selected
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyIds}>
          Copy IDs
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
