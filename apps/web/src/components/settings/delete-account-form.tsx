"use client";

import { requestAccountDeletionAction } from "@/lib/actions/account-deletion";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PHRASE = "DELETE MY ACCOUNT" as const;

export function DeleteAccountForm() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant/20 p-4">
      <p className="font-body text-sm text-on-surface-variant">
        Request account deletion. You must have no open buyer invoices, active seller lots, or
        in-flight payouts. This schedules removal per our data retention policy (cooling-off
        applies).
      </p>
      <label
        htmlFor="delete-account-confirm-phrase"
        className="block font-label text-xs uppercase tracking-widest text-on-surface-variant"
      >
        Type {PHRASE} to confirm
      </label>
      <input
        id="delete-account-confirm-phrase"
        className="w-full rounded border border-outline-variant/30 bg-surface px-3 py-2 font-mono text-sm"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="destructive"
        disabled={busy || phrase !== PHRASE}
        onClick={() => {
          setBusy(true);
          void (async () => {
            const r = await requestAccountDeletionAction(phrase);
            setBusy(false);
            if (!r.ok) {
              notify.error(r.error);
              return;
            }
            notify.success("Deletion requested");
            router.refresh();
          })();
        }}
      >
        {busy ? "Submitting…" : "Request account deletion"}
      </Button>
    </div>
  );
}
