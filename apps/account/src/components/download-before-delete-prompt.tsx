import { Button } from "@/components/account-button";
import { DATA_EXPORT_ROUTE } from "@/server/domain/data-export-routes";
import { CARD, CARD_PADDING, CARD_TITLE } from "./account-ui";

/**
 * A prompt on the deletion page, not a gate: a copy of the data can no longer be prepared once
 * the account is gone, so the person is pointed to it, and deletion goes on as it was.
 */
export function DownloadBeforeDeletePrompt() {
  return (
    <section
      aria-labelledby="download-before-delete-heading"
      className={`${CARD} ${CARD_PADDING} flex flex-col gap-3`}
    >
      <div className="flex flex-col gap-1">
        <h2 id="download-before-delete-heading" className={CARD_TITLE}>
          Before you go
        </h2>
        <p className="text-sm text-on-surface-variant">
          You may want a copy of your data first. Once your account is deleted we can't prepare one.
        </p>
      </div>
      <Button asChild variant="outline" className="w-full sm:w-fit">
        <a href={DATA_EXPORT_ROUTE}>Download your data</a>
      </Button>
    </section>
  );
}
