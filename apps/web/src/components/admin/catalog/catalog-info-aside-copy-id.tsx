"use client";

import { notify } from "@/lib/ui/notify";

type Props = {
  entityId: string;
};

export function CatalogInfoAsideCopyId({ entityId }: Props) {
  return (
    <button
      type="button"
      aria-label={`Copy ID ${entityId}`}
      className="mt-1 block w-full truncate text-left font-mono text-xs text-on-surface hover:text-primary"
      onClick={() => {
        void navigator.clipboard.writeText(entityId).then(() => notify.success("ID copied"));
      }}
    >
      {entityId}
    </button>
  );
}
