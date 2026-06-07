import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { amlMatchStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

const VERIFF_STATION_BASE =
  process.env.NEXT_PUBLIC_VERIFF_STATION_URL ?? "https://station.veriff.com";

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
      <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        KYC session history
      </h3>
      {sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No Veriff sessions on record.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {sessions.map((s) => {
            const isCurrent = currentKycSessionId === s.providerSessionId;
            const amlScreening = amlScreeningBySessionId[s.providerSessionId] ?? null;
            return (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge domain="kyc" status={s.status} size="sm" />
                  {isCurrent ? (
                    <AdminStatusBadge domain="kyc" status="approved" label="Current" size="sm" />
                  ) : null}
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
                    <dd className="break-all font-mono text-xs">
                      {s.providerSessionId}{" "}
                      <a
                        href={`${VERIFF_STATION_BASE}/verifications/${s.providerSessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-primary underline"
                      >
                        Open in Veriff
                      </a>
                    </dd>
                  </div>
                  {amlScreening ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Watchlist screening
                      </dt>
                      <dd>
                        <Link
                          href={`/admin/compliance/aml?screening=${encodeURIComponent(amlScreening.id)}`}
                          className="text-primary underline"
                        >
                          {amlMatchStatusLabel[amlScreening.matchStatus] ??
                            amlScreening.matchStatus.replaceAll("_", " ")}
                          {amlScreening.reviewStatus === "pending" ? " · awaiting review" : ""}
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                  {s.decisionReasonLabel ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Reason
                      </dt>
                      <dd>
                        {s.decisionReasonLabel}
                        {s.decisionReasonCode != null ? ` (code ${s.decisionReasonCode})` : ""}
                      </dd>
                    </div>
                  ) : null}
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
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        ID
                      </dt>
                      <dd>
                        {s.verifiedIdType ?? "ID"} · {s.verifiedIdCountry}
                        {s.verifiedDocState ? ` (${s.verifiedDocState})` : ""}
                        {s.verifiedIdNumber
                          ? ` · ${s.verifiedIdNumber}`
                          : s.verifiedIdNumberLast4
                            ? ` ····${s.verifiedIdNumberLast4}`
                            : ""}
                      </dd>
                    </div>
                  ) : null}
                  {s.verifiedNationality || s.verifiedCitizenship ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Nationality
                      </dt>
                      <dd>
                        {[s.verifiedNationality, s.verifiedCitizenship]
                          .filter(Boolean)
                          .filter((v, i, arr) => arr.indexOf(v) === i)
                          .join(" · ")}
                      </dd>
                    </div>
                  ) : null}
                  {s.verifiedGender ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Gender
                      </dt>
                      <dd>{s.verifiedGender}</dd>
                    </div>
                  ) : null}
                  {s.verifiedPlaceOfBirth ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Place of birth
                      </dt>
                      <dd>{s.verifiedPlaceOfBirth}</dd>
                    </div>
                  ) : null}
                  {s.verifiedIdValidFrom || s.verifiedIdExpiry ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Document validity
                      </dt>
                      <dd>
                        {s.verifiedIdValidFrom ?? "—"} → {s.verifiedIdExpiry ?? "—"}
                      </dd>
                    </div>
                  ) : null}
                  {s.decisionRiskScore || s.decisionIpCountry ? (
                    <div>
                      <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                        Risk signals
                      </dt>
                      <dd>
                        {s.decisionRiskScore ? `score ${s.decisionRiskScore}` : ""}
                        {s.decisionRiskScore && s.decisionIpCountry ? " · " : ""}
                        {s.decisionIpCountry ? `IP ${s.decisionIpCountry}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}
