import { AccountingQueueList } from "@/components/admin/finance/accounting-queue-list";
import {
  ACCOUNTING_DESCRIPTION,
  type AccountingSearch,
} from "@/lib/admin/finance/accounting-queue.vm";
import { loadAdminAccountingPage } from "@/lib/admin/finance/load-accounting-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate("Accounting", ACCOUNTING_DESCRIPTION);

export default async function AdminAccountingPage({
  searchParams,
}: {
  searchParams: Promise<AccountingSearch>;
}) {
  const page = await loadAdminAccountingPage(await searchParams);
  return (
    <AccountingQueueList
      search={page.search}
      tab={page.tab}
      rows={page.rows}
      counts={page.counts}
      issuedToday={page.issuedToday}
      lastSent={page.lastSent}
      organisation={page.organisation}
      reference={page.reference}
      referenceError={page.referenceError}
      pageSize={page.pageSize}
      pagination={page.pagination}
      filtered={page.filtered}
      loadError={page.loadError}
      canAct={page.canAct}
      rehearsal={page.rehearsal}
      unreadable={page.unreadable}
      partFunded={page.partFunded}
    />
  );
}
