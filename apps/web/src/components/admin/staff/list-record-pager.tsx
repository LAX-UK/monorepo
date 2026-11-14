"use client";

import type { ListRecordPagerModel } from "@/lib/admin/list-record";
import { RecordPager } from "@auction/staff-ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

/**
 * Previous and Next through the list a record was opened from ("‹ 3 of 50 ›", K and J), keeping
 * the list's query on each record so the list comes back as it was.
 */
export function ListRecordPager({ pager, noun }: { pager: ListRecordPagerModel; noun: string }) {
  const router = useRouter();
  return (
    <RecordPager
      position={pager.position}
      total={pager.total}
      previousHref={pager.previousHref}
      nextHref={pager.nextHref}
      listQuery={pager.listQuery}
      noun={noun}
      Link={NextLink}
      navigate={(href) => router.push(href)}
    />
  );
}
