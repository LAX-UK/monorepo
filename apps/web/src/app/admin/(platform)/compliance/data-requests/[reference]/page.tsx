import { DataRequestView } from "@/components/admin/data-requests/data-request-view";
import { loadAdminDataRequestPage } from "@/lib/admin/data-requests/load-data-request-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { DATA_REQUESTS_MANAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = metadataForPrivate(
  "Data request",
  "One request for a copy of a person's data, its due date, what is left to do and its history.",
);

const ACTIONS = ["extend", "close", "continue"] as const;

export default async function AdminDataRequestPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const sp = await searchParams;
  await requireAdminCapability(
    DATA_REQUESTS_MANAGE_ACCESS,
    `/admin/compliance/data-requests/${reference}`,
  );
  const page = await loadAdminDataRequestPage(decodeURIComponent(reference), sp);
  if (page.kind === "not_found") notFound();
  if (page.kind !== "ready") {
    throw new Error(
      page.kind === "forbidden" ? "forbidden" : "Data request unavailable. Try again in a moment.",
    );
  }
  const action = typeof sp.action === "string" ? sp.action : null;
  return (
    <DataRequestView
      record={page.record}
      today={page.today}
      listHref={page.listHref}
      pager={page.pager}
      holds={page.holds}
      initialAction={ACTIONS.find((candidate) => candidate === action) ?? null}
    />
  );
}
