"use client";

import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";

type Props = {
  entityId: string;
};

export function CatalogInfoAsideCopyId({ entityId }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Copy ID ${entityId}`}
      className="mt-1 block h-auto min-h-0 w-full truncate justify-start p-0 text-left font-mono text-xs text-on-surface shadow-none hover:bg-transparent hover:text-link"
      onClick={() => {
        void navigator.clipboard.writeText(entityId).then(() => notify.success("ID copied"));
      }}
    >
      {entityId}
    </Button>
  );
}
