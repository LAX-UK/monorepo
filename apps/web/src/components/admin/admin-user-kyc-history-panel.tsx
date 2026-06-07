import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { AdminUserKycSessionRow } from "@/components/admin/admin-user-kyc-session-row";
import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { Surface } from "@auction/ui/components/surface";

export function AdminUserKycHistoryPanel({
  sessions,
  currentKycSessionId,
  amlScreeningBySessionId = {},
}: {
  sessions: AdminKycSessionRow[];
  currentKycSessionId?: string | null;
  amlScreeningBySessionId?: Record<string, AdminAmlScreeningRow>;
}) {
  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <AdminSectionLabel>KYC session history</AdminSectionLabel>
      {sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No Veriff sessions on record.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {sessions.map((s) => (
            <AdminUserKycSessionRow
              key={s.id}
              session={s}
              isCurrent={currentKycSessionId === s.providerSessionId}
              amlScreening={amlScreeningBySessionId[s.providerSessionId] ?? null}
            />
          ))}
        </ul>
      )}
    </Surface>
  );
}
