"use client";

import type { SessionView } from "@/lib/auth/sessions/session-view";
import { SessionCard } from "./session-card";
import { SessionsEmptyState } from "./sessions-empty-state";

export function SessionsList({
  views,
  revokingId,
  onRevoke,
}: {
  views: SessionView[];
  revokingId: string | null;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {views.map((v) => (
        <SessionCard key={v.id} view={v} revoking={revokingId === v.id} onRevoke={onRevoke} />
      ))}
    </div>
  );
}

export { SessionsEmptyState };
