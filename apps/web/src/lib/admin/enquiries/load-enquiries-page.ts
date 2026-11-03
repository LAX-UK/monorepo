import "server-only";

import {
  type EnquiriesFilters,
  type EnquiriesSearch,
  enquiriesApiQuery,
  enquiriesPagination,
  hasEnquiriesFilters,
  parseEnquiriesSearch,
} from "@/lib/admin/enquiries/enquiries-search";
import type { EnquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { getAdminEnquiries, getEnquiryAssignees } from "@/lib/data/http/admin-enquiries.reader";
import type { EnquiryAssignee, EnquiryListPage } from "@/lib/data/http/admin-enquiries.schema";

export type EnquiriesPageModel = {
  filters: EnquiriesFilters;
  filtered: boolean;
  page: EnquiryListPage | null;
  assignees: EnquiryAssignee[];
  pagination: ReturnType<typeof enquiriesPagination>;
  loadError: string | null;
};

/** Data and composition boundary for `/admin/enquiries`. */
export async function loadAdminEnquiriesPage(
  sp: EnquiriesSearch,
  abilities: Pick<EnquiryAbilities, "defaultView">,
): Promise<EnquiriesPageModel> {
  const filters = parseEnquiriesSearch(sp, abilities.defaultView);
  const [page, assignees] = await Promise.allSettled([
    getAdminEnquiries(enquiriesApiQuery(filters)),
    getEnquiryAssignees(),
  ]);
  const base = {
    filters,
    filtered: hasEnquiriesFilters(filters),
    assignees: assignees.status === "fulfilled" ? assignees.value : [],
  };
  if (page.status === "rejected") {
    const message = page.reason instanceof Error ? page.reason.message : "";
    return {
      ...base,
      page: null,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to enquiries."
          : "The Bid API didn't answer. Enquiries are still being kept; try again in a moment.",
    };
  }
  return {
    ...base,
    page: page.value,
    pagination: enquiriesPagination(sp, filters, abilities.defaultView, {
      itemCount: page.value.items.length,
      nextCursor: page.value.nextCursor,
    }),
    loadError: null,
  };
}
