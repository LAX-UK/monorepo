import { InfoIcon } from "lucide-react";

export function DayPhotosNotEndedBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-border-hairline bg-amber-500/10 p-4">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="font-body text-sm text-on-surface-variant">
        Auction day media can only be saved after the sale has ended. You can upload files now to
        prepare them, but the <strong>Save media</strong> button will become active once the sale
        status changes to ended.
      </p>
    </div>
  );
}
