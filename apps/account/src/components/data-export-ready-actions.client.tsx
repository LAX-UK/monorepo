"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { deleteDataExportCopyAction } from "@/server/application/data-export-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { DATA_EXPORT_FILE_ROUTE, DATA_EXPORT_ROUTE } from "@/server/domain/data-export-routes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Download and Delete this copy. Download is a plain form post that Account answers with a
 * redirect to the file, so it works without scripts; coming back from signing in again, the
 * form is pressed once for the person.
 */
export function DataExportReadyActions({
  exportId,
  resume = false,
}: {
  exportId: string;
  resume?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resume || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", DATA_EXPORT_ROUTE);
    formRef.current?.requestSubmit();
  }, [resume]);

  function deleteCopy() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDataExportCopyAction(exportId);
      if (result.status === "deleted") {
        router.refresh();
        return;
      }
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(DATA_EXPORT_ROUTE));
        return;
      }
      setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form ref={formRef} method="post" action={DATA_EXPORT_FILE_ROUTE} className="contents">
          <input type="hidden" name="id" value={exportId} />
          {resume ? <input type="hidden" name="resumed" value="1" /> : null}
          <Button type="submit" variant="cta" className="w-full sm:w-fit">
            Download
          </Button>
        </form>
        <LoadingButton
          type="button"
          variant="outline"
          loading={pending}
          loadingLabel="Deleting…"
          className="w-full sm:w-fit"
          onClick={deleteCopy}
        >
          Delete this copy
        </LoadingButton>
      </div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
