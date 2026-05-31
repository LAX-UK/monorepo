import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import { Surface } from "@auction/ui/components/surface";

export function AdminUserKycHistoryPanel({ sessions }: { sessions: AdminKycSessionRow[] }) {
  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        KYC session history
      </h3>
      {sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No Veriff sessions on record.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {sessions.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge domain="kyc" status={s.status} size="sm" />
                <span className="text-xs text-on-surface-variant">
                  {formatAdminUserDate(s.createdAt)}
                  {s.decisionAt ? ` · decided ${formatAdminUserDate(s.decisionAt)}` : ""}
                </span>
              </div>
              <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                    Provider session
                  </dt>
                  <dd className="break-all font-mono text-xs">{s.providerSessionId}</dd>
                </div>
                {(s.verifiedFirstName || s.verifiedLastName) && (
                  <div>
                    <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                      Verified name
                    </dt>
                    <dd>{[s.verifiedFirstName, s.verifiedLastName].filter(Boolean).join(" ")}</dd>
                  </div>
                )}
                {s.verifiedDateOfBirth ? (
                  <div>
                    <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                      DOB
                    </dt>
                    <dd>{s.verifiedDateOfBirth}</dd>
                  </div>
                ) : null}
                {s.verifiedIdCountry ? (
                  <div>
                    <dt className="font-label text-[10px] uppercase text-on-surface-variant">ID</dt>
                    <dd>
                      {s.verifiedIdType ?? "ID"} · {s.verifiedIdCountry}
                      {s.verifiedIdNumberLast4 ? ` ····${s.verifiedIdNumberLast4}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
