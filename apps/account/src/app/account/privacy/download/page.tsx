import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { DataExportPanel } from "@/components/data-export-panel";
import { loadAccountSession } from "@/server/application/load-account-session";
import { loadDataExport } from "@/server/application/load-data-export";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks, buildDataExportContactLinks } from "@/server/domain/account-links";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import {
  DATA_EXPORT_PROBLEM_PARAM,
  DATA_EXPORT_RESUME_PARAM,
  DATA_EXPORT_ROUTE,
  parseDataExportProblem,
  parseDataExportResume,
} from "@/server/domain/data-export-routes";
import { buildDataExportPageVm } from "@/server/domain/data-export.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Download your data · LAX Account" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Download your data: ask for a copy, follow it, download it or delete it (wireframes A to F). */
export default async function DownloadYourDataPage({
  searchParams,
}: { searchParams: SearchParams }) {
  const session = await loadAccountSession();
  if (session.status === "unavailable") return <AccountUnavailable retryHref={DATA_EXPORT_ROUTE} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${DATA_EXPORT_ROUTE}`);

  const params = await searchParams;
  const read = await loadDataExport();
  const vm = buildDataExportPageVm(read, new Date(), session.overview.email);
  const links = buildDataExportContactLinks(buildAccountLinks(getLaxAccountContainer().config));

  return (
    <AccountShell>
      <AccountPageHeader
        title="Download your data"
        description={
          vm.kind === "ready_to_request" || vm.kind === "expired"
            ? "Get a copy of the information LAX holds about you. We'll prepare it and email you when it's ready, usually within minutes."
            : "A copy of the information LAX holds about you."
        }
        backHref={ACCOUNT_ROUTES.privacy}
        backLabel="Privacy"
      />
      <DataExportPanel
        vm={vm}
        fullCopyHref={links.fullCopy}
        contactHref={links.contact}
        retryHref={DATA_EXPORT_ROUTE}
        resume={parseDataExportResume(single(params[DATA_EXPORT_RESUME_PARAM]))}
        problem={parseDataExportProblem(single(params[DATA_EXPORT_PROBLEM_PARAM]))}
      />
    </AccountShell>
  );
}
