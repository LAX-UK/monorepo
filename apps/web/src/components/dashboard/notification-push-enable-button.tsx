"use client";

import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import { registerPushSubscription } from "@/lib/push/subscribe";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function NotificationPushEnableButton({ saveDisabled = false }: { saveDisabled?: boolean }) {
  const [pushBusy, setPushBusy] = useState(false);
  const router = useRouter();

  const onEnablePush = async () => {
    setPushBusy(true);
    try {
      const res = await fetch(`${apiBase()}/users/me/push/vapid-key`, { credentials: "include" });
      const body = (await res.json()) as { data?: { publicKey?: string | null } };
      const key = body.data?.publicKey;
      if (!key) {
        toast.error("Push is not configured on the server (missing VAPID keys).");
        return;
      }
      await registerPushSubscription(key);
      toast.success("Browser notifications enabled");
      const r = await updateNotificationPreferencesFromValuesAction({
        outbidPush: true,
        wonPush: true,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <Button
        type="button"
        disabled={pushBusy || saveDisabled}
        onClick={() => void onEnablePush()}
        className="h-auto rounded-md bg-primary px-4 py-3 font-label text-xs uppercase tracking-widest text-on-primary disabled:opacity-50"
      >
        {pushBusy ? "Working…" : "Enable browser push"}
      </Button>
    </div>
  );
}
