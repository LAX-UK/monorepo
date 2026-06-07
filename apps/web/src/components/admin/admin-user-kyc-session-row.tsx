"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { amlMatchStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { cn } from "@auction/ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

const VERIFF_STATION_BASE =
  process.env.NEXT_PUBLIC_VERIFF_STATION_URL ?? "https://station.veriff.com";

function SessionDetailGrid({
  session: s,
  amlScreening,
}: {
  session: AdminKycSessionRow;
  amlScreening: AdminAmlScreeningRow | null;
}) {
  return (
    <div className="space-y-2">
      <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
        <div className="md:col-span-2">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">
            Veriff verification
          </dt>
          <dd>
            <a
              href={`${VERIFF_STATION_BASE}/verifications/${s.providerSessionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
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
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Reason</dt>
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
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">DOB</dt>
            <dd>{s.verifiedDateOfBirth}</dd>
          </div>
        ) : null}
        {s.verifiedIdCountry ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">ID</dt>
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
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Gender</dt>
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
      <AdminTechnicalIdDisclosure
        triggerLabel="Show Veriff session ID"
        items={[
          {
            label: "Veriff session",
            value: s.providerSessionId,
            copyLabel: "Veriff session ID",
          },
        ]}
      />
    </div>
  );
}

export function AdminUserKycSessionRow({
  session,
  isCurrent,
  amlScreening,
}: {
  session: AdminKycSessionRow;
  isCurrent: boolean;
  amlScreening: AdminAmlScreeningRow | null;
}) {
  const summary = (
    <div className="flex flex-wrap items-center gap-2">
      <AdminStatusBadge domain="kyc" status={session.status} size="sm" />
      {isCurrent ? (
        <AdminStatusBadge domain="kyc" status="approved" label="Current" size="sm" />
      ) : null}
      <span className="text-xs text-on-surface-variant">
        {formatAdminUserDate(session.createdAt)}
        {session.decisionAt ? ` · decided ${formatAdminUserDate(session.decisionAt)}` : ""}
      </span>
    </div>
  );

  if (isCurrent) {
    return (
      <li className="py-3 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {summary}
          <a
            href={`${VERIFF_STATION_BASE}/verifications/${session.providerSessionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-label text-[10px] uppercase text-primary underline"
          >
            Open in Veriff
          </a>
        </div>
        <SessionDetailGrid session={session} amlScreening={amlScreening} />
      </li>
    );
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Collapsible>
        <CollapsibleTrigger
          className={cn(
            "flex w-full min-h-10 items-center justify-between gap-2 rounded-md text-left",
            "hover:bg-surface-container-low/60",
          )}
        >
          {summary}
          <ChevronDown
            className="size-4 shrink-0 text-on-surface-variant transition-transform [[data-state=open]_&]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SessionDetailGrid session={session} amlScreening={amlScreening} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
