"use client";

import { StepUpDialog } from "@/components/auth/step-up/step-up-dialog";
import { OauthOnlyTip } from "@/components/settings/sessions/oauth-only-tip";
import { RevokeAllBar } from "@/components/settings/sessions/revoke-all-bar";
import { SessionsEmptyState, SessionsList } from "@/components/settings/sessions/sessions-list";
import { toSessionView } from "@/lib/auth/sessions/session-view";
import { useStepUpCoordinator, withStepUp } from "@/lib/auth/step-up";
import type { UserSessionRow } from "@/lib/data/user-session-row";
import type { ISessionsApi } from "@/lib/services/client/sessions.client";
import { httpSessionsApi } from "@/lib/services/client/sessions.client";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function SessionsClientPage({
  sessions,
  sessionsApi = httpSessionsApi,
}: {
  sessions: UserSessionRow[];
  sessionsApi?: ISessionsApi;
}) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const coordinator = useStepUpCoordinator();

  const views = useMemo(() => sessions.map((s) => toSessionView(s, now)), [sessions, now]);

  const others = sessions.filter((s) => !s.isCurrent);

  async function deleteSession(id: string) {
    setRevoking(id);
    const result = await withStepUp(() => sessionsApi.revoke(id), coordinator);
    setRevoking(null);
    if (!result.ok) {
      if (result.reason === "recent_auth_required" || result.reason === "credential_required") {
        return;
      }
      if (result.reason === "not_found") {
        notify.error("That session could not be found.");
        return;
      }
      notify.error("Could not revoke session. Please try again.");
      return;
    }
    notify.success("Session revoked.");
    router.refresh();
  }

  async function revokeAll() {
    setRevokingAll(true);
    const result = await withStepUp(() => sessionsApi.revokeAllOthers(), coordinator);
    setRevokingAll(false);
    if (!result.ok) {
      if (result.reason === "recent_auth_required" || result.reason === "credential_required") {
        return;
      }
      notify.error("Could not revoke sessions. Please try again.");
      return;
    }
    notify.success("All other sessions revoked. You may need to sign in on those devices.");
    router.refresh();
  }

  return (
    <>
      <StepUpDialog coordinator={coordinator} />
      <div className="space-y-4">
        <OauthOnlyTip />
        <SessionsList
          views={views}
          revokingId={revoking}
          onRevoke={(id) => void deleteSession(id)}
        />
        {others.length === 0 ? <SessionsEmptyState /> : null}
        {others.length > 1 ? (
          <RevokeAllBar count={others.length} busy={revokingAll} onConfirm={() => revokeAll()} />
        ) : null}
      </div>
    </>
  );
}
